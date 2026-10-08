/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function harness(component, { owner = true, failDelete = false } = {}) {
  const state = [], calls = [];
  let cursor = 0;
  const group = { id: "family-test", name: "Surya", owner_user_id: "owner" };
  const mocks = {
    "expo-router": { Stack: { Screen: "screen" }, useLocalSearchParams: () => ({}) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "@/src/components/focus-input": { TextInput: "input" },
    "@/src/components/family-qr-scanner": { FamilyQrScanner: "scanner" },
    react: {
      useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial; return [state[i], v => { state[i] = typeof v === "function" ? v(state[i]) : v; }]; },
      useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
      useEffect(fn, deps) { const i = cursor++; if (!state[i] || deps.some((v, j) => v !== state[i][j])) { state[i] = deps; fn(); } },
    },
    "react-native": { Platform: { OS: "android" }, Pressable: "button", Text: "text", View: "view", TextInput: "input", StyleSheet: { create: v => v }, useWindowDimensions: () => ({ width: 390, fontScale: 1 }) },
    "@expo/vector-icons": { Ionicons: "icon" }, "expo-image": { Image: "image" },
    "expo-linear-gradient": { LinearGradient: "gradient" },
    "@/src/components/swipe-delete-row": { SwipeDeleteRow: "swipe" },
    "@/src/components/delete-confirmation": { DeleteConfirmation: "confirmation" },
    "expo-clipboard": { setStringAsync: async text => calls.push(["copy", text]) }, "expo-linking": { openURL: async url => calls.push(["email", url]) }, "react-native-qrcode-svg": { default: "qr", __esModule: true },
    "@/src/theme": { useTheme: () => ({ colors: {} }), makeStyles: fn => () => fn({}) },
    "./bottom-sheet": { BottomSheet: "sheet" }, "@/src/components/bottom-sheet": { BottomSheet: "sheet" },
    "@/src/components/dawai-ui": { PrimaryButton: "primary" }, "@/src/components/family-invite-sheet": { FamilyInviteSheet: "invite-sheet" },
    "@/src/auth-context": { useAuth: () => ({ user: { id: owner ? "owner" : "guest" } }) },
    "@/src/data-context": { useData: () => ({
      activeFamilyGroup: group, activeFamilyGroupId: group.id, familyGroups: [group, { ...group, id: "second", name: "Second" }],
      members: [{ id: "primary", name: "You", is_primary: true }, { id: "other", name: "Chaudhary", role: "member" }], activeMember: { id: "primary", name: "You" },
      setActiveMember: id => calls.push(["select", id]), setActiveFamilyGroup: id => calls.push(["select-family", id]),
      addMember: async name => { calls.push(["add", name]); return { id: "new" }; }, updateMember: async (...args) => calls.push(["rename", ...args]),
      removeMember: async id => { calls.push(["remove", id]); if (failDelete) throw new Error("Network unavailable"); },
      deleteFamilyGroup: async id => { calls.push(["delete-family", id]); if (failDelete) throw new Error("Network unavailable"); },
      leaveFamilyGroup: async id => calls.push(["leave-family", id]), restoreFamilyGroup: async id => calls.push(["restore-family", id]),
    }) },
    "@/src/api": { api: { familyJoinCode: async id => { calls.push(["code", id]); return { code: "0123456789ABCDEF" }; }, createFamilyInvitation: async (...args) => { calls.push(["invite", ...args]); return { token: "synthetic-email-invitation" }; } } },
    "@/src/family-code": { displayFamilyCode: code => code.match(/.{1,4}/g).join("-"), familyJoinUrl: code => `exp://test/--/join-family?code=${code}` },
  };
  const filename = path.resolve(__dirname, component === "care-family" ? "../app/care/family.tsx" : `../src/components/${component}.tsx`);
  const loaded = new Module(filename, module);
  loaded.require = id => mocks[id] || (id.endsWith(".svg") ? "illustration" : require(id));
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { calls, render() { cursor = 0; return component === "care-family" ? loaded.exports.default() : component === "member-selector" ? loaded.exports.MemberSelector() : component === "family-group-selector" ? loaded.exports.FamilyGroupSelector() : loaded.exports.FamilyInviteSheet({ group, onClose: () => calls.push(["close"]) }); } };
}
function nodes(n) { return !n ? [] : Array.isArray(n) ? n.flatMap(nodes) : typeof n !== "object" ? [] : [n, ...nodes(n.props?.children)]; }
const find = (tree, id) => nodes(tree).find(n => n.props?.testID === id);
const flush = () => new Promise(resolve => setImmediate(resolve));
const confirmation = tree => nodes(tree).find(n => n.type === "confirmation");

test("swiping a user cannot trigger selection or close the users sheet", () => {
  const app = harness("member-selector");
  find(app.render(), "member-selector").props.onPress();
  let tree = app.render();
  const row = find(tree, "member-swipe-other").props.children;
  row.props.onTouchStart({ nativeEvent: { pageX: 220, pageY: 300 } });
  row.props.onTouchMove({ nativeEvent: { pageX: 160, pageY: 302 } });
  find(tree, "member-other").props.onPress();
  assert.equal(find(app.render(), "member-picker-sheet").props.visible, true);
  assert.equal(app.calls.length, 0);
  find(app.render(), "member-swipe-other").props.onOpen();
  tree = app.render();
  find(tree, "member-other").props.onPress();
  assert.equal(find(app.render(), "member-picker-sheet").props.visible, true);
  find(tree, "member-swipe-other").props.onRequestDelete();
  assert.ok(confirmation(app.render()));
  assert.equal(app.calls.length, 0);
});

test("closing join/create returns to the visible family picker; dismiss-all closes it", () => {
  const app = harness("family-group-selector");
  find(app.render(), "family-group-selector").props.onPress();
  for (const button of ["family-group-create", "family-invitation-accept"]) {
    find(app.render(), button).props.onPress();
    find(app.render(), "family-group-picker-sheet").props.onClose();
    const sheet = find(app.render(), "family-group-picker-sheet");
    assert.equal(sheet.props.visible, true);
    assert.equal(sheet.props.title, "Family groups");
  }
  find(app.render(), "family-group-picker-sheet").props.onDismissAll();
  assert.equal(find(app.render(), "family-group-picker-sheet").props.visible, false);
});

test("family cards open separate forms and empty submissions stay in the form", async () => {
  const app = harness("family-group-selector");
  assert.equal(find(app.render(), "family-group-name-input"), undefined);
  assert.equal(find(app.render(), "family-invitation-token"), undefined);
  assert.equal(find(app.render(), "deleted-families-toggle"), undefined);
  find(app.render(), "family-group-create").props.onPress();
  assert.ok(find(app.render(), "family-group-name-input"));
  await find(app.render(), "family-create-submit").props.onPress();
  assert.ok(nodes(app.render()).some(n => n.props?.children === "Enter the family name"));
  nodes(app.render()).find(n => n.type === "button" && nodes(n).some(child => child.props?.children === "Cancel")).props.onPress();
  find(app.render(), "family-invitation-accept").props.onPress();
  assert.ok(find(app.render(), "family-invitation-token"));
  await find(app.render(), "family-join-submit").props.onPress();
  assert.ok(nodes(app.render()).some(n => n.props?.children === "Family code is not present"));
  assert.equal(app.calls.length, 0);
});

test("family swipe reveals an action; cancel never deletes; confirm is guarded against double taps", async () => {
  const app = harness("family-group-selector");
  find(app.render(), "family-swipe-family-test").props.onOpen();
  assert.equal(app.calls.length, 0);
  assert.equal(find(app.render(), "family-swipe-family-test").props.open, true);
  find(app.render(), "family-swipe-second").props.onOpen();
  assert.equal(find(app.render(), "family-swipe-family-test").props.open, false);
  find(app.render(), "family-swipe-second").props.onRequestDelete();
  confirmation(app.render()).props.onCancel();
  assert.equal(app.calls.length, 0);
  find(app.render(), "family-swipe-second").props.onRequestDelete();
  const prompt = confirmation(app.render());
  prompt.props.onConfirm(); prompt.props.onConfirm(); await flush();
  assert.deepEqual(app.calls, [["delete-family", "second"]]);
  assert.equal(confirmation(app.render()), undefined);
});

test("QR scan fills the join form without joining automatically", () => {
  const app = harness("family-group-selector");
  find(app.render(), "family-invitation-accept").props.onPress();
  find(app.render(), "family-scan-qr").props.onPress();
  nodes(app.render()).find(n => n.type === "scanner").props.onScan("0123456789ABCDEF");
  assert.equal(find(app.render(), "family-invitation-token").props.value, "0123456789ABCDEF");
  assert.equal(app.calls.length, 0);
  assert.equal(nodes(app.render()).find(n => n.type === "scanner"), undefined);
});

test("Care member swipe requires confirmation and protects primary and non-owner profiles", async () => {
  const app = harness("care-family");
  assert.equal(find(app.render(), "care-member-swipe-primary").props.disabled, true);
  find(app.render(), "care-member-swipe-other").props.onRequestDelete();
  assert.equal(app.calls.length, 0);
  confirmation(app.render()).props.onCancel();
  assert.equal(app.calls.length, 0);
  find(app.render(), "care-member-swipe-other").props.onRequestDelete();
  confirmation(app.render()).props.onConfirm(); await flush();
  assert.deepEqual(app.calls, [["remove", "other"]]);
  assert.equal(find(harness("care-family", { owner: false }).render(), "care-member-swipe-other").props.disabled, true);
});

test("non-owners get Leave and cannot remove profiles; primary profile is protected", async () => {
  const family = harness("family-group-selector", { owner: false });
  assert.equal(find(family.render(), "family-swipe-family-test").props.label, "Leave");
  find(family.render(), "family-swipe-family-test").props.onRequestDelete();
  confirmation(family.render()).props.onConfirm(); await flush();
  assert.deepEqual(family.calls, [["leave-family", "family-test"]]);
  const members = harness("member-selector", { owner: false });
  assert.equal(find(members.render(), "member-swipe-other").props.disabled, true);
  const own = harness("member-selector");
  assert.equal(find(own.render(), "member-swipe-primary").props.disabled, true);
});

test("profile removal needs confirmation; a failed request leaves the prompt open with an error", async () => {
  const app = harness("member-selector", { failDelete: true });
  find(app.render(), "member-options-other").props.onPress();
  assert.equal(app.calls.length, 0);
  find(app.render(), "member-swipe-other").props.onRequestDelete();
  confirmation(app.render()).props.onConfirm(); await flush();
  assert.deepEqual(app.calls, [["remove", "other"]]);
  assert.equal(confirmation(app.render()).props.error, "Network unavailable");
  confirmation(app.render()).props.onCancel();
  assert.ok(find(app.render(), "member-other"));
});

test("member sheet selection, protected primary profile and invite navigation", () => {
  const app = harness("member-selector");
  find(app.render(), "member-selector").props.onPress();
  const tree = app.render();
  assert.equal(find(tree, "member-picker-sheet").props.appearance, "family");
  assert.equal(find(tree, "member-primary").props.accessibilityState.selected, true);
  assert.equal(find(tree, "member-remove-primary"), undefined);
  find(tree, "member-other").props.onPress();
  assert.ok(app.calls.some(c => c[0] === "select" && c[1] === "other"));
  find(app.render(), "member-selector").props.onPress();
  find(app.render(), "member-invite").props.onPress();
  assert.equal(find(app.render(), "member-picker-sheet").props.visible, true);
  assert.equal(nodes(app.render()).find(n => n.type === "invite-sheet").props.group.id, "family-test");
  nodes(app.render()).find(n => n.type === "invite-sheet").props.onClose();
  assert.equal(find(app.render(), "member-picker-sheet").props.visible, true);
  find(app.render(), "member-picker-sheet").props.onDismissAll();
  assert.equal(find(app.render(), "member-picker-sheet").props.visible, false);
});
test("care-profile creation option is removed and member rows match family sizing", () => {
  const app = harness("member-selector");
  const tree = app.render();
  assert.equal(find(tree, "member-add-input"), undefined);
  assert.equal(find(tree, "member-add-profile-toggle"), undefined);
  assert.equal(find(tree, "member-primary").props.style({ pressed: false })[0].minHeight, 58);
  assert.equal(find(tree, "member-invite").props.style({ pressed: false })[0].minHeight, 46);
});
test("invite screen shows exact trust wording, permanent code, real QR link and Copy", async () => {
  const app = harness("family-invite-sheet"); app.render(); await flush();
  const tree = app.render();
  assert.ok(nodes(tree).some(n => n.props?.children === "Share this code or QR with people you trust to join this family's health records"));
  assert.equal(find(tree, "family-code-value").props.children, "0123-4567-89AB-CDEF");
  assert.equal(find(tree, "family-code-value").props.numberOfLines, 1);
  assert.equal(find(tree, "family-code-value").props.adjustsFontSizeToFit, true);
  assert.equal(nodes(tree).find(n => n.props?.children?.includes?.(find(tree, "family-code-copy"))).props.style.flexDirection, "column");
  assert.equal(nodes(tree).find(n => n.type === "qr").props.value, "exp://test/--/join-family?code=0123456789ABCDEF");
  assert.equal(find(tree, "family-invite-send").props.style[0].minHeight, 52);
  assert.equal(find(tree, "family-invite-send").props.style[0].marginHorizontal, undefined);
  assert.equal(find(tree, "family-code-ticket").props.style.padding, 12);
  await find(tree, "family-code-copy").props.onPress();
  assert.ok(app.calls.some(c => c[0] === "copy" && c[1] === "0123-4567-89AB-CDEF"));
});
test("email validation precedes invitation creation and Send opens a draft, not a fake sent status", async () => {
  const app = harness("family-invite-sheet");
  await find(app.render(), "family-invite-send").props.onPress();
  assert.equal(app.calls.some(c => c[0] === "invite"), false);
  find(app.render(), "family-invite-email").props.onChangeText("synthetic@example.com");
  await find(app.render(), "family-invite-send").props.onPress();
  assert.ok(app.calls.some(c => c[0] === "invite" && c[2] === "synthetic@example.com"));
  assert.ok(app.calls.some(c => c[0] === "email" && c[1].startsWith("mailto:")));
  assert.ok(nodes(app.render()).some(n => n.props?.children === "Your email app is open. Send the invitation there."));
});
