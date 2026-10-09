/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), test = require('node:test'), ts = require('typescript');
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
function harness() {
  const states = [], calls = []; let cursor = 0, stored = [];
  const mocks = {
    "@/src/components/ui/PressableScale": { __esModule: true, default: "button" },
    react: { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; }, useEffect() {}, useCallback: fn => fn, useRef: value => ({ current: value }) },
    'react-native': { Platform: { OS: 'android' }, View: 'view', Text: 'text', Pressable: 'button', ScrollView: 'scroll', KeyboardAvoidingView: 'keyboard' },
    'expo-router': { Stack: { Screen: 'screen' }, useLocalSearchParams: () => ({}), useRouter: () => ({ push: value => calls.push(['route', value]) }) },
    'expo-image': { Image: 'image' }, '@expo/vector-icons': { Ionicons: 'icon' }, 'expo-document-picker': {}, 'expo-file-system': {}, 'expo-sharing': {},
    '@/src/components/focus-input': { TextInput: 'input' }, '@/src/components/bottom-sheet': { BottomSheet: 'sheet' }, '@/src/components/dawai-ui': { PrimaryButton: 'primary' }, '@/src/components/checkup-date-picker': { CheckupDatePicker: 'date' }, '@/src/components/prescription-camera': { PrescriptionCamera: 'camera' },
    '@/src/api': {}, '@/src/theme': { useTheme: () => ({ colors: {} }) },
    '@/src/data-context': { useData: () => ({ members: [{ id: 'patient', name: 'Surya' }], activeFamilyGroupId: 'family', activeMemberId: 'patient' }) },
    '@/src/prescriptions': { prescriptions: { save: async value => { calls.push(['save', value]); stored = [{ ...value, id: 'saved' }]; return stored[0]; }, list: async () => stored } },
  };
  const filename = path.resolve(__dirname, '../app/care/prescription.tsx'), loaded = new Module(filename, module);
  loaded.require = id => mocks[id] || require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const render = () => { cursor = 0; return loaded.exports.default(); };
  return { calls, render, nodes: () => nodes(render()) };
}
const button = (app, label) => app.nodes().find(n => n.props?.label === label);
test('main is storage focused; add sheet exposes three explicit choices', () => {
  const app = harness();
  assert.ok(app.nodes().some(n => n.props?.children === 'View and manage your saved prescriptions.'));
  button(app, 'Add prescription').props.onPress();
  assert.equal(app.nodes().find(n => n.type === 'sheet').props.visible, true);
  for (const label of ['Scan with camera', 'Upload photo or PDF', 'Add manually']) assert.ok(app.nodes().some(n => n.props?.children === label));
});
test('simplified prescription form opens the global medicine form and saves separately', async () => {
  const app = harness();
  app.nodes().find(n => n.type === 'button' && nodes(n).some(child => child.props?.children === 'Add manually')).props.onPress();
  app.nodes().find(n => n.type === 'input' && n.props.accessibilityLabel === 'Doctor or clinic name').props.onChangeText('Test clinic');
  assert.ok(!app.nodes().some(n => n.props?.children === 'Who is this prescription for?'));
  assert.ok(!app.nodes().some(n => n.props?.accessibilityLabel === 'Notes (optional)'));
  button(app, 'Add medicine').props.onPress();
  assert.equal(app.calls[0][1].pathname, '/add-medicine');
  assert.equal(app.calls[0][1].params.prescriptionMember, 'patient');
  button(app, 'Save prescription').props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  const save = app.calls.find(c => c[0] === 'save')[1];
  assert.equal(save.doctor, 'Test clinic'); assert.equal(save.medicines.length, 0);
});
