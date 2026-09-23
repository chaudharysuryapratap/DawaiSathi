import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { PageHeader, ScreenShell } from "@/src/components/dawai-ui";
import { makeStyles, useTheme } from "@/src/theme";

function SettingRow({ icon, title, subtitle, children, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; children?: React.ReactNode; onPress?: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.rowIcon}><Ionicons name={icon} size={20} color={colors.brandPrimary} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text>{subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}</View>{children ?? <Ionicons name="chevron-forward" size={19} color={colors.muted} />}</Pressable>;
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [reminders, setReminders] = useState(true);
  const [sound, setSound] = useState(true);
  return <ScreenShell testID="settings-screen">
    <PageHeader eyebrow="Preferences" title="Settings" subtitle="Make DawaiSathi feel right for you." />
    <Text style={styles.groupTitle}>REMINDERS</Text>
    <View style={styles.group}><SettingRow icon="notifications-outline" title="Medicine reminders" subtitle={reminders ? "You’ll be reminded at your set times" : "Reminders are paused"}><Switch testID="reminders-switch" accessibilityLabel="Medicine reminders" value={reminders} onValueChange={setReminders} trackColor={{ false: colors.borderStrong, true: colors.brandSecondary }} thumbColor={colors.onBrandPrimary} /></SettingRow><View style={styles.divider} /><SettingRow icon="volume-medium-outline" title="Reminder sound" subtitle={sound ? "Sound is on" : "Sound is off"}><Switch testID="sound-switch" accessibilityLabel="Reminder sound" value={sound} onValueChange={setSound} trackColor={{ false: colors.borderStrong, true: colors.brandSecondary }} thumbColor={colors.onBrandPrimary} /></SettingRow></View>
    <Text style={styles.groupTitle}>APP</Text>
    <View style={styles.group}><SettingRow icon="person-outline" title="My profile" subtitle="Your personal medicine space" /><View style={styles.divider} /><SettingRow icon="shield-checkmark-outline" title="Privacy" subtitle="Your health details stay private" /><View style={styles.divider} /><SettingRow icon="help-circle-outline" title="Help & support" subtitle="Get answers about DawaiSathi" /></View>
    <View style={styles.footer}><Ionicons name="heart-outline" size={18} color={colors.brandPrimary} /><Text style={styles.footerText}>DawaiSathi · simpler days, one dose at a time</Text><Text style={styles.version}>Version 1.0</Text></View>
  </ScreenShell>;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  groupTitle: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginTop: 4 },
  group: { borderRadius: 18, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 14, overflow: "hidden" },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12 },
  pressed: { opacity: 0.7 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  rowSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  divider: { height: 1, backgroundColor: colors.divider, marginLeft: 50 },
  footer: { alignItems: "center", gap: 7, paddingVertical: 12 },
  footerText: { color: colors.onSurfaceSecondary, fontSize: 13, textAlign: "center" },
  version: { color: colors.muted, fontSize: 12 },
}));