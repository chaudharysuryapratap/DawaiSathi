import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useData } from "@/src/data-context";
import { EmptyState, ErrorState, LoadingState, PageHeader, PrimaryButton, ScreenShell } from "@/src/components/dawai-ui";
import { makeStyles, useTheme } from "@/src/theme";

function formatTime(value: string) {
  const [hourValue, minute] = value.split(":").map(Number);
  const suffix = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const { todayDoses, medicines, loading, error, refresh, logDose } = useData();
  const [busyDose, setBusyDose] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const taken = todayDoses.filter((dose) => dose.status === "taken").length;
  const total = todayDoses.length;
  const progress = total ? taken / total : 0;

  const markTaken = async (medicineId: string, time: string, doseId: string) => {
    setBusyDose(doseId);
    setActionError(null);
    try {
      await logDose(medicineId, time);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Couldn’t log that dose.");
    } finally {
      setBusyDose(null);
    }
  };

  return (
    <ScreenShell testID="today-screen">
      <PageHeader eyebrow="DawaiSathi" title="Today" subtitle="A calmer way to stay on schedule." action={<Pressable testID="today-add-button" accessibilityLabel="Add medicine" onPress={() => router.push("/add-medicine")} style={({ pressed }) => [styles.addIcon, pressed && styles.pressed]}><Ionicons name="add" size={24} color={colors.onBrandPrimary} /></Pressable>} />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refresh} /> : medicines.length === 0 ? <EmptyState onPress={() => router.push("/add-medicine")} /> : (
        <>
          <View style={styles.progressCard}>
            <View style={styles.progressCopy}><Text style={styles.progressEyebrow}>DAILY PROGRESS</Text><Text style={styles.progressTitle}>{taken} of {total} doses taken</Text><Text style={styles.progressSub}>{taken === total ? "You’re all caught up." : "One small step at a time."}</Text></View>
            <View style={styles.progressRing}><Text style={styles.progressValue}>{Math.round(progress * 100)}%</Text></View>
          </View>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Your schedule</Text><Text style={styles.sectionMeta}>{total} {total === 1 ? "dose" : "doses"}</Text></View>
          {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
          <View style={styles.doseList}>
            {todayDoses.map((dose) => {
              const takenDose = dose.status === "taken";
              return <View key={dose.dose_id} style={[styles.doseCard, takenDose && styles.doseCardTaken]}>
                <View style={[styles.timeBadge, takenDose && styles.timeBadgeTaken]}><Text style={[styles.timeText, takenDose && styles.timeTextTaken]}>{formatTime(dose.time)}</Text></View>
                <View style={styles.doseCopy}><Text style={styles.doseName}>{dose.medicine_name}</Text><Text style={styles.doseDetails}>{dose.dosage}{dose.instructions ? ` · ${dose.instructions}` : ""}</Text></View>
                <Pressable testID={`dose-${dose.dose_id}`} accessibilityRole="button" accessibilityLabel={takenDose ? `${dose.medicine_name} taken` : `Mark ${dose.medicine_name} as taken`} disabled={takenDose || busyDose === dose.dose_id} onPress={() => markTaken(dose.medicine_id, dose.time, dose.dose_id)} style={({ pressed }) => [styles.checkButton, takenDose && styles.checkButtonTaken, pressed && styles.pressed]}><Ionicons name={takenDose ? "checkmark" : "checkmark-outline"} size={21} color={takenDose ? colors.onBrandPrimary : colors.brandPrimary} /></Pressable>
              </View>;
            })}
          </View>
          <PrimaryButton label="Add another medicine" onPress={() => router.push("/add-medicine")} />
        </>
      )}
    </ScreenShell>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  addIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  progressCard: { backgroundColor: colors.brandTertiary, borderRadius: 22, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressCopy: { flex: 1, gap: 4 },
  progressEyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  progressTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  progressSub: { color: colors.onSurfaceSecondary, fontSize: 13 },
  progressRing: { width: 66, height: 66, borderRadius: 33, borderWidth: 5, borderColor: colors.brandSecondary, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  progressValue: { color: colors.brandPrimary, fontSize: 16, fontWeight: "800" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sectionMeta: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  actionError: { color: colors.error, fontSize: 13 },
  doseList: { gap: 10 },
  doseCard: { minHeight: 82, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "center", gap: 12 },
  doseCardTaken: { backgroundColor: colors.surface, borderColor: colors.brandSecondary },
  timeBadge: { minWidth: 65, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: colors.surfaceTertiary },
  timeBadgeTaken: { backgroundColor: colors.brandTertiary },
  timeText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "800" },
  timeTextTaken: { color: colors.brandPrimary },
  doseCopy: { flex: 1, gap: 4 },
  doseName: { color: colors.onSurface, fontSize: 16, fontWeight: "750" },
  doseDetails: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  checkButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  checkButtonTaken: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
}));