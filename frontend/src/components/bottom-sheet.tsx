import PressableScale from "@/src/components/ui/PressableScale";
/* React Compiler cannot model PanResponder callbacks or Reanimated's mutable shared values.
 * Ref access is confined to event handlers/effects; presented intentionally retains exit frames. */
/* eslint-disable react-hooks/refs, react-hooks/immutability, react-hooks/set-state-in-effect */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { makeStyles, useTheme } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onDismissAll?: () => void;
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  scrollable?: boolean;
  children: React.ReactNode;
  testID?: string;
  appearance?: "default" | "family";
  headerAccessory?: React.ReactNode;
  singleLineTitle?: boolean;
};

const openSheets = new Map<symbol, () => void>();

export function BottomSheet({ visible, onClose, onDismissAll, title, description, footer, scrollable = true, children, testID, appearance = "default", headerAccessory, singleLineTitle = false }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", event => setKeyboardTop(event.endCoordinates.screenY));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardTop(null));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const availableHeight = Math.min(height, keyboardTop ?? height);
  const maxSheetHeight = Math.max(120, Math.min(availableHeight * 0.92, availableHeight - insets.top));
  const styles = useStyles();
  const { colors } = useTheme();
  const translate = useSharedValue(400);
  const identity = useRef(Symbol("sheet"));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [presented, setPresented] = useState(visible);
  const [closeRevision, setCloseRevision] = useState(0);
  const dismiss = (all = false) => {
    Keyboard.dismiss();
    translate.value = withTiming(height, { duration: 220, easing: Easing.in(Easing.cubic) });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      (all ? onDismissAll ?? onClose : onClose)();
      // A close can pop an internal page while keeping this same Modal visible.
      // Restore its position even when `visible` has not changed.
      setCloseRevision(value => value + 1);
    }, 220);
  };
  useEffect(() => {
    const id = identity.current;
    if (visible) openSheets.set(id, () => dismiss(true));
    return () => { openSheets.delete(id); };
  });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const gesture = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => { translate.value = Math.max(0, gesture.dy); },
    onPanResponderRelease: (_, gesture) => { if (gesture.dy > 70 || gesture.vy > 0.7) dismiss(); else translate.value = withTiming(0, { duration: 180 }); },
    onPanResponderTerminate: () => { translate.value = withTiming(0, { duration: 180 }); },
  });
  useEffect(() => {
    if (visible) setPresented(true);
    else {
      const timeout = setTimeout(() => setPresented(false), 260);
      return () => clearTimeout(timeout);
    }
  }, [visible]);
  useEffect(() => {
    translate.value = withTiming(visible ? 0 : height, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, translate, height, closeRevision]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: translate.value }] }));

  const containerBody = (
    <>
      <View {...gesture.panHandlers} testID="sheet-drag-area" style={{ marginHorizontal: -20, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, minHeight: 38 }} accessibilityLabel="Drag down to close"><View style={styles.handle} /></View>
      {title ? (
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            {headerAccessory ? <View style={{ marginBottom: 16 }}>{headerAccessory}</View> : null}
            <Text accessibilityRole="header" numberOfLines={singleLineTitle ? 1 : undefined} adjustsFontSizeToFit={singleLineTitle} minimumFontScale={0.65} style={[styles.title, appearance === "family" && styles.familyTitle, singleLineTitle && { fontSize: 22, letterSpacing: -0.5 }]}>{title}</Text>
            {description ? <Text style={[styles.description, appearance === "family" && styles.familyDescription]}>{description}</Text> : null}
          </View>
          <PressableScale scaleTo={0.88} hitSlop={14}
            testID="sheet-close-button"
            accessibilityLabel="Close"
            onPress={() => dismiss()}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </PressableScale>
        </View>
      ) : null}
      {scrollable ? (
        <ScrollView style={styles.scrollBody} contentContainerStyle={[styles.body, !footer && { paddingBottom: 16 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>{footer}</View> : null}
    </>
  );

  return (
    <Modal
      visible={presented}
      transparent
      animationType={Platform.OS === "web" ? "fade" : "none"}
      onRequestClose={() => dismiss()}
    >
      <GestureHandlerRootView unstable_forceActive style={styles.modalRoot}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={() => { for (const close of openSheets.values()) close(); }}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        <Animated.View style={[styles.sheet, { maxHeight: "92%" }, animated]} testID={testID}>
          <View style={[styles.sheetInner, appearance === "family" && styles.familySheet, { paddingTop: 10, maxHeight: maxSheetHeight }]}>{containerBody}</View>
        </Animated.View>
      </View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    modalRoot: { flex: 1 },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(15,23,20,0.45)",
      zIndex: 0,
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: "92%",
      zIndex: 1,
      elevation: 1,
    },
    sheetInner: {
      flexShrink: 1,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
      elevation: 12,
    },
    handle: {
      flexShrink: 0,
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 4,
      backgroundColor: colors.borderStrong,
      marginBottom: 12,
    },
    headerRow: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 14,
    },
    title: {
      color: colors.onSurface,
      fontSize: 20,
      fontWeight: "800",
    },
    familySheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 30, borderTopRightRadius: 30 },
    familyTitle: { color: "#090D15", fontSize: 28, letterSpacing: -0.7 },
    familyDescription: { color: "#737B8B", fontSize: 14, lineHeight: 21, marginTop: 7 },
    description: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 4,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      paddingBottom: 16,
      gap: 14,
    },
    scrollBody: { flexShrink: 1, minHeight: 0 },
    footer: {
      flexShrink: 0,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      gap: 10,
    },
    pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  }),
);
