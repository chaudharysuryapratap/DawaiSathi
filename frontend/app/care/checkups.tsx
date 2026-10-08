import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { ErrorState, LoadingState, PrimaryButton, ScreenShell } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";
import type { Checkup } from "@/src/types";
import { checkupSchedule } from "@/src/checkup-schedule";

export function checkupWhen(value: string) {
  const date = new Date(value), today = new Date(), tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const day = date.toDateString() === today.toDateString() ? "Today" : date.toDateString() === tomorrow.toDateString() ? "Tomorrow" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${day}, ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
export default function CheckupsScreen() {
  const router = useRouter(), params = useLocalSearchParams<{ id?: string; past?: string; message?: string }>();
  const { checkups, members, loading, error, refresh, removeCheckup } = useData();
  const { colors } = useTheme(), styles = useStyles();
  const [now, setNow] = useState(() => Date.now());
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [deleteError, setDeleteError] = useState("");
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 30000); const listener = AppState.addEventListener("change", state => { if (state === "active") setNow(Date.now()); }); return () => { clearInterval(tick); listener.remove(); }; }, []);
  const { upcoming, past } = checkupSchedule(checkups, new Date(now));
  const selected = checkups.find(item => item.id === params.id);
  const owner = (item: Checkup) => members.find(member => member.id === item.member_id)?.name ?? "Family";
  const card = (item: Checkup, next = false) => <Pressable key={item.id} accessibilityRole="button" testID={`checkup-row-${item.id}`} onPress={() => router.push({ pathname: "/care/checkups", params: { id: item.id } })} style={[styles.card, next && styles.next]}>
    {next ? <Text style={styles.section}>Next checkup</Text> : null}
    <View style={styles.row}><Ionicons name="calendar-outline" size={30} color={colors.brandPrimary} /><View style={{ flex: 1, gap: 5 }}><Text style={styles.cardTitle}>{item.title}</Text>{item.doctor ? <Text style={styles.meta}>{item.doctor}</Text> : null}<Text style={styles.meta}>{checkupWhen(item.scheduled_at)}</Text><Text style={styles.meta}>{next && item.location ? item.location : owner(item)}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></View>
  </Pressable>;
  const remove = async () => { if (!selected || busy) return; setBusy(true); setDeleteError(""); try { await removeCheckup(selected.id); setConfirm(false); router.replace("/care/checkups"); } catch (e) { setDeleteError(e instanceof Error ? e.message : "Could not delete checkup. Try again."); } finally { setBusy(false); } };
  return <ScreenShell testID="checkups-screen">
    <Stack.Screen options={{ title: params.id ? "Checkup details" : params.past ? "Past checkups" : "Checkups" }} />
    {loading ? <LoadingState label="Loading checkups" /> : error ? <ErrorState message={error} onRetry={refresh} /> : params.id ? selected ? <>
      <View style={[styles.card, styles.next]}><Text style={styles.title}>{selected.title}</Text><Text style={styles.meta}>For {owner(selected)}</Text>{selected.doctor ? <Text style={styles.meta}>{selected.doctor}</Text> : null}<Text style={styles.meta}>{checkupWhen(selected.scheduled_at)}</Text>{selected.location ? <Text style={styles.meta}>{selected.location}</Text> : null}</View>
      {new Date(selected.scheduled_at).getTime() < now ? <PrimaryButton label="Add as new checkup" icon="calendar-outline" onPress={() => router.push({ pathname: "/add-checkup", params: { copyId: selected.id } })} /> : <><PrimaryButton label="Edit checkup" icon="pencil-outline" variant="secondary" onPress={() => router.push({ pathname: "/add-checkup", params: { id: selected.id } })} /><PrimaryButton label="Delete checkup" icon="trash-outline" variant="danger" onPress={() => setConfirm(true)} /></>}
      {selected.notes ? <View style={styles.card}><Text style={styles.section}>Notes</Text><Text style={styles.meta}>{selected.notes}</Text></View> : null}
    </> : <Text style={styles.meta}>This checkup is no longer available.</Text> : params.past ? <><Text style={styles.title}>Past checkups</Text><Text style={styles.meta}>Previous scheduled doctor visits.</Text>{past.length ? past.map(item => card(item)) : <Text style={styles.meta}>No past checkups.</Text>}</> : <>
      <View style={{ gap: 5 }}><Text style={styles.title}>Checkups</Text><Text style={styles.meta}>Keep track of doctor visits and checkups.</Text></View>
      {params.message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.success }}>{params.message}</Text> : null}
      {upcoming.length ? card(upcoming[0], true) : <View style={styles.empty}>
        <Svg width={156} height={156} viewBox="0 0 156 156" accessible={false}>
          <Circle cx={72} cy={82} r={61} fill="#EAF6F3" />
          <Rect x={45} y={56} width={56} height={55} rx={6} fill="none" stroke={colors.brandPrimary} strokeWidth={3} />
          <Line x1={45} y1={70} x2={101} y2={70} stroke={colors.brandPrimary} strokeWidth={3} />
          <Line x1={57} y1={50} x2={57} y2={61} stroke={colors.brandPrimary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={89} y1={50} x2={89} y2={61} stroke={colors.brandPrimary} strokeWidth={3} strokeLinecap="round" />
          {[[79,79],[90,79],[57,90],[68,90],[79,90],[90,90],[57,101],[68,101],[79,101]].map(([x,y]) => <Rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} rx={0.7} fill={colors.brandPrimary} />)}
          <Line x1={128} y1={35} x2={134} y2={28} stroke={colors.brandPrimary} strokeWidth={2.5} strokeLinecap="round" />
          <Line x1={135} y1={46} x2={144} y2={44} stroke={colors.brandPrimary} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
        <Text style={styles.cardTitle}>No upcoming checkups</Text><Text style={[styles.meta, { textAlign: "center" }]}>Add your next doctor visit so you do not forget it.</Text></View>}
      <PrimaryButton label="Add checkup" icon="add" onPress={() => router.push("/add-checkup")} testID="checkups-add" />
      {upcoming.length > 1 ? <><Text style={styles.section}>Upcoming checkups</Text>{upcoming.slice(1).map(item => card(item))}</> : null}
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/care/checkups", params: { past: "1" } })} style={[styles.card, styles.row]} testID="past-checkups"><Ionicons name="time-outline" size={26} color={colors.brandPrimary} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Past checkups</Text><Text style={styles.meta}>View your previous visits</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>
    </>}
    <BottomSheet visible={confirm} onClose={() => { if (!busy) setConfirm(false); }} title="Delete this checkup?" description="This checkup will be permanently removed.">
      {deleteError ? <Text style={{ color: colors.error }}>{deleteError}</Text> : null}<PrimaryButton label="Keep checkup" variant="secondary" disabled={busy} onPress={() => setConfirm(false)} /><PrimaryButton label={busy ? "Deleting…" : "Delete checkup"} variant="danger" disabled={busy} onPress={remove} />
    </BottomSheet>
  </ScreenShell>;
}
const useStyles = makeStyles(colors => StyleSheet.create({ title: { color: colors.onSurface, fontSize: 24, fontWeight: "800" }, section: { color: colors.onSurface, fontSize: 17, fontWeight: "800" }, cardTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" }, meta: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21 }, card: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surfaceSecondary, gap: 10 }, next: { backgroundColor: colors.brandTertiary }, row: { flexDirection: "row", alignItems: "center", gap: 12 }, empty: { alignItems: "center", gap: 14, paddingVertical: 30 } }));
