import { Ionicons } from "@expo/vector-icons";
import * as haptics from "@/src/utils/haptics";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import PressableScale from "./ui/PressableScale";
import { useReduceMotion } from "./ui/useReduceMotion";

export function FamilyReminderButton({ onSend }: { onSend: () => Promise<void> }) {
  const reduced = useReduceMotion();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const locked = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rotation] = useState(() => new Animated.Value(0));
  const [success] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      rotation.stopAnimation(); success.stopAnimation(); pop.stopAnimation();
    };
  }, [rotation, success, pop]);
  useEffect(() => {
    if (reduced) {
      rotation.stopAnimation(); rotation.setValue(0);
      pop.stopAnimation(); pop.setValue(1);
      success.stopAnimation(); success.setValue(state === "sent" ? 1 : 0);
    }
  }, [reduced, state, rotation, pop, success]);
  const send = async () => {
    if (locked.current) return;
    locked.current = true;
    setState("sending");
    haptics.press();
    // Start delivery immediately; the bell animation never delays the request.
    const delivery = Promise.resolve().then(onSend).then(() => true, () => false);
    const ringing = reduced ? Promise.resolve() : new Promise<void>(resolve => {
      Animated.sequence([-18, 16, -12, 9, -4, 0].map(toValue =>
        Animated.timing(rotation, { toValue, duration: 100, useNativeDriver: true })
      )).start(() => resolve());
    });
    const [sent] = await Promise.all([delivery, ringing]);
    if (!mounted.current) return;
    if (!sent) {
      setState("error"); locked.current = false; haptics.error();
      AccessibilityInfo.announceForAccessibility("Couldn't send. Tap to try again");
      return;
    }
    setState("sent"); haptics.success();
    AccessibilityInfo.announceForAccessibility("Reminder sent");
    if (reduced) { success.setValue(1); pop.setValue(1); }
    else {
      Animated.timing(success, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      pop.setValue(0.4);
      Animated.sequence([
        Animated.spring(pop, { toValue: 1.18, speed: 80, bounciness: 0, overshootClamping: true, restDisplacementThreshold: 0.03, restSpeedThreshold: 0.3, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, speed: 100, bounciness: 0, overshootClamping: true, restDisplacementThreshold: 0.03, restSpeedThreshold: 0.3, useNativeDriver: true }),
      ]).start();
    }
    timer.current = setTimeout(() => {
      if (!mounted.current) return;
      setState("idle"); locked.current = false;
      if (reduced) success.setValue(0);
      else Animated.timing(success, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }, 3000);
  };
  return <PressableScale scaleTo={0.97} disabled={state === "sending" || state === "sent"}
    accessibilityRole="button" accessibilityLabel="Remind family to take medicines"
    accessibilityState={{ disabled: state === "sending" || state === "sent", busy: state === "sending" }}
    testID="care-family-reminder" onPress={() => { void send(); }} style={styles.button}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.successBackground, { opacity: success }]} />
    {state === "sent" ? <Animated.View style={[styles.check, { transform: [{ scale: pop }] }]}>
      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
    </Animated.View> : <View style={styles.bellSlot}>
      <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [-18, 18], outputRange: ["-18deg", "18deg"] }) }] }}>
        {/* The offset places the rotation origin at the bell's top. */}
        <View style={styles.bellOffset}><Ionicons name="notifications-outline" size={24} color="#A94B54" /></View>
      </Animated.View>
    </View>}
    <Text style={[styles.label, state === "sent" && styles.sentLabel]}>
      {state === "sent" ? "Reminder sent" : state === "error" ? "Couldn't send. Tap to try again" : "Remind all to take Medicines"}
    </Text>
  </PressableScale>;
}

const styles = StyleSheet.create({
  button: { width: "100%", height: 56, borderRadius: 16, backgroundColor: "#FFF2F2", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 8 },
  successBackground: { borderRadius: 16, backgroundColor: "#E1F5EE" },
  label: { fontSize: 16, fontWeight: "500", color: "#A94B54", flexShrink: 1, textAlign: "center" },
  sentLabel: { color: "#085041" },
  check: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#0F6E56", alignItems: "center", justifyContent: "center" },
  bellSlot: { width: 28, height: 28, alignItems: "center", justifyContent: "flex-start" },
  bellOffset: { position: "absolute", top: 0, left: -12, width: 24, height: 24 },
});
