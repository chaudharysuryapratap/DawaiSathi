import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/src/components/app-header";
import { ErrorState, LoadingState, ScreenShell } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { formatIsoDate, formatTime } from "@/src/dose-status";
import { makeStyles, useTheme } from "@/src/theme";
import type { DoseLog, ProtocolStepLog } from "@/src/types";

const STATUS_FILTERS = ["all", "taken", "missed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const RANGES = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "all", label: "All time" },
] as const;

type Range = (typeof RANGES)[number]["id"];

type DayEntry =
  | { kind: "dose"; time: string; log: DoseLog }
  | { kind: "protocol"; time: string; protocolId: string; protocolName: string; steps: ProtocolStepLog[] };

function groupDay(doses: DoseLog[], protocolLogs: ProtocolStepLog[]): [string, DayEntry[]][] {
  const dayMap = new Map<string, { doses: DoseLog[]; protocolSteps: ProtocolStepLog[] }>();
  doses.forEach((log) => {
    const bucket = dayMap.get(log.local_date) ?? { doses: [], protocolSteps: [] };
    bucket.doses.push(log);
    dayMap.set(log.local_date, bucket);
  });
  protocolLogs.forEach((log) => {
    const bucket = dayMap.get(log.local_date) ?? { doses: [], protocolSteps: [] };
    bucket.protocolSteps.push(log);
    dayMap.set(log.local_date, bucket);
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
    todayDoses,
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
  const [range, setRange] = useState<Range>("30");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const cutoff = useMemo(() => {
    const now = Date.now();
    if (range === "7") return now - 7 * 24 * 60 * 60 * 1000;
    if (range === "30") return now - 30 * 24 * 60 * 60 * 1000;
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

  const missedDoses = useMemo(() => todayDoses.filter((dose) => !dose.logged_at).length, [todayDoses]);
  const takenDoses = filteredDoses.length + filteredProtocolLogs.length;
  const totalDoses = takenDoses + missedDoses;
  const adherence = totalDoses ? Math.round((takenDoses / totalDoses) * 100) : 0;

  const grouped = useMemo(() => {
    if (statusFilter === "missed") return [] as [string, DayEntry[]][];
    return groupDay(filteredDoses, filteredProtocolLogs);
  }, [filteredDoses, filteredProtocolLogs, statusFilter]);

  const medicineName =
    medicineFilter === "all"
      ? "All items"
      : medicineFilter === "protocols"
        ? "Eye-drop protocols"
        : medicines.find((medicine) => medicine.id === medicineFilter)?.name ?? "All items";
  const memberName = activeMember ? activeMember.name : "Everyone";
  const rangeLabel = RANGES.find((item) => item.id === range)?.label ?? "";
  const hasProtocols = protocols.length > 0 || protocolHistory.length > 0;

  return (
    <ScreenShell testID="history-screen" header={<AppHeader />}>
      {loading ? (
        <LoadingState label="Loading your history" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <>
          <View style={styles.head}>
            <Text style={styles.eyebrow}>HISTORY</Text>
            <Text style={styles.title}>What happened?</Text>
            <Text style={styles.subtitle}>
              {memberName} · {medicineName} · {rangeLabel}
            </Text>
          </View>

          <View style={styles.adherenceCard}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.adherencePercent}>{adherence}% adherence</Text>
              <Text style={styles.adherenceMeta}>
                {takenDoses} taken · {missedDoses} pending today
              </Text>
            </View>
            <View style={styles.adherenceRing}>
              <Text style={styles.adherenceRingText}>{adherence}%</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} testID="history-member-filter">
            <FilterPill
              label="Everyone"
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} testID="history-status-filter">
            {STATUS_FILTERS.map((option) => (
              <FilterPill
                key={option}
                label={option === "all" ? "All events" : option === "taken" ? "Taken" : "Missed"}
                active={statusFilter === option}
                onPress={() => setStatusFilter(option)}
                testID={`history-filter-status-${option}`}
              />
            ))}
          </ScrollView>

          {grouped.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={30} color={colors.muted} />
              <Text style={styles.emptyTitle}>Nothing to show yet</Text>
              <Text style={styles.emptyText}>Log a dose or adjust the filters to see history here.</Text>
            </View>
          ) : (
            grouped.map(([date, entries]) => (
              <View key={date} style={styles.day}>
                <Text style={styles.dayTitle}>{formatIsoDate(entries[0].kind === "dose" ? entries[0].log.logged_at : entries[0].steps[0].logged_at)}</Text>
                <View style={styles.dayList}>
                  {entries.map((entry) => {
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
                          <Text style={styles.dayMeta}>{entry.log.dosage}</Text>
                        </View>
                        <Text style={styles.dayTime}>{formatTime(entry.log.time)}</Text>
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

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    head: { gap: 4 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
    subtitle: { color: colors.muted, fontSize: 13 },
    adherenceCard: {
      minHeight: 92,
      borderRadius: 22,
      backgroundColor: colors.brandTertiary,
      padding: 18,
      flexDirection: "row",
      alignItems: "center",
    },
    adherencePercent: { color: colors.brandPrimary, fontSize: 24, fontWeight: "800" },
    adherenceMeta: { color: colors.onSurfaceSecondary, fontSize: 13 },
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
      borderRadius: 999,
      backgroundColor: colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      flexShrink: 0,
    },
    filterPillActive: { backgroundColor: colors.brandPrimary },
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
      overflow: "hidden",
    },
    dayRow: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    dayCheck: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.success,
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
    pressed: { opacity: 0.8 },
  }),
);
