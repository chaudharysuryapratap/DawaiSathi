import { Ionicons } from "@expo/vector-icons";
import { success, warning } from "@/src/utils/haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import PressableScale from "./ui/PressableScale";
import { useReduceMotion } from "./ui/useReduceMotion";
import { useTheme } from "@/src/theme";

export function doseTakenTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function TodayDoseAction({
  loggedAt,
  disabled,
  onToggle,
  testID,
}: {
  loggedAt: string | null;
  disabled: boolean;
  onToggle: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  const reduced = useReduceMotion();
  const taken = Boolean(loggedAt);
  const [scale] = useState(() => new Animated.Value(1));
  const intent = useRef<boolean | null>(null);
  useEffect(() => {
    scale.stopAnimation();
    if (reduced) {
      scale.setValue(1);
      intent.current = null;
      return;
    }
    if (intent.current === taken) {
      scale.setValue(taken ? 0 : 0.85);
      if (taken)
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 180,
          useNativeDriver: true,
        }).start();
      else
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      intent.current = null;
    }
  }, [taken, reduced, scale]);
  useEffect(() => () => scale.stopAnimation(), [scale]);
  return (
    <View style={{ width: 108, alignItems: "center" }}>
      <Animated.View
        style={{
          transform: [{ scale }],
          alignSelf: taken ? "center" : "stretch",
        }}
      >
        <PressableScale
          haptic={false}
          scaleTo={taken ? 0.88 : 0.94}
          testID={testID}
          accessibilityLabel={
            taken
              ? `Taken at ${doseTakenTime(loggedAt!)}. Tap to undo`
              : "Mark as taken"
          }
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={(event) => {
            event.stopPropagation();
            intent.current = !taken;
            onToggle();
            if (taken) warning();
            else success();
          }}
          style={
            taken
              ? {
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.brandPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                }
              : {
                  width: 108,
                  minHeight: 48,
                  paddingVertical: 10,
                  paddingHorizontal: 6,
                  borderRadius: 12,
                  backgroundColor: colors.brandPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                }
          }
        >
          {taken ? (
            <Ionicons name="checkmark" size={26} color="#FFFFFF" />
          ) : (
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: "500",
                textAlign: "center",
                flexShrink: 1,
              }}
            >
              Mark as taken
            </Text>
          )}
        </PressableScale>
      </Animated.View>
    </View>
  );
}
