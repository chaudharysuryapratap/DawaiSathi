import PressableScale from "@/src/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { TextInput } from "@/src/components/focus-input";
import QRCode from "react-native-qrcode-svg";
import { api } from "@/src/api";
import { displayFamilyCode, familyJoinUrl } from "@/src/family-code";
import type { FamilyGroup } from "@/src/types";
import { makeStyles, useTheme } from "@/src/theme";
import { BottomSheet } from "./bottom-sheet";

export function FamilyInviteSheet({ group, onClose }: { group: FamilyGroup | null; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const [loadedCode, setLoadedCode] = useState<{ groupId: string; code: string } | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const inFlight = useRef(false);
  const code = group && loadedCode?.groupId === group.id ? loadedCode.code : null;
  useEffect(() => {
    if (!group) return;
    let canceled = false;
    void api.familyJoinCode(group.id).then(result => {
      if (!canceled) { setLoadedCode({ groupId: group.id, code: result.code }); setError(null); }
    }).catch(e => { if (!canceled) setError(e instanceof Error ? e.message : "Could not load the family code."); });
    return () => { canceled = true; };
  }, [group, loadVersion]);
  const copy = async (value: string) => {
    try { await Clipboard.setStringAsync(value); setMessage("Copied to clipboard."); }
    catch { setError("Could not copy. Press and hold the code to copy it."); }
  };
  const sendEmail = async () => {
    if (!group || inFlight.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter a valid member email."); return; }
    inFlight.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const result = await api.createFamilyInvitation(group.id, email.trim());
      setInvitation(result.token);
      const body = `You are invited to ${group.name}'s Family on DawaiSathi.\n\nSign in or create an account with this email and invitation token:\n${result.token}\n\nThis email-specific invitation expires in 7 days. Only join a family you trust.`;
      await Linking.openURL(`mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent("DawaiSathi family invitation")}&body=${encodeURIComponent(body)}`);
      setMessage("Your email app is open. Send the invitation there.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open your email app. Copy the invitation below instead."); }
    finally { setBusy(false); inFlight.current = false; }
  };
  const close = () => { if (busy) return; setEmail(""); setInvitation(null); setMessage(null); setError(null); onClose(); };
  const badge = <View style={styles.badge}><Ionicons name="people-outline" size={22} color={colors.brandPrimary} /><Text style={styles.badgeText} numberOfLines={2}>{group ? (/\bfamily\s*$/i.test(group.name) ? group.name : `${group.name}’s Family`).toUpperCase() : ""}</Text></View>;
  return <BottomSheet visible={!!group} onClose={close} title="Invite someone to join" testID="family-invite-sheet" appearance="family" headerAccessory={badge}>
    <Text style={styles.description}>{"Share this code or QR with people you trust to join this family's health records"}</Text>
    <View style={styles.email}><Ionicons name="mail-outline" size={22} color={colors.muted} /><TextInput value={email} onChangeText={setEmail} editable={!busy} accessibilityLabel="Member email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="Enter member email" placeholderTextColor={colors.muted} style={styles.input} testID="family-invite-email" /></View>
    <PressableScale accessibilityRole="button" disabled={busy} onPress={sendEmail} testID="family-invite-send" style={[styles.send, busy && { opacity: 0.6 }]}><Text style={styles.sendLabel}>{busy ? "Preparing…" : "Send Email Invite"}</Text><Ionicons name="arrow-forward" size={24} color={colors.onBrandPrimary} /></PressableScale>
    {message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
    {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    {invitation && <View style={styles.fallback}><Text style={styles.caption}>Email invitation token</Text><Text selectable style={styles.token}>{invitation}</Text><PressableScale accessibilityRole="button" onPress={() => copy(invitation)} style={styles.copy}><Text style={styles.copyLabel}>Copy invitation</Text></PressableScale></View>}
    <View style={styles.divider} />
    <View style={styles.ticket} testID="family-code-ticket">
      <View style={styles.codeRow}>
        <View style={{ alignSelf: "stretch" }}><Text style={styles.caption}>FAMILY CODE</Text><Text selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.code} testID="family-code-value">{code ? displayFamilyCode(code) : "Loading…"}</Text></View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Copy family code" disabled={!code} onPress={() => code && copy(displayFamilyCode(code))} style={styles.copy} testID="family-code-copy"><Ionicons name="copy-outline" size={20} color={colors.brandPrimary} /><Text style={styles.copyLabel}>Copy</Text></PressableScale>
      </View>
      <View style={styles.perforation}><View style={styles.notchLeft} /><View style={styles.notchRight} /></View>
      <View style={[styles.qrRow, stacked && { flexDirection: "column" }]}>
        <View style={styles.qr}>{code ? <QRCode value={familyJoinUrl(code)} size={112} quietZone={8} /> : <PressableScale accessibilityRole="button" onPress={() => setLoadVersion(v => v + 1)} style={styles.retry}><Text style={styles.copyLabel}>Retry</Text></PressableScale>}</View>
        <Text style={styles.qrText}>Scan to open DawaiSathi and join this family, or enter the family code in “Join a family”.</Text>
      </View>
    </View>
    <Text style={styles.security}>Anyone with this code can join after signing in. Share it privately.</Text>
  </BottomSheet>;
}
const useStyles = makeStyles(colors => StyleSheet.create({
  badge: { alignSelf: "flex-start", maxWidth: "100%", flexDirection: "row", gap: 6, alignItems: "center", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.brandTertiary },
  badgeText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800", flexShrink: 1 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  email: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 11, paddingHorizontal: 9 }, input: { flex: 1, color: colors.onSurface, fontSize: 13, paddingVertical: 10 },
  send: { minHeight: 52, borderRadius: 13, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, gap: 14 }, sendLabel: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "800", flexShrink: 1 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 4 },
  ticket: { backgroundColor: "#C2E7DF", borderWidth: 1, borderColor: "#99D3C8", borderRadius: 20, padding: 12 }, codeRow: { flexDirection: "column", alignItems: "flex-start", gap: 8 },
  caption: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 2, fontWeight: "800" }, code: { color: colors.onSurface, fontSize: 20, lineHeight: 29, fontWeight: "800", letterSpacing: 1, marginTop: 7 },
  copy: { minHeight: 44, borderRadius: 13, paddingHorizontal: 10, backgroundColor: colors.brandTertiary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, copyLabel: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
  perforation: { position: "relative", marginVertical: 12, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#78B9AD" }, notchLeft: { position: "absolute", left: -23, top: -11, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface }, notchRight: { position: "absolute", right: -23, top: -11, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface },
  qrRow: { flexDirection: "row", alignItems: "center", gap: 10 }, qr: { padding: 6, backgroundColor: "#FFFFFF", borderRadius: 12 }, qrText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  security: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 18 }, error: { color: colors.error, fontSize: 13 }, message: { color: colors.brandPrimary, fontSize: 13 }, fallback: { gap: 9 }, token: { color: colors.onSurface, fontSize: 12 }, retry: { minHeight: 112, minWidth: 112, alignItems: "center", justifyContent: "center" },
}));
