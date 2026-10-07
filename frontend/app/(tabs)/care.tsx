import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/src/components/app-header";
import { ErrorState, LoadingState, ScreenShell } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

type CareAction = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  accessibilityHint: string;
  testID: string;
  onPress: () => void;
};

function CareActionCard({ icon, title, detail, accessibilityHint, testID, onPress }: CareAction) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityHint={accessibilityHint}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={28} color={colors.brandPrimary} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={colors.muted} />
    </Pressable>
  );
}

export default function CareScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { loading, error, refresh } = useData();

  const actions: CareAction[] = [
    {
      icon: "medical-outline",
      title: "Medicines",
      detail: "Add, edit, or refill medicines",
      accessibilityHint: "Opens your medicine list and editing tools",
      testID: "care-medicines",
      onPress: () => router.push("/care/medicines"),
    },
    {
      icon: "calendar-outline",
      title: "Appointments",
      detail: "View or add doctor appointments",
      accessibilityHint: "Opens your appointments and calendar",
      testID: "care-appointments",
      onPress: () => router.push("/care/calendar"),
    },
    {
      icon: "document-text-outline",
      title: "Prescriptions",
      detail: "View, upload, or scan prescriptions",
      accessibilityHint: "Opens your saved prescriptions and prescription actions",
      testID: "care-prescriptions",
      onPress: () => router.push("/care/prescription"),
    },
    {
      icon: "people-outline",
      title: "Family management",
      detail: "Manage family members and access",
      accessibilityHint: "Opens family members, invitations, and access settings",
      testID: "care-family-management",
      onPress: () => router.push("/care/family-management"),
    },
  ];

  return (
    <ScreenShell testID="care-screen" header={<AppHeader />}>
      {loading ? (
        <LoadingState label="Loading Care" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <View style={styles.content}>
          <View style={styles.headline}>
            <Text style={styles.title}>Care</Text>
            <Text style={styles.subtitle}>
              Manage medicines, appointments, prescriptions, and family.
            </Text>
          </View>

          <View style={styles.actionList}>
            {actions.map((action) => (
              <CareActionCard key={action.testID} {...action} />
            ))}
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    content: { gap: 24 },
    headline: { gap: 6 },
    title: { color: colors.onSurface, fontSize: 32, fontWeight: "800", letterSpacing: -0.6 },
    subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23 },
    actionList: { gap: 14 },
    actionCard: {
      minHeight: 88,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    actionIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
    },
    actionCopy: { flex: 1, gap: 4 },
    actionTitle: { color: colors.onSurface, fontSize: 19, fontWeight: "800" },
    actionDetail: { color: colors.muted, fontSize: 15, lineHeight: 20 },
    pressed: { opacity: 0.78 },
  }),
);
