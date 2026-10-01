import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "@/src/theme";

export function ScreenShell({
  children,
  testID,
  header,
  scroll = true,
}: {
  children: React.ReactNode;
  testID?: string;
  header?: React.ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <View style={styles.root} testID={testID}>
      {header ? <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: header ? 8 : insets.top + 18, paddingBottom: 96 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { paddingTop: header ? 8 : insets.top + 18, flex: 1 }]}>{children}</View>
      )}
    </View>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  testID,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles = useStyles();
  const styleForVariant = variant === "secondary" ? styles.secondaryButton : variant === "danger" ? styles.dangerButton : styles.primaryButton;
  const textStyle = variant === "secondary" ? styles.secondaryText : variant === "danger" ? styles.dangerText : styles.primaryText;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styleForVariant, disabled && styles.disabled, pressed && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={18} color={textStyle.color} /> : null}
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export function LoadingState({ label = "Loading DawaiSathi" }: { label?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.centerState}>
      <ActivityIndicator color={colors.brandPrimary} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  title = "We couldn’t reach DawaiSathi",
  icon = "cloud-offline-outline",
  message,
  onRetry,
}: {
  title?: string;
  icon?: "cloud-offline-outline" | "alert-circle-outline";
  message: string;
  onRetry: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.stateCard}>
      <Ionicons name={icon} size={26} color={styles.errorText.color} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function EmptyMedicineState({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  const styles = useStyles();
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name="medical-outline" size={28} color={styles.emptyIconText.color} />
      </View>
      <Text style={styles.stateTitle}>No medicines yet</Text>
      <Text style={styles.stateText}>
        Add your first medicine and we’ll gently guide today’s doses.
      </Text>
      <PrimaryButton
        label="Add your first medicine"
        icon="add"
        onPress={onPress ?? (() => router.push("/add-medicine"))}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    headerWrap: { paddingHorizontal: 20, paddingBottom: 6, backgroundColor: colors.surface },
    content: { paddingHorizontal: 20, gap: 20 },
    header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    headerCopy: { flex: 1, gap: 4 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    primaryButton: {
      minHeight: 50,
      paddingHorizontal: 18,
      borderRadius: 16,
      backgroundColor: colors.brandPrimary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "700" },
    secondaryButton: {
      minHeight: 48,
      paddingHorizontal: 18,
      borderRadius: 14,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    secondaryText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
    dangerButton: {
      minHeight: 48,
      paddingHorizontal: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.error,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      backgroundColor: colors.surface,
    },
    dangerText: { color: colors.error, fontSize: 14, fontWeight: "700" },
    pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
    disabled: { opacity: 0.6 },
    centerState: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 12 },
    stateCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
      alignItems: "center",
      padding: 24,
      gap: 10,
    },
    emptyCard: {
      borderRadius: 22,
      backgroundColor: colors.surfaceSecondary,
      padding: 28,
      alignItems: "center",
      gap: 14,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
      marginBottom: 4,
    },
    emptyIconText: { color: colors.brandPrimary },
    stateTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700", textAlign: "center" },
    stateText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
    errorText: { color: colors.error },
  }),
);
