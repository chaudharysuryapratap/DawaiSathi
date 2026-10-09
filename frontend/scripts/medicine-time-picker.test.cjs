/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function harness(platform, disabled = false) {
  let cursor = 0, dialog;
  const states = [], selected = [];
  const mocks = {
    "@/src/components/ui/PressableScale": { __esModule: true, default: "button" },
    react: { useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => { states[index] = value; }];
    } },
    "react-native": { Platform: { OS: platform } },
    "@react-native-community/datetimepicker": { __esModule: true, default: "picker", DateTimePickerAndroid: { open: (options) => { dialog = options; } } },
    "@/src/components/bottom-sheet": { BottomSheet: "sheet" },
    "@/src/components/dawai-ui": { PrimaryButton: "button" },
  };
  const filename = path.resolve(__dirname, "../src/components/medicine-time-picker.tsx");
  const loaded = new Module(filename, module);
  loaded.require = (id) => mocks[id] || require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return {
    render() { cursor = 0; return loaded.exports.MedicineTimePicker({ onSelect: (value) => selected.push(value), disabled }); },
    selected, get dialog() { return dialog; },
  };
}
function nodes(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children), ...nodes(node.props?.footer)];
}
const find = (tree, id) => nodes(tree).find((node) => node.props?.testID === id);

test("Android clock only adds a confirmed time; formats midnight and PM correctly", () => {
  const app = harness("android");
  find(app.render(), "medicine-time-select").props.onPress();
  assert.equal(app.dialog.mode, "time");
  assert.equal(app.dialog.display, "clock");
  assert.deepEqual(app.selected, []); // Opening or dismissing does not add a time.
  const date = new Date(); date.setHours(0, 5);
  app.dialog.onValueChange({}, date);
  date.setHours(23, 59); app.dialog.onValueChange({}, date);
  assert.deepEqual(app.selected, ["00:05", "23:59"]);
});

test("iPhone changes stay pending until Add time; closing discards the pending selection", () => {
  const app = harness("ios");
  find(app.render(), "medicine-time-select").props.onPress();
  let tree = app.render();
  assert.equal(nodes(tree).find((node) => node.type === "sheet").props.visible, true);
  const date = new Date(); date.setHours(17, 30);
  find(tree, "medicine-time-picker").props.onValueChange({}, date);
  assert.deepEqual(app.selected, []);
  tree = app.render();
  nodes(tree).find((node) => node.type === "sheet").props.onClose();
  assert.deepEqual(app.selected, []);
  find(app.render(), "medicine-time-select").props.onPress();
  find(app.render(), "medicine-time-confirm").props.onPress();
  assert.deepEqual(app.selected, ["17:30"]);
  assert.equal(nodes(app.render()).find((node) => node.type === "sheet").props.visible, false);
});

test("saving prevents opening another picker", () => {
  const app = harness("android", true);
  find(app.render(), "medicine-time-select").props.onPress();
  assert.equal(app.dialog, undefined);
});
