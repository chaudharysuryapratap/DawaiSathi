import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth-context";
import { useData } from "@/src/data-context";
import { api } from "@/src/api";
import { scheduleFamilySetupReminder } from "@/src/utils/family-setup-reminder";
import * as haptics from "@/src/utils/haptics";
import PressableScale from "./ui/PressableScale";
import { FamilyGroupSelector } from "./family-group-selector";

const teal = "#0F6E56", tint = "#E1F5EE", secondary = "#5A6672";
const timing = (value: Animated.Value, toValue: number, duration: number, delay = 0) => Animated.timing(value, { toValue, duration, delay, useNativeDriver: true });

/** Server membership is the durable completion marker, not device-local storage. */
export function FamilyOnboarding({ children }: { children: React.ReactNode }) {
  const data = useData();
  const { user } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [motionReduced, setMotionReduced] = useState(true);
  const creating = useRef(false);
  const dismiss = () => { if (creating.current) return; Keyboard.dismiss(); setVisible(false); };
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => setForeground(state === "active"));
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setMotionReduced(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setMotionReduced);
    return () => { live = false; listener.remove(); motion.remove(); };
  }, []);
  useEffect(() => {
    if (!data.loading && !data.error && !initialized) {
      setInitialized(true); setVisible(data.familyGroups.length === 0);
    }
  }, [data.loading, data.error, data.familyGroups.length, initialized]);
  useEffect(() => {
    if (!initialized || visible || !foreground || data.loading || data.error || data.familyGroups.length) return;
    // Only one reminder timer exists, and it stops as soon as membership changes.
    return scheduleFamilySetupReminder(async () => {
      const groups = await api.familyGroups();
      if (groups.length) { void data.refresh(); return false; }
      return true;
    }, () => setVisible(true));
  }, [initialized, visible, foreground, data.loading, data.error, data.familyGroups.length, data.refresh]);
  return <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} accessibilityElementsHidden={visible} importantForAccessibility={visible ? "no-hide-descendants" : "auto"}>{children}</View>
    {!initialized && <View style={[StyleSheet.absoluteFill, styles.root, styles.center]}>
      {data.error ? <><Text style={styles.helper}>Couldn't load your family. Please try again.</Text><PressableScale onPress={() => void data.refresh()} style={styles.primary}><Text style={styles.primaryText}>Try again</Text></PressableScale></> : <ActivityIndicator color={teal} accessibilityLabel="Loading your family" />}
    </View>}
    <Modal visible={visible} transparent animationType={motionReduced ? "fade" : "slide"} onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.modal}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close family setup" style={StyleSheet.absoluteFill} onPress={dismiss} />
        <View style={styles.modalSheet} accessibilityViewIsModal>
          <Setup key={user?.id} onDone={dismiss} onDismiss={dismiss} onBusyChange={value => { creating.current = value; }} />
        </View>
      </View>
    </Modal>
  </View>;
}

function Setup({ onDone, onDismiss, onBusyChange }: { onDone: () => void; onDismiss: () => void; onBusyChange: (busy: boolean) => void }) {
  const { user } = useAuth(), data = useData(), router = useRouter();
  const insets = useSafeAreaInsets(), { fontScale } = useWindowDimensions();
  const [name, setName] = useState(`${user?.name.trim().split(/\s+/)[0] || "My"}'s Family`);
  const [ready, setReady] = useState(false), [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false), [invalid, setInvalid] = useState(false), [failure, setFailure] = useState(false);
  const lock = useRef(false), created = useRef(false), announced = useRef(false), input = useRef<TextInput>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const hero = useRef(new Animated.Value(0.4)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const sections = useRef([0, 0, 0, 0].map(() => new Animated.Value(0))).current;
  const art = useRef(new Animated.Value(0)).current, keyboardFade = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current, tick = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current, stars = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current, focus = useRef(new Animated.Value(0)).current;
  const arrow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v => { if (live) setReduced(v); }).catch(() => { if (live) setReduced(true); });
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { live = false; motion.remove(); };
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => timing(keyboardFade, 0, reduced ? 0 : 150).start());
    const hide = Keyboard.addListener("keyboardDidHide", () => timing(keyboardFade, 1, reduced ? 0 : 150).start());
    return () => { show.remove(); hide.remove(); };
  }, [keyboardFade, reduced]);
  useEffect(() => {
    if (reduced === null) return;
    fade.setValue(0); hero.setValue(reduced ? 1 : 0.4);
    sections.forEach(v => v.setValue(reduced ? 1 : 0)); art.setValue(reduced ? 1 : 0);
    ring.setValue(0); tick.setValue(reduced ? 1 : 0); burst.setValue(reduced ? 1 : 0); stars.setValue(reduced ? 1 : 0);
    const animation = reduced ? timing(fade, 1, 100) : Animated.parallel([
      timing(fade, 1, 150),
      Animated.sequence([Animated.spring(hero, { toValue: 1.12, friction: 7, tension: 180, useNativeDriver: true }), timing(hero, 1, 100)]),
      ...sections.map((v, i) => timing(v, 1, 340, ready ? [380, 440, 520, 520][i] : [120, 180, 240, 300][i])),
      timing(art, 1, 420, 360),
      ...(ready ? [timing(ring, 1, 700, 150), timing(tick, 1, 300, 260), timing(burst, 1, 520, 280), Animated.sequence([Animated.delay(420), timing(stars, 1.2, 300), timing(stars, 1, 300)])] : []),
    ]);
    animation.start();
    if (ready && !announced.current) { announced.current = true; haptics.success(); AccessibilityInfo.announceForAccessibility("Your family is ready"); }
    return () => animation.stop();
  }, [ready, reduced, fade, hero, sections, art, ring, tick, burst, stars]);
  useEffect(() => {
    if (joining && data.familyGroups.length && !created.current) { onDone(); router.replace("/"); }
  }, [joining, data.familyGroups.length, onDone, router]);

  const create = async () => {
    if (lock.current) return;
    const value = name.trim();
    if (!value) {
      setInvalid(true); haptics.error(); input.current?.focus();
      if (!reduced) Animated.sequence([0, -7, 7, -5, 5, 0].map(x => timing(shake, x, 43))).start();
      return;
    }
    lock.current = true; onBusyChange(true); setBusy(true); setFailure(false); haptics.press(); Keyboard.dismiss();
    try {
      const family = await data.createFamilyGroup(value);
      created.current = true; setName(family.name); setReady(true);
    } catch { setFailure(true); haptics.error(); }
    finally { lock.current = false; onBusyChange(false); setBusy(false); }
  };
  const finish = (members: boolean) => {
    haptics.press(); onDone();
    router.replace(members ? { pathname: "/care/family-management", params: { section: "members" } } : "/");
  };
  const reveal = (i: number) => ({ opacity: sections[i], transform: [{ translateY: sections[i].interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 14, 0] }) }] });
  const shiftArrow = (pressed: boolean) => { if (!reduced) timing(arrow, pressed ? 4 : 0, 120).start(); };
  const drag = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !busy && gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => { if (!busy && (gesture.dy > 60 || gesture.vy > 0.7)) onDismiss(); },
  });
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={styles.sheetHeader} {...drag.panHandlers}>
      <View style={styles.handle} />
      <PressableScale scaleTo={0.88} haptic={false} accessibilityLabel="Close family setup" disabled={busy} onPress={onDismiss} style={styles.close}><MaterialCommunityIcons name="close" size={23} color={secondary} /></PressableScale>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom }]}>
      <Animated.View style={[styles.sheet, { opacity: fade }]}>
        <View style={[styles.heroArea, ready && { marginTop: 45 }]}>
          <View style={styles.blob} />
          {!ready && <><View style={styles.orbit} /><View style={[styles.dot, { left: 54, top: 20 }]} /><View style={[styles.dot, { right: 35, bottom: 38 }]} /></>}
          {ready && <Animated.View style={[styles.ring, { opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : 1.7] }) }] }]} />}
          <Animated.View style={[styles.heroCircle, ready && { backgroundColor: teal }, { transform: [{ scale: hero }] }]}>
            {ready ? <Animated.View style={{ opacity: tick }}><MaterialCommunityIcons name="check" size={65} color="white" /></Animated.View> : <MaterialCommunityIcons name="account-group-outline" size={76} color={teal} />}
          </Animated.View>
          {ready && Array.from({ length: 6 }, (_, i) => <Animated.View key={i} style={[styles.dash, { opacity: burst, transform: [{ rotate: `${i * 60}deg` }, { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [reduced ? -86 : -62, -86] }) }] }]} />)}
          {ready && [0, 1].map(i => <Animated.View key={i} style={{ position: "absolute", left: i ? 240 : 35, top: i ? 140 : 15, transform: [{ scale: stars }] }}><MaterialCommunityIcons name="star-four-points" size={22} color="#A8DFCF" /></Animated.View>)}
        </View>
        <Animated.Text accessibilityRole="header" style={[styles.headline, reveal(0)]}>{ready ? <>Your family is <Text style={styles.accent}>ready</Text></> : <>Welcome to <Text style={styles.accent}>DawaiSathi</Text></>}</Animated.Text>
        <Animated.Text style={[styles.subtext, reveal(1)]}>{ready ? `“${name}” is set up. Next, add the people you look after.` : "Let’s create your family. Everyone’s medicines and reminders will be in one place."}</Animated.Text>
        {!ready && <Animated.View style={[styles.form, reveal(2), { transform: [{ translateX: shake }] }]}>
          <Text style={styles.label}>Family name</Text>
          <Animated.View style={[styles.inputRow, { borderColor: invalid ? "#B3261E" : focus.interpolate({ inputRange: [0, 1], outputRange: ["#A3D7CD", teal] }) }]}>
            <MaterialCommunityIcons name="home-outline" size={26} color={teal} />
            <TextInput ref={input} accessibilityLabel="Family name" value={name} maxLength={60} selectTextOnFocus editable={!busy} onChangeText={v => { setName(v); setInvalid(false); }} onFocus={() => Animated.timing(focus, { toValue: 1, duration: reduced ? 0 : 150, useNativeDriver: false }).start()} onBlur={() => Animated.timing(focus, { toValue: 0, duration: reduced ? 0 : 150, useNativeDriver: false }).start()} style={styles.input} />
            {!!name && <PressableScale haptic={false} scaleTo={0.88} disabled={busy} accessibilityLabel="Clear family name" onPress={() => { setName(""); input.current?.focus(); }} style={styles.clear}><MaterialCommunityIcons name="close-circle" size={24} color={secondary} /></PressableScale>}
          </Animated.View>
          <Text accessibilityLiveRegion="polite" style={[styles.helper, invalid && { color: "#B3261E" }]}>{invalid ? "Please type a family name." : "You can change this later."}</Text>
        </Animated.View>}
        <Animated.View style={[styles.buttons, ready && { marginTop: 66 }, reveal(3)]}>
          {failure && <Text accessibilityRole="alert" style={styles.failure}>Couldn't create your family. Please try again.</Text>}
          <PressableScale haptic={false} scaleTo={0.97} disabled={busy} accessibilityLabel={ready ? "Add family members" : "Create my family"} onPressIn={() => shiftArrow(true)} onPressOut={() => shiftArrow(false)} onPress={ready ? () => finish(true) : () => void create()} style={styles.primary}>
            {busy && <ActivityIndicator color="white" />}<Text style={styles.primaryText}>{ready ? "Add family members" : busy ? "Creating..." : "Create my family"}</Text>
            {!busy && <Animated.View style={{ transform: [{ translateX: arrow }] }}><MaterialCommunityIcons name="arrow-right" size={25} color="white" /></Animated.View>}
          </PressableScale>
          <PressableScale haptic={false} scaleTo={0.97} disabled={busy} onPress={() => { if (ready) finish(false); else { haptics.press(); setJoining(true); } }} style={styles.outline}><Text style={styles.secondaryText}>{ready ? "I’ll do this later" : "I have an invite code"}</Text></PressableScale>
        </Animated.View>
        {fontScale <= 1.3 && <Animated.View pointerEvents="none" style={{ marginTop: "auto", paddingTop: 32, marginHorizontal: -24, opacity: Animated.multiply(art, keyboardFade), transform: [{ translateY: art.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 26, 0] }) }] }}>
          <Image source={ready ? require("../../assets/images/onboarding-leaves.svg") : require("../../assets/images/onboarding-family.png")} style={{ width: "100%", aspectRatio: ready ? 400 / 140 : 2 }} contentFit="cover" accessible={false} />
        </Animated.View>}
      </Animated.View>
    </ScrollView>
    {joining && <FamilyGroupSelector joinOnly onJoinClose={() => setJoining(false)} />}
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" }, center: { justifyContent: "center", alignItems: "center", gap: 16 },
  modal: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }, modalSheet: { height: "94%", width: "100%", maxWidth: 560, alignSelf: "center", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", backgroundColor: "white" },
  sheetHeader: { minHeight: 48, alignItems: "center", justifyContent: "center" }, handle: { width: 42, height: 5, backgroundColor: "#B9C9C5", borderRadius: 3 }, close: { position: "absolute", right: 12, top: 4, width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  scroll: { flexGrow: 1 }, sheet: { flexGrow: 1, width: "100%", backgroundColor: "white", paddingTop: 12, paddingHorizontal: 24, overflow: "hidden" },
  heroArea: { width: 280, height: 175, alignSelf: "center", alignItems: "center", justifyContent: "center", marginBottom: 20 }, blob: { position: "absolute", width: 240, height: 105, borderRadius: 70, backgroundColor: "#F0FAF7", transform: [{ rotate: "-25deg" }] },
  heroCircle: { width: 122, height: 122, borderRadius: 61, backgroundColor: tint, alignItems: "center", justifyContent: "center" }, ring: { position: "absolute", width: 142, height: 142, borderRadius: 71, backgroundColor: teal }, orbit: { position: "absolute", width: 210, height: 108, borderWidth: 1, borderColor: "#BDE7DD", borderRadius: 110, transform: [{ rotate: "32deg" }] }, dot: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: "#4ABDB0" }, dash: { position: "absolute", width: 5, height: 17, backgroundColor: teal, borderRadius: 4 },
  headline: { fontSize: 29, fontWeight: "800", color: "#08141F", textAlign: "center" }, accent: { color: teal }, subtext: { fontSize: 17, color: secondary, textAlign: "center", marginTop: 16 },
  form: { marginTop: 26, gap: 8 }, label: { fontSize: 16, color: "#08141F", fontWeight: "600" }, inputRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingLeft: 13, borderRadius: 14, borderWidth: 1, backgroundColor: "#F7FCFA" }, input: { flex: 1, minWidth: 0, fontSize: 18, color: "#08141F", paddingVertical: 14 }, clear: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, helper: { fontSize: 14, color: secondary },
  buttons: { gap: 12, marginTop: 24 }, primary: { minHeight: 56, borderRadius: 14, backgroundColor: teal, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, primaryText: { color: "white", fontSize: 17, fontWeight: "600", textAlign: "center", flexShrink: 1 }, outline: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: teal, padding: 14, alignItems: "center", justifyContent: "center" }, secondaryText: { color: teal, fontSize: 17, fontWeight: "600", textAlign: "center" }, failure: { color: "#B3261E", fontSize: 15 },
});
