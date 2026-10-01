import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingState, PrimaryButton } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { formatIsoDateTime } from "@/src/dose-status";
import { makeStyles, useTheme } from "@/src/theme";

export default function CheckupsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const { checkups, members, loading, removeCheckup } = useData();

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const updateNow = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      const nextBoundary = checkups.reduce((next, checkup) => {
        const scheduledAt = new Date(checkup.scheduled_at).getTime();
        return scheduledAt > currentTime ? Math.min(next, scheduledAt) : next;
      }, Number.POSITIVE_INFINITY);
      if (Number.isFinite(nextBoundary)) {
        timeout = setTimeout(updateNow, Math.min(nextBoundary - currentTime + 1, 2_147_483_647));
      }
    };

    updateNow();
    return () => {
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, [checkups]);
  const upcoming = useMemo(
    () => (now === null ? [] : checkups.filter((checkup) => new Date(checkup.scheduled_at).getTime() >= now)),
    [checkups, now],
  );
  const past = useMemo(
    () => (now === null ? [] : checkups.filter((checkup) => new Date(checkup.scheduled_at).getTime() < now)),
    [checkups, now],
  );
  const highlight = params.id ? checkups.find((checkup) => checkup.id === params.id) : null;

  const confirmDelete = (id: string) => {
    Alert.alert("Delete checkup?", "This will remove the reminder.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeCheckup(id) },
    ]);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Checkups" }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>CHECKUPS</Text>
          <Text style={styles.title}>Doctor visits & labs</Text>
          <Text style={styles.subtitle}>Upcoming checkups pop up on Today automatically.</Text>
        </View>

        {loading ? (
          <LoadingState label="Loading checkups" />
        ) : (
          <>
            <Section title={`Upcoming · ${upcoming.length}`}>
              {upcoming.length === 0 ? (
                <Text style={styles.empty}>No upcoming checkups.</Text>
              ) : (
                upcoming.map((checkup) => {
                  const owner = checkup.member_id ? members.find((member) => member.id === checkup.member_id) : null;
                  const isHighlight = highlight?.id === checkup.id;
                  return (
                    <View key={checkup.id} style={[styles.row, isHighlight && styles.rowHighlight]} testID={`checkup-row-${checkup.id}`}>
                      <View style={[styles.rowIcon, { backgroundColor: colors.info }]}>
                        <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{checkup.title}</Text>
                        <Text style={styles.rowMeta}>{formatIsoDateTime(checkup.scheduled_at)}</Text>
                        {checkup.doctor || checkup.location ? (
                          <Text style={styles.rowSub}>{[checkup.doctor, checkup.location].filter(Boolean).join(" · ")}</Text>
                        ) : null}
                        {owner ? <Text style={styles.rowOwner}>For {owner.name}</Text> : null}
                      </View>
                      <View style={styles.rowActions}>
                        <Pressable
                          onPress={() => router.push({ pathname: "/add-checkup", params: { id: checkup.id } })}
                          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                          testID={`checkup-edit-${checkup.id}`}
                        >
                          <Ionicons name="pencil" size={14} color={colors.brandPrimary} />
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDelete(checkup.id)}
                          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                          testID={`checkup-delete-${checkup.id}`}
                        >
                          <Ionicons name="trash-outline" size={14} color={colors.error} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </Section>

            <Section title={`Past · ${past.length}`}>
              {past.length === 0 ? (
                <Text style={styles.empty}>No past checkups.</Text>
              ) : (
                past.map((checkup) => {
                  const owner = checkup.member_id ? members.find((member) => member.id === checkup.member_id) : null;
                  return (
                    <View key={checkup.id} style={styles.row}>
                      <View style={styles.rowIcon}>
                        <Ionicons name="checkmark-done-outline" size={18} color={colors.brandPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{checkup.title}</Text>
                        <Text style={styles.rowMeta}>{formatIsoDateTime(checkup.scheduled_at)}</Text>
                        {owner ? <Text style={styles.rowOwner}>For {owner.name}</Text> : null}
                      </View>
                    </View>
                  );
                })
              )}
            </Section>

            <PrimaryButton label="Add checkup" icon="calendar" onPress={() => router.push("/add-checkup")} testID="checkups-add" />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    content: { padding: 20, gap: 16 },
    head: { gap: 4 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
    subtitle: { color: colors.muted, fontSize: 13 },
    section: { gap: 8 },
    sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    sectionBody: { gap: 8 },
    row: {
      minHeight: 78,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
    },
    rowHighlight: { borderWidth: 2, borderColor: colors.brandPrimary },
    rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
    rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    rowMeta: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
    rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    rowOwner: { color: colors.brandPrimary, fontSize: 12, marginTop: 2, fontWeight: "700" },
    rowActions: { flexDirection: "row", gap: 6 },
    actionButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceTertiary,
    },
    empty: { color: colors.muted, fontSize: 13, padding: 14 },
    pressed: { opacity: 0.8 },
  }),
);
