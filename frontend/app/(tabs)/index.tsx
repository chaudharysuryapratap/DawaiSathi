import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { AppHeader } from "@/src/components/app-header";
import { authHeaders, resolveMediaUrl } from "@/src/api";
import { EmptyMedicineState, ErrorState, LoadingState, ScreenShell } from "@/src/components/dawai-ui";
import { EyeDropCard } from "@/src/components/eye-drop-card";
import { EyeDropDetailSheet } from "@/src/components/eye-drop-detail-sheet";
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
import type { TimeSlot, TodayDose, TodayProtocol } from "@/src/types";

type SlotItem =
  | { kind: "dose"; time: string; dose: TodayDose }
  | { kind: "protocol"; time: string; protocol: TodayProtocol };

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const { width, fontScale } = useWindowDimensions();
  const stackDoseActions = width < 360 || fontScale > 1.2;
  const {
    todayDoses,
    todayProtocols,
    medicines,
    protocols,
    upcomingCheckup,
    activeMember,
    loading,
    error,
    refresh,
    logDose,
    undoDose,
  } = useData();
  const [selectedDose, setSelectedDose] = useState<TodayDose | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<TodayProtocol | null>(null);
  const [busyDoseIds, setBusyDoseIds] = useState<Set<string>>(() => new Set());
  const [doseActionMessage, setDoseActionMessage] = useState<string | null>(null);
  const [doseActionError, setDoseActionError] = useState<string | null>(null);
  const doseActionsInFlight = useRef(new Set<string>());

  const toggleDoseTaken = async (dose: TodayDose) => {
    if (doseActionsInFlight.current.has(dose.dose_id)) return;
    const undo = Boolean(dose.logged_at);
    doseActionsInFlight.current.add(dose.dose_id);
    setBusyDoseIds((current) => new Set(current).add(dose.dose_id));
    setDoseActionMessage(null);
    setDoseActionError(null);
    try {
      if (undo) {
        await undoDose(dose.medicine_id, dose.time);
      } else {
        await logDose(dose.medicine_id, dose.time);
      }
      setDoseActionMessage(undo ? `${dose.medicine_name} taken record undone.` : `${dose.medicine_name} marked as taken.`);
    } catch (requestError) {
      setDoseActionError(
        requestError instanceof Error ? requestError.message : "The dose could not be saved.",
      );
    } finally {
      doseActionsInFlight.current.delete(dose.dose_id);
      setBusyDoseIds((current) => {
        const next = new Set(current);
        next.delete(dose.dose_id);
        return next;
      });
    }
  };

  const totalDoses = todayDoses.length;
  const takenDoses = todayDoses.filter((dose) => dose.logged_at).length;
  const totalProtocolSteps = todayProtocols.reduce((acc, protocol) => acc + protocol.steps.length, 0);
  const takenProtocolSteps = todayProtocols.reduce(
    (acc, protocol) => acc + protocol.steps.filter((step) => step.logged_at).length,
    0,
  );
  const total = totalDoses + totalProtocolSteps;
  const taken = takenDoses + takenProtocolSteps;
  const percent = total ? Math.round((taken / total) * 100) : 0;

  const grouped = useMemo(() => {
    const map = new Map<TimeSlot, SlotItem[]>();
    todayDoses.forEach((dose) => {
      const list = map.get(dose.time_slot) ?? [];
      list.push({ kind: "dose", time: dose.time, dose });
      map.set(dose.time_slot, list);
    });
    todayProtocols.forEach((protocol) => {
      const list = map.get(protocol.time_slot) ?? [];
      list.push({ kind: "protocol", time: protocol.start_time, protocol });
      map.set(protocol.time_slot, list);
    });
    map.forEach((list) => list.sort((a, b) => (a.time < b.time ? -1 : 1)));
    return map;
  }, [todayDoses, todayProtocols]);

  const nothingToShow = medicines.length === 0 && protocols.length === 0;

  return (
    <ScreenShell testID="today-screen" header={<AppHeader />}>
      {loading ? (
        <LoadingState label="Loading today’s doses" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : nothingToShow ? (
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
                {taken} / {total} taken · {percent}%
              </Text>
              {activeMember ? (
                <Text style={styles.progressSecondary}>{activeMember.name}</Text>
              ) : null}
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
          </View>
          {doseActionMessage ? (
            <Text accessibilityLiveRegion="polite" style={styles.actionMessage}>
              {doseActionMessage}
            </Text>
          ) : null}
          {doseActionError ? (
            <Text accessibilityLiveRegion="assertive" style={styles.actionError}>
              {doseActionError}
            </Text>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today’s Doses</Text>
          </View>

          {total === 0 ? (
            <View style={styles.dayOff}>
              <Ionicons name="sunny-outline" size={22} color={colors.muted} />
              <Text style={styles.dayOffText}>No doses scheduled today. Enjoy the day.</Text>
            </View>
          ) : (
            TIME_SLOTS.map((slot) => {
              const items = grouped.get(slot);
              if (!items || items.length === 0) return null;
              const slotTime = items[0].time;
              return (
                <View key={slot} style={styles.slotBlock}>
                  <View style={styles.slotHeader}>
                    <Text style={styles.slotTitle}>{TIME_SLOT_LABEL[slot]}</Text>
                    <Text style={styles.slotTime}>{formatTime(slotTime)}</Text>
                  </View>
                  <View style={styles.slotList}>
                    {items.map((item) => {
                      if (item.kind === "protocol") {
                        return (
                          <EyeDropCard
                            key={`protocol-${item.protocol.protocol_id}`}
                            protocol={item.protocol}
                            onPress={() => setSelectedProtocol(item.protocol)}
                            testID={`protocol-card-${item.protocol.protocol_id}`}
                          />
                        );
                      }
                      const dose = item.dose;
                      const status = computeDoseStatus(dose.time, dose.logged_at);
                      const isTaken = Boolean(dose.logged_at);
                      const eligibleForQuickAction =
                        isTaken || status === "ready" || status === "late" || status === "missed";
                      const isBusy = busyDoseIds.has(dose.dose_id);
                      return (
                        <View
                          key={dose.dose_id}
                          testID={`dose-row-${dose.dose_id}`}
                          style={[styles.doseRow, stackDoseActions && styles.doseRowStacked]}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`View ${dose.medicine_name} dose details`}
                            accessibilityHint="Opens medicine details and dose history."
                            testID={`dose-details-${dose.dose_id}`}
                            onPress={() => setSelectedDose(dose)}
                            style={({ pressed }) => [styles.doseMain, pressed && styles.pressed]}
                          >
                            {dose.image_url ? (
                              <Image
                                accessibilityLabel={`${dose.medicine_name} photo`}
                                source={{
                                  uri: resolveMediaUrl(dose.image_url),
                                  headers: authHeaders(),
                                }}
                                contentFit="cover"
                                style={styles.doseImage}
                              />
                            ) : (
                              <View style={styles.doseIcon}>
                                <Ionicons name="medical" size={19} color={colors.brandPrimary} />
                              </View>
                            )}
                            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                              <Text style={styles.doseName}>{dose.medicine_name}</Text>
                              <Text style={styles.doseDetail}>
                                {[dose.instructions, dose.dosage].filter(Boolean).join(" · ") || "As directed"}
                              </Text>
                              <View style={[styles.doseFooter, status === "locked" && styles.upcomingFooter]}>
                                <Text style={styles.doseTime}>{formatTime(dose.time)}</Text>
                                <StatusPill compact status={status} testID={`dose-status-${dose.dose_id}`} />
                              </View>
                            </View>
                          </Pressable>
                          <View style={styles.doseActions}>
                            {eligibleForQuickAction ? (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={isTaken ? `Undo taken for ${dose.medicine_name} dose at ${formatTime(dose.time)}` : `Mark ${dose.medicine_name} dose at ${formatTime(dose.time)} as taken`}
                                testID={`${isTaken ? "dose-undo-taken" : "dose-mark-taken"}-${dose.dose_id}`}
                                disabled={isBusy}
                                onPress={() => void toggleDoseTaken(dose)}
                                style={({ pressed }) => [
                                  styles.quickAction,
                                  isTaken && styles.quickActionUndo,
                                  isBusy && styles.quickActionDisabled,
                                  pressed && !isBusy && styles.pressed,
                                ]}
                              >
                                <Text style={[styles.quickActionText, isTaken && styles.quickActionUndoText]}>
                                  {isBusy ? "Saving…" : isTaken ? "Undo taken" : "Mark as taken"}
                                </Text>
                              </Pressable>
                            ) : null}
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`View ${dose.medicine_name} dose details`}
                              testID={`dose-open-details-${dose.dose_id}`}
                              onPress={() => setSelectedDose(dose)}
                              style={({ pressed }) => [
                                styles.chevronButton,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                            </Pressable>
                          </View>
                        </View>
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
        dose={
          selectedDose
            ? todayDoses.find((dose) => dose.dose_id === selectedDose.dose_id) ?? selectedDose
            : null
        }
      />
      <EyeDropDetailSheet
        visible={selectedProtocol !== null}
        onClose={() => setSelectedProtocol(null)}
        protocol={
          selectedProtocol
            ? todayProtocols.find((item) => item.protocol_id === selectedProtocol.protocol_id) ?? selectedProtocol
            : null
        }
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
    progressText: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    progressPrimary: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    progressSecondary: { color: colors.muted, fontSize: 12 },
    actionMessage: { color: colors.success, fontSize: 13, fontWeight: "700" },
    actionError: { color: colors.error, fontSize: 13, fontWeight: "700" },
    progressBar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceTertiary,
      overflow: "hidden",
    },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
    sectionHeader: { flexDirection: "row", alignItems: "center" },
    sectionTitle: { color: colors.onSurface, fontSize: 21, fontWeight: "800" },
    dayOff: { alignItems: "center", padding: 22, gap: 8 },
    dayOffText: { color: colors.muted, fontSize: 14 },
    slotBlock: { gap: 10 },
    slotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    slotTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    slotTime: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
    slotList: { gap: 8 },
    doseRow: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 12,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    doseRowStacked: { flexDirection: "column", alignItems: "stretch" },
    doseMain: {
      flex: 1,
      minWidth: 0,
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
    },
    doseIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    doseImage: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surfaceTertiary },
    doseName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    doseDetail: { color: colors.muted, fontSize: 12 },
    doseFooter: { flexDirection: "column", alignItems: "flex-start", gap: 6, marginTop: 3 },
    upcomingFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
    doseTime: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
    doseActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexShrink: 0, gap: 4 },
    quickAction: {
      width: 108,
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: colors.brandPrimary,
      paddingHorizontal: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    quickActionText: {
      color: colors.onBrandPrimary,
      fontSize: 13,
      fontWeight: "800",
      textAlign: "center",
    },
    quickActionDisabled: { opacity: 0.6 },
    quickActionUndo: { backgroundColor: colors.brandTertiary },
    quickActionUndoText: { color: colors.brandPrimary },
    chevronButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
  }),
);
