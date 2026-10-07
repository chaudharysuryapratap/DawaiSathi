import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import {
  Modal,
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

import { makeStyles, useTheme } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  scrollable?: boolean;
  children: React.ReactNode;
  testID?: string;
  appearance?: "default" | "family";
  headerAccessory?: React.ReactNode;
};

export function BottomSheet({ visible, onClose, title, description, footer, scrollable = true, children, testID, appearance = "default", headerAccessory }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxSheetHeight = Math.min(height * 0.92, height - insets.top);
  const styles = useStyles();
  const { colors } = useTheme();
  const translate = useSharedValue(400);
  useEffect(() => {
    translate.value = withTiming(visible ? 0 : 400, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, translate]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: translate.value }] }));

  const containerBody = (
    <>
      <View style={styles.handle} />
      {title ? (
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            {headerAccessory ? <View style={{ marginBottom: 16 }}>{headerAccessory}</View> : null}
            <Text accessibilityRole="header" style={[styles.title, appearance === "family" && styles.familyTitle]}>{title}</Text>
            {description ? <Text style={[styles.description, appearance === "family" && styles.familyDescription]}>{description}</Text> : null}
          </View>
          <Pressable
            testID="sheet-close-button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </Pressable>
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
      visible={visible}
      transparent
      animationType={Platform.OS === "web" ? "fade" : "none"}
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        <Animated.View style={[styles.sheet, { maxHeight: maxSheetHeight }, animated]} testID={testID}>
          <View style={[styles.sheetInner, appearance === "family" && styles.familySheet, { paddingTop: 10, maxHeight: maxSheetHeight }]}>{containerBody}</View>
        </Animated.View>
      </View>
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
