/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function harness(existing) {
  const states = [];
  let cursor = 0;
  const calls = [];
  let granted = true;
  let result = { canceled: false, assets: [{ base64: "synthetic-photo", mimeType: "image/jpeg" }] };
  const data = {
    medicines: existing ? [existing] : [], members: [], activeMemberId: null,
    addMedicine: async (input) => calls.push(["save", input]),
    updateMedicine: async (id, input) => calls.push(["update", id, input]),
  };
  const mocks = {
    react: {
      useMemo: (fn) => fn(),
      useRef(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = { current: initial };
        return states[index];
      },
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
      },
    },
    "react-native": {
      Platform: { OS: "android" }, StyleSheet: { create: (value) => value },
      KeyboardAvoidingView: "root", Pressable: "button", ScrollView: "scroll", Text: "text", TextInput: "input", View: "view",
    },
    "expo-image": { Image: "image" },
    "@expo/vector-icons": { Ionicons: "icon" },
    "expo-router": { useLocalSearchParams: () => ({ id: existing?.id }), useRouter: () => ({ back: () => calls.push(["back"]) }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
    "@/src/theme": { useTheme: () => ({ colors: {} }), makeStyles: (fn) => () => fn({}) },
    "@/src/data-context": { useData: () => data },
    "@/src/components/dawai-ui": { PrimaryButton: "primary" },
    "@/src/components/focus-input": { TextInput: "input" },
    "@/src/components/voice-note-field": { VoiceNoteField: "voice-field", useVoiceNote: () => ({ busy: false, save: async () => "", reset: () => calls.push(["voice-reset"]) }) },
    "@/src/components/medicine-time-picker": { MedicineTimePicker: "time-picker" },
    "@/src/api": {
      authHeaders: () => ({ Authorization: "synthetic" }), resolveMediaUrl: (uri) => uri,
      api: { uploadMedicineImage: async (...args) => { calls.push(["upload", ...args]); return { image_url: "/media/synthetic.jpg" }; } },
    },
    "expo-image-picker": {
      requestCameraPermissionsAsync: async () => { calls.push(["permission"]); return { granted }; },
      launchCameraAsync: async (options) => { calls.push(["camera", options]); return result; },
      launchImageLibraryAsync: async (options) => { calls.push(["library", options]); return result; },
    },
  };
  const filename = path.resolve(__dirname, "../app/add-medicine.tsx");
  const testedModule = new Module(filename, module);
  testedModule.require = (id) => mocks[id] || require(id);
  testedModule._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  function render() {
    cursor = 0;
    const form = testedModule.exports.default();
    return form.type(form.props);
  }
  return { render, calls, deny: () => { granted = false; }, result: (value) => { result = value; } };
}

function nodes(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
const find = (tree, id) => nodes(tree).find((node) => node.props?.testID === id);
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("identification contains the photo controls; gallery/camera preview, cancellation, removal and save work", async () => {
  const app = harness();
  let tree = app.render();
  const section = find(tree, "medicine-identification-section");
  assert.equal(section.props.children[0].props.label, "Identification cue");
  assert.equal(find(tree, "medicine-photo-preview"), undefined);
  assert.ok(!nodes(tree).some((node) => typeof node.props?.children === "string" && /Add an optional|Stored with your local backend/.test(node.props.children)));
  assert.ok(nodes(tree).some((node) => node.props?.children === "JPEG, PNG, or WebP, up to 5 MB."));
  assert.ok(find(section, "medicine-photo-choose"));
  assert.ok(find(section, "medicine-photo-camera"));
  assert.equal(nodes(tree).filter((node) => node.props?.testID === "medicine-photo-choose").length, 1);
  find(tree, "medicine-photo-choose").props.onPress();
  await flush();
  tree = app.render();
  assert.equal(find(tree, "medicine-photo-preview").props.source.uri, "data:image/jpeg;base64,synthetic-photo");
  assert.equal(app.calls.filter(([name]) => name === "upload").length, 0);
  app.result({ canceled: true, assets: [] });
  find(tree, "medicine-photo-camera").props.onPress();
  await flush();
  assert.ok(find(app.render(), "medicine-photo-preview"));
  app.result({ canceled: false, assets: [{ base64: "camera-photo", mimeType: "image/jpeg" }] });
  find(app.render(), "medicine-photo-camera").props.onPress();
  await flush();
  tree = app.render();
  assert.equal(find(tree, "medicine-identification-section").props.children[1].props.testID, "medicine-photo-preview");
  assert.equal(find(tree, "medicine-photo-preview").props.source.uri, "data:image/jpeg;base64,camera-photo");
  for (const [label, value] of [["Medicine name", "Synthetic"], ["Dosage", "1 tablet"], ["Identification cue", "White tablet"]]) {
    nodes(tree).find((node) => node.props?.label === label).props.onChangeText(value);
  }
  const selectTime = nodes(tree).find((node) => node.type === "time-picker").props.onSelect;
  selectTime("23:59"); selectTime("00:05"); selectTime("08:00"); selectTime("23:59");
  await find(app.render(), "save-medicine-button").props.onPress();
  const saved = app.calls.find(([name]) => name === "save")[1];
  assert.equal(saved.image_url, "/media/synthetic.jpg");
  assert.equal(saved.identification_cue, "White tablet");
  assert.deepEqual(saved.times, ["00:05", "08:00", "23:59"]);
  assert.deepEqual(app.calls.find(([name]) => name === "upload"), ["upload", "image/jpeg", "camera-photo"]);
  find(app.render(), "medicine-photo-remove").props.onPress();
  assert.equal(find(app.render(), "medicine-photo-preview"), undefined);
});

test("camera permission denial preserves an existing edit photo without opening the camera", async () => {
  const app = harness({ id: "existing", name: "Synthetic", dosage: "1 tablet", image_url: "/media/existing.jpg", times: ["08:00"] });
  app.deny();
  find(app.render(), "medicine-photo-camera").props.onPress();
  await flush();
  const tree = app.render();
  assert.equal(app.calls.filter(([name]) => name === "camera").length, 0);
  assert.equal(find(tree, "medicine-photo-preview").props.source.uri, "/media/existing.jpg");
  assert.ok(nodes(tree).some((node) => typeof node.props?.children === "string" && node.props.children.startsWith("Camera access is needed")));
});

test("selected-time chips remove custom and preset times and keep preset selection in sync", async () => {
  const app = harness();
  let tree = app.render();
  for (const [label, value] of [["Medicine name", "Synthetic"], ["Dosage", "1 tablet"]]) {
    nodes(tree).find((node) => node.props?.label === label).props.onChangeText(value);
  }
  const select = nodes(tree).find((node) => node.type === "time-picker").props.onSelect;
  select("14:45"); select("23:45");
  assert.ok(find(app.render(), "medicine-selected-time-14:45"));
  find(app.render(), "medicine-selected-time-14:45").props.onPress();
  assert.equal(find(app.render(), "medicine-selected-time-14:45"), undefined);
  assert.ok(find(app.render(), "medicine-selected-time-23:45"));
  find(app.render(), "medicine-selected-time-08:00").props.onPress();
  assert.equal(find(app.render(), "medicine-time-08:00").props.accessibilityState.selected, false);
  find(app.render(), "medicine-time-08:00").props.onPress();
  assert.ok(find(app.render(), "medicine-selected-time-08:00"));
  await find(app.render(), "save-medicine-button").props.onPress();
  assert.deepEqual(app.calls.find(([name]) => name === "save")[1].times, ["08:00", "23:45"]);
  find(app.render(), "medicine-selected-time-08:00").props.onPress();
  find(app.render(), "medicine-selected-time-23:45").props.onPress();
  const saveCount = app.calls.filter(([name]) => name === "save").length;
  await find(app.render(), "save-medicine-button").props.onPress();
  assert.equal(app.calls.filter(([name]) => name === "save").length, saveCount);
  tree = app.render();
  assert.ok(nodes(tree).some((node) => node.props?.children === "Add a medicine name, dosage, and at least one reminder time."));
});

test("Add another medicine saves once, resets the create form, and does not navigate away", async () => {
  const app = harness();
  const tree = app.render();
  for (const [label, value] of [["Medicine name", "First medicine"], ["Dosage", "1 tablet"], ["Identification cue", "White tablet"]]) {
    nodes(tree).find((node) => node.props?.label === label).props.onChangeText(value);
  }
  const button = find(app.render(), "add-another-medicine-button");
  await Promise.all([button.props.onPress(), button.props.onPress()]);
  assert.equal(app.calls.filter(([name]) => name === "save").length, 1);
  assert.equal(app.calls.filter(([name]) => name === "back").length, 0);
  const reset = app.render();
  assert.equal(nodes(reset).find((node) => node.props?.label === "Medicine name").props.value, "");
  assert.equal(nodes(reset).find((node) => node.props?.label === "Dosage").props.value, "");
  assert.equal(nodes(reset).find((node) => node.props?.label === "Identification cue").props.value, "");
  assert.ok(find(reset, "medicine-selected-time-08:00"));
  const edit = harness({ id: "existing", name: "Synthetic", dosage: "1 tablet", times: ["08:00"] });
  assert.equal(find(edit.render(), "add-another-medicine-button"), undefined);
});
