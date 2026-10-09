import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Text } from "react-native";
import { useReduceMotion } from "./ui/useReduceMotion";
export function SettingsSuccess({ text }: {
    text: string;
}) {
    const reduced = useReduceMotion();
    const [scale] = useState(() => new Animated.Value(1));
    useEffect(() => {
        AccessibilityInfo.announceForAccessibility(text);
        if (reduced)
            scale.setValue(1);
        else {
            scale.setValue(0.4);
            Animated.spring(scale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }).start();
        }
        return () => scale.stopAnimation();
    }, [reduced, scale, text]);
    return <><Animated.View style={{ alignSelf: "center", borderRadius: 28, backgroundColor: "#0F6E56", padding: 12, transform: [{ scale }] }}><Ionicons name="checkmark" size={32} color="white"/></Animated.View><Text style={{ fontSize: 20, textAlign: "center", color: "#085041" }}>{text}</Text></>;
}
