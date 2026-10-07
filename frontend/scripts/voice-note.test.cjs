/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function harness(initialUrl = "") {
  const states = [], calls = [];
  let cursor = 0, permission = true, picker = { canceled: false, assets: [{ uri: "file:///note.m4a", name: "note.m4a", mimeType: "audio/mp4", size: 40 }] };
  const recorder = { uri: "file:///recording.m4a", isRecording: false, prepareToRecordAsync: async () => calls.push("prepare"), record: () => { calls.push("record"); recorder.isRecording = true; }, stop: async () => { calls.push("stop"); recorder.isRecording = false; } };
  const player = { pause: () => calls.push("pause"), play: () => calls.push("play"), seekTo: async () => {} };
  const mocks = {
    react: { useEffect: () => {}, useRef(initial) { const i = cursor++; if (!(i in states)) states[i] = { current: initial }; return states[i]; }, useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial; return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; } },
    "react-native": { Platform: { OS: "android" }, StyleSheet: { create: x => x }, View: "view", Text: "text", Pressable: "button", AppState: { addEventListener: () => ({ remove() {} }) } },
    "@expo/vector-icons": { Ionicons: "icon" },
    "@/src/theme": { useTheme: () => ({ colors: {} }) },
    "expo-audio": { RecordingPresets: { HIGH_QUALITY: {} }, useAudioRecorder: () => recorder, useAudioPlayer: () => player, useAudioPlayerStatus: () => ({ isLoaded: true, currentTime: 0 }), requestRecordingPermissionsAsync: async () => ({ granted: permission }), setAudioModeAsync: async mode => calls.push(["mode", mode]) },
    "expo-document-picker": { getDocumentAsync: async () => picker },
    "expo-file-system": { File: class { size = 40; async base64() { return "synthetic-audio"; } } },
    "@/src/api": { authHeaders: () => ({}), resolveMediaUrl: x => x, api: { uploadVoiceNote: async (...args) => { calls.push(["upload", ...args]); return { voice_note_url: "/media/voice-notes/saved.m4a" }; } } },
  };
  const filename = path.resolve(__dirname, "../src/components/voice-note-field.tsx");
  const loaded = new Module(filename, module);
  loaded.require = id => mocks[id] || require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  let value;
  const render = () => { cursor = 0; value = loaded.exports.useVoiceNote(initialUrl); return loaded.exports.VoiceNoteField({ value }); };
  return { render, value: () => value, calls, deny: () => { permission = false; }, pick: x => { picker = x; } };
}
function nodes(n) { return !n ? [] : Array.isArray(n) ? n.flatMap(nodes) : typeof n !== "object" ? [] : [n, ...nodes(n.props?.children)]; }
const find = (tree, id) => nodes(tree).find(n => n.props?.testID === id);

test("checkbox hides controls until selected; unchecked saves no audio", async () => {
  const app = harness();
  assert.equal(find(app.render(), "voice-note-record"), undefined);
  assert.equal(await app.value().save(), "");
  find(app.render(), "voice-note-checkbox").props.onPress();
  assert.ok(find(app.render(), "voice-note-record"));
  await assert.rejects(app.value().save(), /Record or upload/);
});
test("upload previews locally, caches upload for save retry, and Remove clears attachment", async () => {
  const app = harness(); app.render(); app.value().setEnabled(true);
  await find(app.render(), "voice-note-upload").props.onPress();
  assert.ok(find(app.render(), "voice-note-play"));
  assert.equal(app.calls.filter(x => x[0] === "upload").length, 0);
  assert.equal(await app.value().save(), "/media/voice-notes/saved.m4a");
  assert.equal(await app.value().save(), "/media/voice-notes/saved.m4a");
  assert.equal(app.calls.filter(x => x[0] === "upload").length, 1);
  find(app.render(), "voice-note-remove").props.onPress();
  assert.equal(find(app.render(), "voice-note-play"), undefined);
  app.value().setEnabled(false); app.render();
  assert.equal(await app.value().save(), "");
});
test("saved edit note is preserved without uploading; reset clears it", async () => {
  const app = harness("/media/voice-notes/old.m4a"); app.render();
  assert.equal(await app.value().save(), "/media/voice-notes/old.m4a");
  app.value().reset(); app.render();
  assert.equal(await app.value().save(), "");
});
test("cancel and oversized upload preserve the previous note", async () => {
  const app = harness("/media/voice-notes/old.m4a");
  app.pick({ canceled: true }); await find(app.render(), "voice-note-upload").props.onPress();
  app.pick({ canceled: false, assets: [{ name: "big.mp3", size: 6 * 1024 * 1024 }] });
  await find(app.render(), "voice-note-upload").props.onPress(); app.render();
  assert.equal(await app.value().save(), "/media/voice-notes/old.m4a");
});
test("microphone denial never starts recording", async () => {
  const app = harness(); app.render(); app.value().setEnabled(true); app.deny();
  await find(app.render(), "voice-note-record").props.onPress(); app.render();
  assert.equal(app.calls.includes("record"), false);
  assert.equal(app.value().busy, false);
});
test("record then stop produces a removable playable note and blocks saving while recording", async () => {
  const app = harness(); app.render(); app.value().setEnabled(true);
  await find(app.render(), "voice-note-record").props.onPress(); app.render();
  await assert.rejects(app.value().save(), /Finish recording/);
  await find(app.render(), "voice-note-record").props.onPress(); app.render();
  assert.equal(app.value().note.uri, "file:///recording.m4a");
  assert.equal(app.value().busy, false);
  assert.ok(find(app.render(), "voice-note-remove"));
});
