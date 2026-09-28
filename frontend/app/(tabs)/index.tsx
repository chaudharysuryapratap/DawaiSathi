import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/src/components/app-header";
import { EmptyMedicineState, ErrorState, LoadingState, ScreenShell } from "@/src/components/dawai-ui";
import { MedicineDetailSheet } from "@/src/components/medicine-detail-sheet";
import { StatusPill } from "@/src/components/status-pill";
import { useData } from "@/src/data-context";
import {
  TIME_SLOTS,
  TIME_SLOT_LABEL,
  computeDoseStatus,
  formatTime,
  relativeCheckup,
} from "@/src/dose-status";
import { makeStyles, useTheme } from "@/src/theme";
import type { TimeSlot, TodayDose } from "@/src/types";

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const { todayDoses, medicines, upcomingCheckup, activeMember, loading, error, refresh } = useData();
  const [selectedDose, setSelectedDose] = useState<TodayDose | null>(null);

  const taken = todayDoses.filter((dose) => dose.logged_at).length;
  const total = todayDoses.length;
  const percent = total ? Math.round((taken / total) * 100) : 0;

  const grouped = useMemo(() => {
    const map = new Map<TimeSlot, TodayDose[]>();
    todayDoses.forEach((dose) => {
      const list = map.get(dose.time_slot) ?? [];
      list.push(dose);
      map.set(dose.time_slot, list);
    });
    return map;
  }, [todayDoses]);

  return (
    <ScreenShell testID="today-screen" header={<AppHeader />}>
      {loading ? (
        <LoadingState label="Loading today’s doses" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : medicines.length === 0 ? (
        <EmptyMedicineState onPress={() => router.push("/add-medicine")} />
      ) : (
        <>
          {upcomingCheckup ? (
            <Pressable
              testID="today-upcoming-checkup"
              onPress={() => router.push({ pathname: "/care/checkups", params: { id: upcomingCheckup.id } })}
              style={({ pressed }) => [styles.checkupCard, pressed && styles.pressed]}
            >
              <View style={styles.checkupIcon}>
                <Ionicons name="calendar-outline" size={22} color={colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkupEyebrow}>Upcoming checkup</Text>
                <Text style={styles.checkupTitle}>{upcomingCheckup.title}</Text>
                <Text style={styles.checkupMeta}>{relativeCheckup(upcomingCheckup.scheduled_at)}</Text>
                {upcomingCheckup.doctor || upcomingCheckup.location ? (
                  <Text style={styles.checkupDetails}>
                    {[upcomingCheckup.doctor, upcomingCheckup.location].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ) : null}

          <View style={styles.progressWrap}>
            <View style={styles.progressText}>
              <Text style={styles.progressPrimary}>
                {taken} / {total} doses taken · {percent}%
              </Text>
              <Text style={styles.progressSecondary}>{activeMember ? `Today for ${activeMember.name}` : "Today’s progress"}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today’s Doses</Text>
            <Text style={styles.sectionMeta}>
              {total} {total === 1 ? "dose" : "doses"}
            </Text>
          </View>

          {total === 0 ? (
            <View style={styles.dayOff}>
              <Ionicons name="sunny-outline" size={22} color={colors.muted} />
              <Text style={styles.dayOffText}>No doses scheduled today. Enjoy the day.</Text>
            </View>
          ) : (
            TIME_SLOTS.map((slot) => {
              const doses = grouped.get(slot);
              if (!doses || doses.length === 0) return null;
              const slotTime = doses[0].time;
              return (
                <View key={slot} style={styles.slotBlock}>
                  <View style={styles.slotHeader}>
                    <View>
                      <Text style={styles.slotTitle}>{TIME_SLOT_LABEL[slot]}</Text>
                      <Text style={styles.slotMeta}>
                        {doses.length} {doses.length === 1 ? "medicine" : "medicines"}
                      </Text>
                    </View>
                    <Text style={styles.slotTime}>{formatTime(slotTime)}</Text>
                  </View>
                  <View style={styles.slotList}>
                    {doses.map((dose) => {
                      const status = computeDoseStatus(dose.time, dose.logged_at);
                      return (
                        <Pressable
                          key={dose.dose_id}
                          testID={`dose-row-${dose.dose_id}`}
                          onPress={() => setSelectedDose(dose)}
                          style={({ pressed }) => [styles.doseRow, pressed && styles.pressed]}
                        >
                          <View style={styles.doseIcon}>
                            <Ionicons name="medical" size={19} color={colors.brandPrimary} />
                          </View>
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={styles.doseName}>{dose.medicine_name}</Text>
                            <Text style={styles.doseDetail}>
                              {[dose.instructions, dose.dosage].filter(Boolean).join(" · ") || "As directed"}
                            </Text>
                            <View style={styles.doseFooter}>
                              <Text style={styles.doseTime}>{formatTime(dose.time)}</Text>
                              <StatusPill status={status} testID={`dose-status-${dose.dose_id}`} />
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </>
      )}

      <MedicineDetailSheet
        visible={selectedDose !== null}
        onClose={() => setSelectedDose(null)}
        dose={selectedDose}
      />
    </ScreenShell>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    checkupCard: {
      minHeight: 88,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    checkupIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.infoTint,
      alignItems: "center",
      justifyContent: "center",
    },
    checkupEyebrow: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    checkupTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800", marginTop: 2 },
    checkupMeta: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 3 },
    checkupDetails: { color: colors.muted, fontSize: 12, marginTop: 1 },
    progressWrap: { gap: 10 },
    progressText: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    progressPrimary: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    progressSecondary: { color: colors.muted, fontSize: 12 },
    progressBar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceTertiary,
      overflow: "hidden",
    },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sectionTitle: { color: colors.onSurface, fontSize: 21, fontWeight: "800" },
    sectionMeta: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    dayOff: { alignItems: "center", padding: 22, gap: 8 },
    dayOffText: { color: colors.muted, fontSize: 14 },
    slotBlock: { gap: 10 },
    slotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    slotTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    slotMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    slotTime: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
    slotList: { gap: 8 },
    doseRow: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    doseIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    doseName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    doseDetail: { color: colors.muted, fontSize: 12 },
    doseFooter: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
    doseTime: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
    pressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
  }),
);
