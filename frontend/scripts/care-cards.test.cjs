/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
function render({ fontScale = 1, width = 390, error = null } = {}) {
  const calls = [], states = []; let cursor = 0;
  const mocks = {
    "@/src/components/ui/PressableScale": { __esModule: true, default: "button" },
    react: { useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; } },
    "react-native": { Pressable: "button", Text: "text", View: "view", StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width, fontScale }) },
    "expo-router": { useRouter: () => ({ push: route => calls.push(route) }) },
    "expo-linear-gradient": { LinearGradient: "gradient" },
    "@expo/vector-icons": { Ionicons: "icon" },
    "@/src/components/app-header": { AppHeader: "header" },
    "@/src/components/bottom-sheet": { BottomSheet: "sheet" },
    "@/src/components/family-reminder-button": { FamilyReminderButton: "reminder" },
    "@/src/components/care-illustration": { CareIllustration: "illustration" },
    "@/src/components/dawai-ui": { ScreenShell: "screen", LoadingState: "loading", ErrorState: "error" },
    "@/src/data-context": { useData: () => ({ loading: false, error, refresh: () => calls.push("refresh") }) },
  };
  const filename = path.resolve(__dirname, "../app/(tabs)/care.tsx");
  const loaded = new Module(filename, module);
  loaded.require = id => mocks[id] || require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { calls, tree() { cursor = 0; return loaded.exports.default(); } };
}
const nodes = n => !n || typeof n !== "object" ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
const find = (tree, id) => nodes(tree).find(n => n.props?.testID === id);
test("four illustrated cards preserve existing navigation and use two columns", () => {
  const app = render();
  const tree = app.tree();
  const routes = { "care-medicines": "/care/medicines", "care-appointments": "/care/calendar", "care-prescriptions": "/care/prescription", "care-family-management": "/care/family-management" };
  for (const [id, route] of Object.entries(routes)) { const card = find(tree, id); assert.equal(card.props.style({ pressed: false })[0].width, "48.5%"); card.props.onPress(); assert.equal(app.calls.at(-1), route); }
  assert.equal(nodes(tree).filter(n => n.type === "illustration").length, 4);
});
test("large text and narrow phones switch to full-width cards without truncation", () => {
  for (const config of [{ fontScale: 1.3 }, { width: 320 }]) {
    const app = render(config), tree = app.tree();
    assert.equal(find(tree, "care-medicines").props.style({ pressed: false })[1].width, "100%");
    assert.equal(nodes(tree).filter(n => n.type === "text").some(n => n.props.numberOfLines), false);
  }
});
test("reminder previews success without a sheet until delivery integration", async () => {
  const app = render();
  const reminder = nodes(app.tree()).find(n => n.type === "reminder");
  await assert.doesNotReject(reminder.props.onSend());
  assert.equal(nodes(app.tree()).some(n => n.type === "sheet"), false);
  assert.deepEqual(app.calls, []);
});
