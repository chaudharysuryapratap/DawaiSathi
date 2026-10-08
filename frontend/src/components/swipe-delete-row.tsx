import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { makeStyles } from "@/src/theme";

type Props = {
  children: ReactNode;
  open: boolean;
  disabled?: boolean;
  label?: string;
  testID: string;
  onOpen: () => void;
  onClose: () => void;
  onRequestDelete: () => void;
};

// Each modal row gets its own gesture root so swipes work inside Android Modal.
export function SwipeDeleteRow({ children, open, disabled, label = "Delete", testID, onOpen, onClose, onRequestDelete }: Props) {
  const styles = useStyles();
  const swipe = useRef<SwipeableMethods>(null);
  useEffect(() => {
    if (open && !disabled) swipe.current?.openRight();
    else swipe.current?.close();
  }, [open, disabled]);
  return <GestureHandlerRootView unstable_forceActive style={{ flex: 0 }}>
    <Swipeable
      ref={swipe}
      testID={testID}
      enabled={!disabled}
      friction={2}
      rightThreshold={36}
      dragOffsetFromRightEdge={8}
      overshootRight={false}
      overshootLeft={false}
      onSwipeableWillOpen={onOpen}
      onSwipeableClose={onClose}
      containerStyle={styles.container}
      renderRightActions={() => <Pressable
        testID={`${testID}-delete`}
        accessibilityRole="button"
        accessibilityLabel={label}
        aria-hidden={!open}
        focusable={open && !disabled}
        disabled={disabled || !open}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "yes" : "no-hide-descendants"}
        onPress={() => { swipe.current?.close(); onRequestDelete(); }}
        style={styles.action}
      ><Ionicons name={label === "Leave" ? "exit-outline" : "trash-outline"} size={22} color="#FFFFFF" /><Text style={styles.label}>{label}</Text></Pressable>}
    >{children}</Swipeable>
  </GestureHandlerRootView>;
}

const useStyles = makeStyles(colors => StyleSheet.create({
  container: { borderRadius: 20, overflow: "hidden" },
  action: { width: 82, minHeight: 48, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", gap: 4 },
  label: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
}));
