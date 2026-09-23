import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useData } from "@/src/data-context";
import { ErrorState, LoadingState, PageHeader, ScreenShell } from "@/src/components/dawai-ui";
import { makeStyles, useTheme } from "@/src/theme";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { history, loading, error, refresh } = useData();
  const [filter, setFilter] = useState<"all" | "week">("all");
  const visibleHistory = useMemo(() => filter === "all" ? history : history.filter((entry) => Date.now() - new Date(entry.logged_at).getTime() < 7 * 24 * 60 * 60 * 1000), [filter, history]);
  return <ScreenShell testID="history-screen">
    <PageHeader eyebrow="Your record" title="History" subtitle="A gentle look back at the doses you logged." />
    {loading ? <LoadingState label="Loading your history" /> : error ? <ErrorState message={error} onRetry={refresh} /> : <>
      <View style={styles.summary}><View><Text style={styles.summaryValue}>{history.length}</Text><Text style={styles.summaryLabel}>Doses logged</Text></View><View style={styles.summaryDivider} /><View><Text style={styles.summaryValue}>{new Set(history.map((entry) => entry.local_date)).size}</Text><Text style={styles.summaryLabel}>Days tracked</Text></View></View>
      <View style={styles.filters}>{(["all", "week"] as const).map((item) => <Text key={item} testID={`history-filter-${item}`} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>{item === "all" ? "All time" : "Last 7 days"}</Text>)}</View>
      {visibleHistory.length === 0 ? <View style={styles.empty}><Ionicons name="time-outline" size={30} color={colors.muted} /><Text style={styles.emptyTitle}>No doses logged yet</Text><Text style={styles.emptyText}>When you mark a dose as taken, it will appear here.</Text></View> : <View style={styles.list}>{visibleHistory.map((entry) => <View key={entry.id} style={styles.row}><View style={styles.check}><Ionicons name="checkmark" size={17} color={colors.onBrandPrimary} /></View><View style={styles.rowCopy}><Text style={styles.medicineName}>{entry.medicine_name}</Text><Text style={styles.rowDetail}>{entry.dosage} · {entry.time}</Text></View><Text style={styles.rowDate}>{formatDate(entry.logged_at)}</Text></View>)}</View>}
    </>}
  </ScreenShell>;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  summary: { borderRadius: 20, backgroundColor: colors.brandTertiary, padding: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  summaryValue: { color: colors.brandPrimary, fontSize: 28, fontWeight: "850", textAlign: "center" },
  summaryLabel: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 3, textAlign: "center" },
  summaryDivider: { width: 1, height: 42, backgroundColor: colors.brandSecondary },
  filters: { flexDirection: "row", gap: 8 },
  filter: { color: colors.muted, backgroundColor: colors.surfaceTertiary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontWeight: "700", overflow: "hidden" },
  filterActive: { color: colors.onBrandPrimary, backgroundColor: colors.brandPrimary },
  list: { gap: 1, backgroundColor: colors.divider, borderRadius: 18, overflow: "hidden" },
  row: { minHeight: 76, paddingHorizontal: 14, backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "center", gap: 12 },
  check: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 3 },
  medicineName: { color: colors.onSurface, fontSize: 15, fontWeight: "750" },
  rowDetail: { color: colors.muted, fontSize: 13 },
  rowDate: { color: colors.muted, fontSize: 11 },
  empty: { alignItems: "center", padding: 28, gap: 9 },
  emptyTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
}));