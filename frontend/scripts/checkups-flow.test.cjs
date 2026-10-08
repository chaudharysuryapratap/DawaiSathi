/* global __dirname */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), test = require("node:test"), ts = require("typescript");
const nodes = n => !n || typeof n !== "object" ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
function harness(params = {}) {
  const scheduleFile = path.resolve(__dirname, "../src/checkup-schedule.ts"), schedule = new Module(scheduleFile, module);
  schedule._compile(ts.transpileModule(fs.readFileSync(scheduleFile, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scheduleFile);
  const states = []; let cursor = 0; const calls = [];
  const future = new Date(Date.now() + 86400000).toISOString(), past = new Date(Date.now() - 86400000).toISOString();
  const records = [{ id: "past", title: "Past visit", scheduled_at: past }, { id: "later", title: "Later visit", scheduled_at: new Date(Date.now() + 172800000).toISOString() }, { id: "next", title: "Eye checkup", scheduled_at: future }].map(item => ({ doctor: "Dr. Sharma", location: "City Hospital", member_id: "m", notes: "Private notes", ...item }));
  const mocks = {
    "@/src/checkup-schedule": schedule.exports,
    "react-native-svg": { __esModule: true, default: "svg", Circle: "circle", Line: "line", Rect: "rect" },
    react: { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial; return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; }, useEffect() {} },
    "react-native": { AppState: {}, Pressable: "button", Text: "text", View: "view", StyleSheet: { create: x => x } },
    "expo-router": { Stack: { Screen: "screen" }, useLocalSearchParams: () => params, useRouter: () => ({ push: value => calls.push(["push", value]), replace: value => calls.push(["replace", value]) }) },
    "@expo/vector-icons": { Ionicons: "icon" }, "@/src/components/bottom-sheet": { BottomSheet: "sheet" },
    "@/src/components/dawai-ui": { PrimaryButton: "primary", ScreenShell: "shell", LoadingState: "loading", ErrorState: "error" },
    "@/src/theme": { makeStyles: fn => () => fn({}), useTheme: () => ({ colors: {} }) },
    "@/src/data-context": { useData: () => ({ checkups: records, members: [{ id: "m", name: "Surya" }], removeCheckup: async id => calls.push(["delete", id]) }) },
  };
  const filename = path.resolve(__dirname, "../app/care/checkups.tsx"), loaded = new Module(filename, module);
  loaded.require = id => mocks[id] || require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { calls, render() { cursor = 0; return loaded.exports.default(); } };
}
test("Checkups highlights the earliest visit, keeps notes off the list and separates past visits", () => {
  const app = harness(), tree = app.render(), all = nodes(tree);
  const cards = all.filter(n => n.props?.testID?.startsWith("checkup-row-"));
  assert.deepEqual(cards.map(n => n.props.testID), ["checkup-row-next", "checkup-row-later"]);
  assert.ok(!all.some(n => n.props?.children === "Private notes"));
  cards[0].props.onPress(); assert.equal(app.calls[0][1].params.id, "next");
  assert.ok(all.some(n => n.props?.label === "Add checkup"));
});
test("details edit uses the shared form and deletion requires confirmation", async () => {
  const app = harness({ id: "next" });
  nodes(app.render()).find(n => n.props?.label === "Edit checkup").props.onPress();
  assert.deepEqual(app.calls[0][1], { pathname: "/add-checkup", params: { id: "next" } });
  nodes(app.render()).find(n => n.props?.label === "Delete checkup" && n.props.icon).props.onPress();
  assert.equal(app.calls.some(c => c[0] === "delete"), false);
  const sheet = nodes(app.render()).find(n => n.type === "sheet"); assert.equal(sheet.props.visible, true);
  nodes(sheet).find(n => n.props?.label === "Delete checkup").props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(app.calls.some(c => c[0] === "delete" && c[1] === "next"));
});
test("past checkup follow-up opens the create form with a copy, not an edit", () => {
  const app = harness({ id: "past" }), tree = app.render();
  nodes(tree).find(n => n.props?.label === "Add as new checkup").props.onPress();
  assert.deepEqual(app.calls[0][1], { pathname: "/add-checkup", params: { copyId: "past" } });
  assert.ok(!nodes(tree).some(n => n.props?.label === "Edit checkup"));
});
