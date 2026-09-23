import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export function ScreenShell({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  return (
    <View style={styles.root} testID={testID}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 28 + bottomChrome }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
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

export function PrimaryButton({ label, onPress, icon = "add", testID }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; testID?: string }) {
  const styles = useStyles();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={19} color={styles.primaryText.color} />
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function LoadingState({ label = "Loading your schedule" }: { label?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return <View style={styles.centerState}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.stateText}>{label}</Text></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.stateCard}>
      <Ionicons name="cloud-offline-outline" size={26} color={styles.errorText.color} />
      <Text style={styles.stateTitle}>Couldn’t load DawaiSathi</Text>
      <Text style={styles.stateText}>{message}</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryText}>Try again</Text></Pressable>
    </View>
  );
}

export function EmptyState({ onPress }: { onPress: () => void }) {
  const router = useRouter();
  const styles = useStyles();
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}><Ionicons name="medical-outline" size={30} color={styles.emptyIconText.color} /></View>
      <Text style={styles.stateTitle}>No medicines yet</Text>
      <Text style={styles.stateText}>Add your first medicine and we’ll keep today’s doses easy to follow.</Text>
      <PrimaryButton label="Add your first medicine" onPress={onPress ?? (() => router.push("/add-medicine"))} />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 20, gap: 20 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: colors.onSurface, fontSize: 31, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  primaryButton: { minHeight: 48, paddingHorizontal: 17, borderRadius: 14, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "700" },
  secondaryButton: { minHeight: 44, borderRadius: 12, paddingHorizontal: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  centerState: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 12 },
  stateCard: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", padding: 24, gap: 10 },
  emptyCard: { borderRadius: 22, backgroundColor: colors.surfaceSecondary, padding: 26, alignItems: "center", gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary, marginBottom: 4 },
  emptyIconText: { color: colors.brandPrimary },
  stateTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "750", textAlign: "center" },
  stateText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  errorText: { color: colors.error },
}));