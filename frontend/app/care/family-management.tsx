import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth-context";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

const CAPABILITIES = [
  { icon: "person-add-outline", title: "Invite members", detail: "Owners can create email-bound, 7-day invitation tokens from the family selector." },
  { icon: "swap-horizontal-outline", title: "Switch families", detail: "Use the family selector beneath the family name on Today." },
] as const;

export default function FamilyManagementScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { activeFamilyGroup, leaveFamilyGroup } = useData();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = activeFamilyGroup?.owner_user_id === user?.id;

  const leave = async () => {
    if (!activeFamilyGroup || isOwner) return;
    setBusy(true);
    setError(null);
    try {
      await leaveFamilyGroup(activeFamilyGroup.id);
      setConfirmLeave(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not leave this family.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Family management" }} />
      <View style={[styles.content, { paddingBottom: insets.bottom + 60 }]}>
        <Text style={styles.eyebrow}>FAMILY MANAGEMENT</Text>
        <Text style={styles.title}>Manage your family</Text>
        <Text style={styles.subtitle}>
          Your family groups and invitations are protected by your signed-in account.
        </Text>
        {activeFamilyGroup ? (
          <View style={styles.currentGroup}>
            <Text style={styles.groupLabel}>CURRENT FAMILY</Text>
            <Text style={styles.groupName}>{activeFamilyGroup.name}</Text>
            <Text style={styles.rowDetail}>
              {isOwner ? "You are the owner." : "You joined with an invitation."}
            </Text>
            {isOwner ? (
              <Text style={styles.rowDetail}>Transfer ownership before leaving this family.</Text>
            ) : confirmLeave ? (
              <View style={styles.confirmArea}>
                <Text style={styles.rowDetail}>
                  You will lose access. The family’s medicines and history will remain with the family.
                </Text>
                <View style={styles.leaveActions}>
                  <Pressable
                    accessibilityRole="button"
                    testID="family-leave-confirm"
                    disabled={busy}
                    onPress={() => void leave()}
                    style={({ pressed }) => [styles.leaveButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.leaveButtonText}>{busy ? "Leaving…" : "Confirm leave"}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirmLeave(false)}
                    style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                testID="family-leave"
                onPress={() => setConfirmLeave(true)}
                style={({ pressed }) => [styles.leaveButton, pressed && styles.pressed]}
              >
                <Text style={styles.leaveButtonText}>Leave this family</Text>
              </Pressable>
            )}
            {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
          </View>
        ) : null}
        <View style={styles.list}>
          {CAPABILITIES.map((item) => (
            <View key={item.title} style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name={item.icon} size={19} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    content: { padding: 20, gap: 14 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    list: { gap: 8 },
    currentGroup: { padding: 16, gap: 8, borderRadius: 18, backgroundColor: colors.surfaceSecondary },
    groupLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    groupName: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
    confirmArea: { gap: 10, marginTop: 4 },
    leaveActions: { flexDirection: "row", gap: 8 },
    leaveButton: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.error,
      justifyContent: "center",
      alignItems: "center",
    },
    leaveButtonText: { color: colors.onError, fontSize: 14, fontWeight: "800" },
    cancelButton: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center" },
    cancelButtonText: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
    error: { color: colors.error, fontSize: 13 },
    pressed: { opacity: 0.78 },
    row: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
    },
    rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    rowDetail: { color: colors.muted, fontSize: 12, marginTop: 2 },
  }),
);
