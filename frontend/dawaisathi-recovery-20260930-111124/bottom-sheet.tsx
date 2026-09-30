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
};

export function BottomSheet({ visible, onClose, title, description, footer, scrollable = true, children, testID }: Props) {
  const insets = useSafeAreaInsets();
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
            <Text style={styles.title}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
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
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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
      <Pressable style={styles.backdrop} onPress={onClose} testID={testID ? `${testID}-backdrop` : undefined} />
      <Animated.View style={[styles.sheet, animated]} testID={testID}>
        <View style={[styles.sheetInner, { paddingTop: 10 }]}>{containerBody}</View>
      </Animated.View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(15,23,20,0.45)",
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: "92%",
    },
    sheetInner: {
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
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 4,
      backgroundColor: colors.borderStrong,
      marginBottom: 12,
    },
    headerRow: {
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
    footer: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      gap: 10,
    },
    pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  }),
);
