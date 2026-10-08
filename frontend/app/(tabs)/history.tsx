import { HistoryDateDial, localDayKey } from "@/src/components/history-date-dial";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";


import { ErrorState, LoadingState, ScreenShell } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { formatIsoDate, formatTime } from "@/src/dose-status";
import { makeStyles, useTheme } from "@/src/theme";
import type { DoseLog, MissedDoseEvent, ProtocolStepLog } from "@/src/types";

const STATUS_FILTERS = ["all", "taken", "taken-late", "missed"] as const;
export function isHistoryTakenLate(entry: { local_date: string; time: string; logged_at: string }) {
  return new Date(entry.logged_at).getTime() - new Date(`${entry.local_date}T${entry.time}:00`).getTime() > 30 * 60000;
}
function takenAt(value: string) {
  return `Taken at ${new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
type StatusFilter = (typeof STATUS_FILTERS)[number];

const RANGES = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "all", label: "All time" },
] as const;

type Range = (typeof RANGES)[number]["id"];

const HISTORY_REFERENCE_TIME = Date.now();

type DayEntry =
  | { kind: "dose"; time: string; log: DoseLog }
  | { kind: "protocol"; time: string; protocolId: string; protocolName: string; steps: ProtocolStepLog[] }
  | { kind: "missed"; time: string; event: MissedDoseEvent };

function groupDay(
  doses: DoseLog[],
  protocolLogs: ProtocolStepLog[],
  missedEvents: MissedDoseEvent[],
): [string, DayEntry[]][] {
  const dayMap = new Map<
    string,
    { doses: DoseLog[]; protocolSteps: ProtocolStepLog[]; missedEvents: MissedDoseEvent[] }
  >();
  doses.forEach((log) => {
    const bucket = dayMap.get(log.local_date) ?? { doses: [], protocolSteps: [], missedEvents: [] };
    bucket.doses.push(log);
    dayMap.set(log.local_date, bucket);
  });
  protocolLogs.forEach((log) => {
    const bucket = dayMap.get(log.local_date) ?? { doses: [], protocolSteps: [], missedEvents: [] };
    bucket.protocolSteps.push(log);
    dayMap.set(log.local_date, bucket);
  });
  missedEvents.forEach((event) => {
    const bucket = dayMap.get(event.local_date) ?? { doses: [], protocolSteps: [], missedEvents: [] };
    bucket.missedEvents.push(event);
    dayMap.set(event.local_date, bucket);
  });
  const days: [string, DayEntry[]][] = [];
  Array.from(dayMap.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .forEach(([date, bucket]) => {
      const entries: DayEntry[] = bucket.doses.map((log) => ({
        kind: "dose",
        time: log.time,
        log,
      }));
      const protocolBuckets = new Map<string, { name: string; steps: ProtocolStepLog[] }>();
      bucket.protocolSteps.forEach((step) => {
        const found = protocolBuckets.get(step.protocol_id) ?? { name: step.protocol_name, steps: [] };
        found.steps.push(step);
        protocolBuckets.set(step.protocol_id, found);
      });
      protocolBuckets.forEach((value, key) => {
        value.steps.sort((a, b) => (a.step_order < b.step_order ? -1 : 1));
        entries.push({
          kind: "protocol",
          time: value.steps[0]?.time ?? "00:00",
          protocolId: key,
          protocolName: value.name,
          steps: value.steps,
        });
      });
      bucket.missedEvents.forEach((event) => {
        entries.push({ kind: "missed", time: event.time, event });
      });
      entries.sort((a, b) => (a.time < b.time ? -1 : 1));
      days.push([date, entries]);
    });
  return days;
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const {
    history,
    protocolHistory,
    missedDoseHistory,
    medicines,
    protocols,
    members,
    activeMember,
    activeMemberId,
    setActiveMember,
    loading,
    error,
    refresh,
  } = useData();

  const [medicineFilter, setMedicineFilter] = useState<string | "all">("all");
  const [range, setRange] = useState<Range>("7");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(() => localDayKey(new Date()));

  const cutoff = useMemo(() => {
    if (range !== "all") { const day = new Date(HISTORY_REFERENCE_TIME); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (range === "7" ? 6 : 29)); return day.getTime(); }
    return 0;
  }, [range]);

  const filteredDoses = useMemo(
    () =>
      history.filter((entry) => {
        if (cutoff && new Date(entry.logged_at).getTime() < cutoff) return false;
        if (medicineFilter !== "all" && medicineFilter !== "protocols" && entry.medicine_id !== medicineFilter)
          return false;
        if (medicineFilter === "protocols") return false;
        return true;
      }),
    [history, cutoff, medicineFilter],
  );

  const filteredProtocolLogs = useMemo(
    () =>
      protocolHistory.filter((entry) => {
        if (cutoff && new Date(entry.logged_at).getTime() < cutoff) return false;
        if (medicineFilter !== "all" && medicineFilter !== "protocols") return false;
        return true;
      }),
    [protocolHistory, cutoff, medicineFilter],
  );

  const filteredMissedEvents = useMemo(
    () =>
      missedDoseHistory.filter((event) => {
        const eventDate = new Date(`${event.local_date}T00:00:00`).getTime();
        if (cutoff && eventDate < cutoff) return false;
        if (medicineFilter === "protocols") return event.source_type === "protocol_step";
        if (medicineFilter !== "all") return event.medicine_id === medicineFilter;
        return true;
      }),
    [missedDoseHistory, cutoff, medicineFilter],
  );

  const dailyTaken = useMemo(() => {
    const counts: Record<string, number> = {};
    [...history, ...protocolHistory].forEach(log => { counts[log.local_date] = (counts[log.local_date] ?? 0) + 1; });
    return counts;
  }, [history, protocolHistory]);
  const dailyMissed = useMemo(() => {
    const counts: Record<string, number> = {};
    missedDoseHistory.forEach(log => { counts[log.local_date] = (counts[log.local_date] ?? 0) + 1; });
    return counts;
  }, [missedDoseHistory]);

  const missedDoses = filteredMissedEvents.length;

  const takenDoses = filteredDoses.length + filteredProtocolLogs.length;
  const lateDoses = [...filteredDoses, ...filteredProtocolLogs].filter(isHistoryTakenLate).length;
  const totalDoses = takenDoses + missedDoses;
  const adherence = totalDoses ? Math.round((takenDoses / totalDoses) * 100) : 0;

  const grouped = useMemo(() => {
    return groupDay(
      statusFilter === "missed" ? [] : history.filter(entry => entry.local_date === selectedDate && medicineFilter !== "protocols" && (medicineFilter === "all" || entry.medicine_id === medicineFilter) && (statusFilter === "all" || (statusFilter === "taken-late" ? isHistoryTakenLate(entry) : !isHistoryTakenLate(entry)))),
      statusFilter === "missed" || (medicineFilter !== "all" && medicineFilter !== "protocols") ? [] : protocolHistory.filter(entry => entry.local_date === selectedDate && (statusFilter === "all" || (statusFilter === "taken-late" ? isHistoryTakenLate(entry) : !isHistoryTakenLate(entry)))),
      statusFilter === "taken" || statusFilter === "taken-late" ? [] : missedDoseHistory.filter(entry => entry.local_date === selectedDate && (medicineFilter === "all" || (medicineFilter === "protocols" ? entry.source_type === "protocol_step" : entry.medicine_id === medicineFilter))),
    );
  }, [history, protocolHistory, missedDoseHistory, selectedDate, medicineFilter, statusFilter]);
  const selectedTaken = (medicineFilter === "protocols" ? 0 : history.filter(entry => entry.local_date === selectedDate && (medicineFilter === "all" || entry.medicine_id === medicineFilter)).length) + (medicineFilter === "all" || medicineFilter === "protocols" ? protocolHistory.filter(entry => entry.local_date === selectedDate).length : 0);
  const selectedMissed = missedDoseHistory.filter(entry => entry.local_date === selectedDate && (medicineFilter === "all" || (medicineFilter === "protocols" ? entry.source_type === "protocol_step" : entry.medicine_id === medicineFilter))).length;
  const selectedLate = history.filter(entry => entry.local_date === selectedDate && isHistoryTakenLate(entry) && medicineFilter !== "protocols" && (medicineFilter === "all" || entry.medicine_id === medicineFilter)).length + (medicineFilter === "all" || medicineFilter === "protocols" ? protocolHistory.filter(entry => entry.local_date === selectedDate && isHistoryTakenLate(entry)).length : 0);

  const memberName = activeMember ? activeMember.name : "Everyone";
  const rangeLabel = RANGES.find((item) => item.id === range)?.label ?? "";
  const hasProtocols = protocols.length > 0 || protocolHistory.length > 0;

  return (
    <ScreenShell testID="history-screen">
      {loading ? (
        <LoadingState label="Loading your history" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} testID="history-member-filter">
            <FilterPill
              label={`All Family (${members.length})`}
              active={!activeMemberId}
              onPress={() => setActiveMember(null)}
              testID="history-filter-everyone"
            />
            {members.map((member) => (
              <FilterPill
                key={member.id}
                label={member.name}
                accent={member.color}
                active={activeMemberId === member.id}
                onPress={() => setActiveMember(member.id)}
                testID={`history-filter-member-${member.id}`}
              />
            ))}
          </ScrollView>

          <View style={styles.adherenceCard} testID="history-adherence">
            <View style={styles.summaryHeading}>
              <View style={{ flex: 1, gap: 3 }}><Text style={styles.summaryTitle}>Medication Adherence</Text><Text style={styles.summarySubtitle}>Recorded consistency · {memberName} · {rangeLabel}</Text></View>
              <View style={styles.percentBadge}><Text style={styles.percentText}>{totalDoses ? adherence + "%" : "—"}</Text></View>
            </View>
            <View style={styles.summaryStats}>
              {[{ label: "Taken", value: takenDoses - lateDoses, color: colors.success }, { label: "Taken late", value: lateDoses, color: colors.warning }, { label: "Missed", value: missedDoses, color: colors.error }].map(item => <View key={item.label} style={styles.statTile}><Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text><Text style={[styles.statLabel, { color: item.color }]}>{item.label}</Text></View>)}
            </View>
          </View>
          <HistoryDateDial taken={dailyTaken} missed={dailyMissed} onSelectDate={setSelectedDate} />
          <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={styles.dayTitle}>{formatIsoDate(`${selectedDate}T12:00:00`)}</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showFilters }} testID="history-more-filters" onPress={() => setShowFilters(value => !value)} style={{ alignSelf: "flex-end", padding: 8 }}><Text style={styles.summarySubtitle}>{medicineFilter === "all" ? "All items" : medicineFilter === "protocols" ? "Eye-drop protocols" : medicines.find(item => item.id === medicineFilter)?.name} · {rangeLabel} · Filters {showFilters ? "⌃" : "⌄"}</Text></Pressable>
          </View>
          {showFilters ? <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} testID="history-medicine-filter">
            <FilterPill
              label="All items"
              active={medicineFilter === "all"}
              onPress={() => setMedicineFilter("all")}
              testID="history-filter-medicine-all"
            />
            {hasProtocols ? (
              <FilterPill
                label="Eye-drop protocols"
                active={medicineFilter === "protocols"}
                onPress={() => setMedicineFilter("protocols")}
                testID="history-filter-medicine-protocols"
              />
            ) : null}
            {medicines.map((medicine) => (
              <FilterPill
                key={medicine.id}
                label={medicine.name}
                active={medicineFilter === medicine.id}
                onPress={() => setMedicineFilter(medicine.id)}
                testID={`history-filter-medicine-${medicine.id}`}
              />
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} testID="history-range-filter">
            {RANGES.map((option) => (
              <FilterPill
                key={option.id}
                label={option.label}
                active={range === option.id}
                onPress={() => setRange(option.id)}
                testID={`history-filter-range-${option.id}`}
              />
            ))}
          </ScrollView>

</> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} testID="history-status-filter">
            {STATUS_FILTERS.map((option) => (
              <FilterPill
                key={option}
                label={option === "all" ? `All (${selectedTaken + selectedMissed})` : option === "taken" ? `Taken (${selectedTaken - selectedLate})` : option === "taken-late" ? `Taken late (${selectedLate})` : `Missed (${selectedMissed})`}
                active={statusFilter === option}
                onPress={() => setStatusFilter(option)}
                testID={`history-filter-status-${option}`}
              />
            ))}
          </ScrollView>
          </View>

          {grouped.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name={statusFilter === "missed" ? "checkmark-circle-outline" : "time-outline"} size={30} color={colors.muted} />
              <Text style={styles.emptyTitle}>
                {statusFilter === "missed" ? "No missed doses on this date" : "No records on this date"}
              </Text>
              <Text style={styles.emptyText}>
                {statusFilter === "missed"
                  ? "Missed-dose history begins from the tracking rollout; earlier dates are not reconstructed."
                  : "Log a dose or adjust the filters to see history here."}
              </Text>
            </View>
          ) : (
            grouped.map(([date, entries]) => (
              <View key={date} style={styles.day}>
                <Text style={styles.dayTitle}>{formatIsoDate(`${date}T12:00:00`)}</Text>
                <View style={styles.dayList}>
                  {entries.map((entry) => {
                    if (entry.kind === "missed") {
                      const label =
                        entry.event.source_type === "protocol_step"
                          ? `${entry.event.protocol_name} · step ${entry.event.step_order}`
                          : entry.event.medicine_name;
                      return (
                        <View key={entry.event.id} testID={`history-missed-${entry.event.id}`} style={styles.dayRow}>
                          <View style={styles.missedCheck}>
                            <Ionicons name="close" size={13} color={colors.onError} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.dayMedicine}>{label}</Text>
                            <Text style={styles.dayMeta}>{members.find(member => member.id === entry.event.member_id)?.name ?? "Shared"} · {formatTime(entry.event.time)} · {entry.event.local_date}</Text>
                          </View>
                          <View style={styles.missedBadge}><Text style={styles.missedBadgeText}>MISSED</Text></View>
                        </View>
                      );
                    }
                    if (entry.kind === "protocol") {
                      const key = `${date}-${entry.protocolId}`;
                      const isOpen = !!expanded[key];
                      const firstStep = entry.steps[0];
                      const lastStep = entry.steps[entry.steps.length - 1];
                      return (
                        <View key={key}>
                          <Pressable
                            testID={`history-protocol-${entry.protocolId}`}
                            onPress={() => setExpanded((state) => ({ ...state, [key]: !isOpen }))}
                            style={({ pressed }) => [styles.dayRow, pressed && styles.pressed]}
                          >
                            <View style={[styles.dayCheck, { backgroundColor: colors.info }]}>
                              <Ionicons name="water" size={14} color={colors.onInfo} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.dayMedicine}>{entry.protocolName}</Text>
                              <Text style={styles.dayMeta}>
                                ✓ {entry.steps.length}-step protocol · {formatTime(firstStep.time)}–{formatTime(lastStep.time)}
                              </Text>
                            </View>
                            <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
                          </Pressable>
                          {isOpen ? (
                            <View style={styles.stepChildren}>
                              {entry.steps.map((step) => (
                                <View key={step.id} style={styles.stepChildRow}>
                                  <View style={styles.stepChildIndex}>
                                    <Text style={styles.stepChildIndexText}>{step.step_order}</Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.stepChildName}>{step.medicine_name}</Text>
                                    <Text style={styles.stepChildMeta}>
                                      {step.dose} · {step.eye === "both" ? "Both eyes" : step.eye === "left" ? "Left eye" : "Right eye"}
                                    </Text>
                                  </View>
                                  <Text style={styles.stepChildTime}>✓ {formatTime(step.time)}</Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    }
                    return (
                      <View key={entry.log.id} style={styles.dayRow}>
                        <View style={styles.dayCheck}>
                          <Ionicons name="checkmark" size={13} color={colors.onSuccess} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dayMedicine}>{entry.log.medicine_name}</Text>
                          <Text style={styles.dayMeta}>{members.find(member => member.id === entry.log.member_id)?.name ?? "Shared"} · {statusFilter === "taken-late" ? takenAt(entry.log.logged_at) : formatTime(entry.log.time)} · {entry.log.local_date}</Text>
                        </View>
                        <View style={[styles.takenBadge, isHistoryTakenLate(entry.log) && { backgroundColor: "#FFF1CC" }]}><Text style={[styles.takenBadgeText, isHistoryTakenLate(entry.log) && { color: colors.warning }]}>{isHistoryTakenLate(entry.log) ? "TAKEN LATE" : "TAKEN"}</Text></View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScreenShell>
  );
}

function FilterPill({
  label,
  active,
  onPress,
  accent,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: string;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterPill,
        active && styles.filterPillActive,
        pressed && styles.pressed,
      ]}
    >
      {accent ? <View style={[styles.filterAccent, { backgroundColor: accent }]} /> : null}
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => {
  return StyleSheet.create({
    head: { gap: 4 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
    subtitle: { color: colors.muted, fontSize: 13 },
    adherenceCard: {
      minHeight: 92,
      borderRadius: 22,
      backgroundColor: colors.brandTertiary,
      padding: 16,
      gap: 14,
    },
    adherencePercent: { color: colors.brandPrimary, fontSize: 24, fontWeight: "800" },
    adherenceMeta: { color: colors.onSurfaceSecondary, fontSize: 13 },
    captureNote: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    adherenceRing: {
      width: 70,
      height: 70,
      borderRadius: 35,
      borderWidth: 6,
      borderColor: colors.brandSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 12,
    },
    adherenceRingText: { color: colors.brandPrimary, fontWeight: "800", fontSize: 15 },
    filterRow: { gap: 8, paddingRight: 4 },
    filterPill: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      flexShrink: 0,
    },
    filterPillActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
    filterText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
    filterTextActive: { color: colors.onBrandPrimary },
    filterAccent: { width: 10, height: 10, borderRadius: 5 },
    empty: { alignItems: "center", padding: 28, gap: 8 },
    emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
    emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
    day: { gap: 8 },
    dayTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    dayList: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 18,
      gap: 10,
    },
    dayRow: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      borderWidth: 1, borderColor: colors.divider, borderRadius: 14, backgroundColor: colors.surfaceSecondary, paddingVertical: 12,
    },
    dayCheck: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    missedCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.error,
      alignItems: "center",
      justifyContent: "center",
    },
    dayMedicine: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
    dayMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    dayTime: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
    stepChildren: {
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 6,
      gap: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    stepChildRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    stepChildIndex: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    stepChildIndexText: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800" },
    stepChildName: { color: colors.onSurface, fontSize: 13, fontWeight: "700" },
    stepChildMeta: { color: colors.muted, fontSize: 11, marginTop: 1 },
    stepChildTime: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
    summaryHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
    summaryTitle: { color: colors.onBrandTertiary, fontSize: 17, fontWeight: "800" },
    summarySubtitle: { color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 17 },
    percentBadge: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 14, backgroundColor: colors.brandPrimary },
    percentText: { color: colors.onBrandPrimary, fontSize: 22, fontWeight: "800" },
    summaryStats: { flexDirection: "row", gap: 8 },
    statTile: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 10, alignItems: "center", gap: 3 },
    statValue: { fontSize: 17, fontWeight: "800" },
    statLabel: { fontSize: 12 },
    activityCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 18, padding: 16, gap: 19 },
    activityTitle: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
    activityDays: { flexDirection: "row", justifyContent: "space-between" },
    activityDay: { flex: 1, alignItems: "center", gap: 10 },
    activityWeekday: { color: colors.muted, fontSize: 11 },
    activityNumber: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
    activityDot: { width: 7, height: 7, borderRadius: 4 },
    takenBadge: { borderRadius: 6, backgroundColor: colors.brandTertiary, padding: 6 },
    takenBadgeText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" },
    missedBadge: { borderRadius: 6, backgroundColor: colors.surfaceTertiary, padding: 6 },
    missedBadgeText: { color: colors.error, fontSize: 10, fontWeight: "800" },
    pressed: { opacity: 0.8 },
  });
});
