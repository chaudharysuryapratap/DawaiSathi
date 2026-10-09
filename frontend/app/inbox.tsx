import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Text, View } from "react-native";
import { api } from "@/src/api";
import { ScreenShell } from "@/src/components/dawai-ui";
import PressableScale from "@/src/components/ui/PressableScale";
import { useData } from "@/src/data-context";
import { formatIsoDateTime } from "@/src/dose-status";
import { makeStyles, useTheme } from "@/src/theme";
import type { AttentionItem } from "@/src/types";
import { RoundBackButton } from "@/src/components/round-back-button";
import { useReduceMotion } from "@/src/components/ui/useReduceMotion";

export default function InboxScreen() {
  const { activeFamilyGroupId } = useData();
  return <InboxContent key={activeFamilyGroupId ?? "no-family"} familyGroupId={activeFamilyGroupId}/>;
}

export function InboxContent({ familyGroupId: activeFamilyGroupId }: { familyGroupId: string | null }) {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { activeFamilyGroup, members } = useData();
  const [filter, setFilter] = useState<"all" | "missed">("all");
  const [filterWidth, setFilterWidth] = useState(0);
  const [selection] = useState(() => new Animated.Value(0));
  const reduced = useReduceMotion();
  useEffect(() => {
    if (reduced) { selection.stopAnimation(); selection.setValue(filter === "missed" ? 1 : 0); }
  }, [reduced, filter, selection]);
  useEffect(() => () => selection.stopAnimation(), [selection]);
  const selectFilter = (value: "all" | "missed") => {
    if (value === filter) return;
    setFilter(value);
    selection.stopAnimation();
    if (reduced) selection.setValue(value === "missed" ? 1 : 0);
    else Animated.timing(selection, { toValue: value === "missed" ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  };
  const [data, setData] = useState<{ group: string | null; items: AttentionItem[] }>({ group: null, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState<string[]>([]);
  const [requested, setRequested] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const locks = useRef(new Set<string>());
  const requestIds = useRef(new Map<string, string>());
  const mounted = useRef(false);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    void (activeFamilyGroupId ? api.inbox(activeFamilyGroupId) : Promise.resolve({ items: [] })).then(result => {
      if (active) setData({ group: activeFamilyGroupId, items: result.items });
    }).catch(() => { if (active) setError("Could not load your inbox. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, [activeFamilyGroupId, retry]);
  const items = data.group === activeFamilyGroupId ? data.items : [];
  const missed = items.filter(item => item.kind === "missed-dose");
  const shown = filter === "missed" ? missed : items;
  const resend = useCallback(async (item: AttentionItem) => {
    const group = activeFamilyGroupId;
    if (!group || locks.current.has(item.id)) return;
    locks.current.add(item.id); setSending(value => [...value, item.id]); setError("");
    try {
      const requestId = requestIds.current.get(item.id) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      requestIds.current.set(item.id, requestId);
      const record = await api.resendReminder(group, item.id, requestId);
      if (!mounted.current) return;
      setData(value => ({ group, items: [record, ...value.items] }));
      setRequested(value => [...value, item.id]);
      AccessibilityInfo.announceForAccessibility("Reminder requested. Delivery is pending.");
    } catch (e) {
      locks.current.delete(item.id);
      if (mounted.current) setError(e instanceof Error ? e.message : "Could not request a reminder. Please try again.");
    } finally {
      if (mounted.current) setSending(value => value.filter(id => id !== item.id));
    }
  }, [activeFamilyGroupId]);
  return <ScreenShell testID="inbox-screen">
    <View style={styles.header}>
      <RoundBackButton onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/"); }}/>
      <View style={{ flex: 1, gap: 6 }}><Text style={styles.heading}>Inbox</Text><Text style={styles.subtitle}>Reminders and alerts from your family</Text></View>
    </View>
    <View accessibilityRole="tablist" style={styles.filters} onLayout={event => setFilterWidth(event.nativeEvent.layout.width)}>
      {filterWidth > 12 && <Animated.View pointerEvents="none" testID="inbox-filter-indicator" style={[styles.indicator, { width: (filterWidth - 12) / 2, transform: [{ translateX: selection.interpolate({ inputRange: [0, 1], outputRange: [0, (filterWidth - 4) / 2] }) }] }]}/>}
      {(["all", "missed"] as const).map(value => <PressableScale key={value} scaleTo={0.94} accessibilityRole="tab" accessibilityState={{ selected: filter === value }} aria-selected={filter === value} onPress={() => selectFilter(value)} style={styles.filter}><Text style={[styles.filterText, filter === value && styles.selectedText]}>{value === "all" ? `All (${items.length})` : `Missed (${missed.length})`}</Text></PressableScale>)}
    </View>
    {loading && <Text style={styles.subtitle}>Loading inbox…</Text>}
    {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    {!!error && items.length === 0 && <PressableScale onPress={() => { setLoading(true); setError(""); setRetry(value => value + 1); }} style={styles.resend}><Text style={styles.resendText}>Try again</Text></PressableScale>}
    {!loading && !error && shown.length === 0 && <View style={styles.empty}><Ionicons name="notifications-outline" size={36} color={colors.brandPrimary}/><Text style={styles.title}>{filter === "missed" ? "No missed doses" : "No reminders yet"}</Text></View>}
    {shown.map(item => {
      const isMissed = item.kind === "missed-dose";
      const member = members.find(value => value.id === item.member_id);
      const pending = sending.includes(item.id);
      const done = requested.includes(item.id);
      return <View key={item.id} testID={`inbox-item-${item.id}`} style={styles.card}>
        <View style={[styles.tile, isMissed && styles.missedTile]}><Ionicons name={isMissed ? "alert-circle-outline" : "notifications-outline"} size={24} color={isMissed ? colors.error : colors.brandPrimary}/></View>
        <View style={styles.content}>
          <Text style={styles.category}>{isMissed ? "MISSED DOSE" : item.kind === "reminder" ? item.delivery_status === "sent" ? "REMINDER SENT" : item.delivery_status === "failed" ? "REMINDER FAILED" : "REMINDER PENDING" : "REMINDER"} · {activeFamilyGroup?.name}</Text>
          <Text style={styles.title}>{item.title}{member ? ` · ${member.name}` : ""}</Text>
          <Text style={styles.detail}>{item.detail}</Text>
          <Text style={styles.when}>{formatIsoDateTime(item.when)}</Text>
          {item.delivery_status === "pending" && <Text style={styles.subtitle}>Saved as a request. Notification delivery is not connected yet.</Text>}
          {item.can_resend && <PressableScale disabled={pending || done} accessibilityLabel="Send reminder again" accessibilityState={{ disabled: pending || done, busy: pending }} onPress={() => { void resend(item); }} style={styles.resend}><Text style={styles.resendText}>{pending ? "Requesting…" : done ? "Reminder requested" : "Send reminder again"}</Text></PressableScale>}
        </View>
      </View>;
    })}
  </ScreenShell>;
}

const useStyles = makeStyles(colors => ({
  header: { flexDirection: "row", gap: 14, alignItems: "center", paddingVertical: 8 },
  heading: { fontSize: 28, fontWeight: "700", color: colors.onSurface },
  subtitle: { fontSize: 14, color: colors.onSurfaceTertiary },
  filters: { flexDirection: "row", padding: 4, borderRadius: 16, backgroundColor: colors.surfaceTertiary, gap: 4 },
  filter: { flex: 1, minHeight: 48, padding: 10, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  indicator: { position: "absolute", left: 4, top: 4, bottom: 4, borderRadius: 12, backgroundColor: colors.surface },
  filterText: { fontSize: 17, fontWeight: "500", color: colors.onSurfaceTertiary },
  selectedText: { fontWeight: "700", color: colors.brandPrimary },
  card: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, flexDirection: "row", gap: 12 },
  tile: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  missedTile: { backgroundColor: "#FCE5E5" },
  content: { flex: 1, minWidth: 0, gap: 8 },
  category: { fontSize: 12, fontWeight: "600", color: colors.onSurfaceTertiary },
  title: { fontSize: 17, fontWeight: "600", color: colors.onSurface },
  detail: { fontSize: 16, color: colors.onSurfaceSecondary },
  when: { fontSize: 13, color: colors.onSurfaceTertiary },
  resend: { minHeight: 48, padding: 12, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  resendText: { fontSize: 15, fontWeight: "600", color: colors.onBrandPrimary, textAlign: "center" },
  error: { fontSize: 14, color: colors.error },
  empty: { padding: 32, gap: 12, alignItems: "center" },
}));
