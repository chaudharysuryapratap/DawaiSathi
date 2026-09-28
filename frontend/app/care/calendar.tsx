import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingState, PrimaryButton } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { history, todayDoses, checkups, medicines, loading, activeMember } = useData();

  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(() => toKey(new Date()));

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const startWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const cells = useMemo(() => {
    const list: (string | null)[] = [];
    for (let index = 0; index < startWeekday; index += 1) list.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      list.push(toKey(date));
    }
    return list;
  }, [month, daysInMonth, startWeekday]);

  const eventsForDate = useMemo(() => {
    const map = new Map<string, { doses: number; checkups: number }>();
    history.forEach((log) => {
      const entry = map.get(log.local_date) ?? { doses: 0, checkups: 0 };
      entry.doses += 1;
      map.set(log.local_date, entry);
    });
    todayDoses.forEach((dose) => {
      const key = toKey(new Date());
      if (dose.logged_at) return;
      const entry = map.get(key) ?? { doses: 0, checkups: 0 };
      entry.doses += 0;
      map.set(key, entry);
    });
    checkups.forEach((checkup) => {
      const dateKey = checkup.scheduled_at.slice(0, 10);
      const entry = map.get(dateKey) ?? { doses: 0, checkups: 0 };
      entry.checkups += 1;
      map.set(dateKey, entry);
    });
    return map;
  }, [history, todayDoses, checkups]);

  const eventsForSelected = useMemo(() => {
    const dayLogs = history.filter((log) => log.local_date === selectedDate);
    const dayCheckups = checkups.filter((checkup) => checkup.scheduled_at.startsWith(selectedDate));
    const scheduledMedicines = selectedDate === toKey(new Date())
      ? todayDoses
      : medicines.flatMap((medicine) =>
          medicine.times.map((time) => ({
            key: `${medicine.id}-${time}`,
            name: medicine.name,
            dosage: medicine.dosage,
            time,
          })),
        );
    return { dayLogs, dayCheckups, scheduledMedicines };
  }, [history, checkups, selectedDate, todayDoses, medicines]);

  const shiftMonth = (delta: number) => {
    const next = new Date(month);
    next.setMonth(next.getMonth() + delta);
    setMonth(startOfMonth(next));
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Schedule" }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>SCHEDULE</Text>
          <Text style={styles.title}>Calendar & checkups</Text>
          <Text style={styles.subtitle}>Medicines and doctor visits together — {activeMember?.name ?? "everyone"}.</Text>
        </View>

        <View style={styles.viewToggle}>
          {(["calendar", "list"] as const).map((option) => (
            <Pressable
              key={option}
              testID={`calendar-view-${option}`}
              onPress={() => setView(option)}
              style={({ pressed }) => [styles.toggle, view === option && styles.toggleActive, pressed && styles.pressed]}
            >
              <Text style={[styles.toggleText, view === option && styles.toggleTextActive]}>
                {option === "calendar" ? "Calendar" : "List"}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <LoadingState label="Loading schedule" />
        ) : view === "calendar" ? (
          <>
            <View style={styles.monthHeader}>
              <Pressable onPress={() => shiftMonth(-1)} style={({ pressed }) => [styles.monthNav, pressed && styles.pressed]} testID="calendar-prev-month">
                <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
              </Pressable>
              <Text style={styles.monthTitle}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
              <Pressable onPress={() => shiftMonth(1)} style={({ pressed }) => [styles.monthNav, pressed && styles.pressed]} testID="calendar-next-month">
                <Ionicons name="chevron-forward" size={18} color={colors.onSurface} />
              </Pressable>
            </View>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((label) => (
                <Text key={label} style={styles.weekdayLabel}>{label}</Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((cell, index) => {
                if (!cell) return <View key={index} style={styles.cell} />;
                const isSelected = selectedDate === cell;
                const isToday = cell === toKey(new Date());
                const events = eventsForDate.get(cell);
                return (
                  <Pressable
                    key={index}
                    onPress={() => setSelectedDate(cell)}
                    testID={`calendar-day-${cell}`}
                    style={({ pressed }) => [styles.cell, isSelected && styles.cellSelected, pressed && styles.pressed]}
                  >
                    <Text style={[styles.cellText, isToday && styles.cellToday, isSelected && styles.cellTextSelected]}>
                      {parseInt(cell.split("-")[2], 10)}
                    </Text>
                    <View style={styles.cellDots}>
                      {events && events.doses > 0 ? <View style={[styles.dot, { backgroundColor: colors.brandPrimary }]} /> : null}
                      {events && events.checkups > 0 ? <View style={[styles.dot, { backgroundColor: colors.info }]} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <View style={styles.detail}>
          <Text style={styles.detailTitle}>
            {new Date(selectedDate).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
          </Text>
          {eventsForSelected.dayCheckups.length > 0 ? (
            <>
              <Text style={styles.detailSection}>CHECKUPS</Text>
              {eventsForSelected.dayCheckups.map((checkup) => (
                <Pressable
                  key={checkup.id}
                  testID={`calendar-checkup-${checkup.id}`}
                  onPress={() => router.push({ pathname: "/care/checkups", params: { id: checkup.id } })}
                  style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}
                >
                  <View style={[styles.detailIcon, { backgroundColor: colors.info }]}>
                    <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailPrimary}>{checkup.title}</Text>
                    <Text style={styles.detailMeta}>{checkup.doctor || checkup.location || "Checkup"}</Text>
                  </View>
                  <Text style={styles.detailTime}>{new Date(checkup.scheduled_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</Text>
                </Pressable>
              ))}
            </>
          ) : null}
          <Text style={styles.detailSection}>MEDICATIONS</Text>
          {eventsForSelected.scheduledMedicines.length === 0 ? (
            <Text style={styles.emptyText}>No medications scheduled.</Text>
          ) : (
            eventsForSelected.scheduledMedicines.map((item: { key?: string; dose_id?: string; medicine_name?: string; name?: string; dosage: string; time: string }) => (
              <View key={item.dose_id ?? item.key ?? `${item.name}-${item.time}`} style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="medical" size={16} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailPrimary}>{item.medicine_name ?? item.name}</Text>
                  <Text style={styles.detailMeta}>{item.dosage}</Text>
                </View>
                <Text style={styles.detailTime}>{item.time}</Text>
              </View>
            ))
          )}
          {eventsForSelected.dayLogs.length > 0 ? (
            <>
              <Text style={styles.detailSection}>LOGGED</Text>
              {eventsForSelected.dayLogs.map((log) => (
                <View key={log.id} style={styles.detailRow}>
                  <View style={[styles.detailIcon, { backgroundColor: colors.success }]}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailPrimary}>{log.medicine_name}</Text>
                    <Text style={styles.detailMeta}>{log.dosage}</Text>
                  </View>
                  <Text style={styles.detailTime}>{log.time}</Text>
                </View>
              ))}
            </>
          ) : null}
        </View>

        <PrimaryButton label="Add checkup" icon="calendar" onPress={() => router.push("/add-checkup")} testID="calendar-add-checkup" />
      </ScrollView>
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
    viewToggle: { flexDirection: "row", gap: 8 },
    toggle: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    toggleActive: { backgroundColor: colors.brandPrimary },
    toggleText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
    toggleTextActive: { color: colors.onBrandPrimary },
    monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    monthNav: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    monthTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
    weekdayRow: { flexDirection: "row" },
    weekdayLabel: { flex: 1, textAlign: "center", color: colors.muted, fontSize: 12, fontWeight: "700" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    cell: {
      width: "13.4%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: colors.surfaceSecondary,
    },
    cellSelected: { backgroundColor: colors.brandPrimary },
    cellText: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
    cellToday: { color: colors.brandPrimary },
    cellTextSelected: { color: colors.onBrandPrimary },
    cellDots: { flexDirection: "row", gap: 3, marginTop: 3 },
    dot: { width: 5, height: 5, borderRadius: 3 },
    detail: { gap: 10, backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: 16 },
    detailTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
    detailSection: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 4 },
    detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
    detailIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
    },
    detailPrimary: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
    detailMeta: { color: colors.muted, fontSize: 12, marginTop: 1 },
    detailTime: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
    emptyText: { color: colors.muted, fontSize: 13 },
    pressed: { opacity: 0.85 },
  }),
);
