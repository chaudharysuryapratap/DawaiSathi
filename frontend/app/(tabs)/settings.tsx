import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { AppHeader } from "@/src/components/app-header";
import { LoadingState, ScreenShell } from "@/src/components/dawai-ui";
import { api } from "@/src/api";
import { makeStyles, useTheme } from "@/src/theme";
import type { NotificationPreference } from "@/src/types";

const defaults: NotificationPreference = {
  medicine_reminders: true,
  checkup_reminders: true,
  reminder_sound: true,
  voice_reminders: false,
  push_enabled: false,
  whatsapp_linked: false,
  telegram_linked: false,
};

function Row({
  icon,
  title,
  subtitle,
  children,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.pressed : null]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={19} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {children ?? <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [preferences, setPreferences] = useState<NotificationPreference>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const remote = await api.notificationPreferences();
        setPreferences(remote);
      } catch {
        // keep defaults if the request fails
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = async <K extends keyof NotificationPreference>(key: K, value: NotificationPreference[K]) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    try {
      await api.saveNotificationPreferences(next);
    } catch {
      // ignore save failures in preview
    }
  };

  return (
    <ScreenShell testID="settings-screen" header={<AppHeader />}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>PREFERENCES</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Configuration — never daily medication actions.</Text>
      </View>

      {loading ? (
        <LoadingState label="Loading preferences" />
      ) : (
        <>
          <Group label="Account">
            <Row icon="person-circle-outline" title="Profile" subtitle="Manage your DawaiSathi profile" testID="settings-profile" onPress={() => {}} />
            <Row icon="key-outline" title="Authentication" subtitle="Google sign-in and secure login" testID="settings-auth" onPress={() => {}} />
            <Row icon="log-out-outline" title="Log out" subtitle="Sign out on this device" testID="settings-logout" onPress={() => {}} />
          </Group>

          <Group label="Notifications">
            <Row
              icon="notifications-outline"
              title="Medicine reminders"
              subtitle={preferences.medicine_reminders ? "You'll be reminded at your set times" : "Reminders paused"}
              testID="settings-medicine-reminders"
            >
              <Switch
                testID="switch-medicine-reminders"
                value={preferences.medicine_reminders}
                onValueChange={(value) => update("medicine_reminders", value)}
                trackColor={{ false: colors.borderStrong, true: colors.brandSecondary }}
                thumbColor={colors.onBrandPrimary}
              />
            </Row>
            <Row
              icon="calendar-outline"
              title="Checkup reminders"
              subtitle={preferences.checkup_reminders ? "Upcoming checkups will notify you" : "Off"}
              testID="settings-checkup-reminders"
            >
              <Switch
                testID="switch-checkup-reminders"
                value={preferences.checkup_reminders}
                onValueChange={(value) => update("checkup_reminders", value)}
                trackColor={{ false: colors.borderStrong, true: colors.brandSecondary }}
                thumbColor={colors.onBrandPrimary}
              />
            </Row>
            <Row
              icon="volume-medium-outline"
              title="Reminder sound"
              subtitle={preferences.reminder_sound ? "Sound is on" : "Sound is off"}
              testID="settings-sound"
            >
              <Switch
                testID="switch-reminder-sound"
                value={preferences.reminder_sound}
                onValueChange={(value) => update("reminder_sound", value)}
                trackColor={{ false: colors.borderStrong, true: colors.brandSecondary }}
                thumbColor={colors.onBrandPrimary}
              />
            </Row>
            <Row
              icon="mic-outline"
              title="Voice reminders"
              subtitle={preferences.voice_reminders ? "Enabled" : "Silent"}
              testID="settings-voice"
            >
              <Switch
                testID="switch-voice-reminders"
                value={preferences.voice_reminders}
                onValueChange={(value) => update("voice_reminders", value)}
                trackColor={{ false: colors.borderStrong, true: colors.brandSecondary }}
                thumbColor={colors.onBrandPrimary}
              />
            </Row>
            <Row
              icon="phone-portrait-outline"
              title="Push notifications"
              subtitle={preferences.push_enabled ? "Enabled after deploying a build" : "Enable after a production build"}
              testID="settings-push"
            >
              <Switch
                testID="switch-push"
                value={preferences.push_enabled}
                onValueChange={(value) => update("push_enabled", value)}
                trackColor={{ false: colors.borderStrong, true: colors.brandSecondary }}
                thumbColor={colors.onBrandPrimary}
              />
            </Row>
          </Group>

          <Group label="Integrations">
            <Row
              icon="logo-whatsapp"
              title="WhatsApp"
              subtitle={preferences.whatsapp_linked ? "Linked" : "Send reminders to WhatsApp"}
              testID="settings-whatsapp"
            >
              <Switch
                testID="switch-whatsapp"
                value={preferences.whatsapp_linked}
                onValueChange={(value) => update("whatsapp_linked", value)}
                trackColor={{ false: colors.borderStrong, true: colors.brandSecondary }}
                thumbColor={colors.onBrandPrimary}
              />
            </Row>
            <Row
              icon="paper-plane-outline"
              title="Telegram"
              subtitle={preferences.telegram_linked ? "Linked" : "Send reminders to Telegram"}
              testID="settings-telegram"
            >
              <Switch
                testID="switch-telegram"
                value={preferences.telegram_linked}
                onValueChange={(value) => update("telegram_linked", value)}
                trackColor={{ false: colors.borderStrong, true: colors.brandSecondary }}
                thumbColor={colors.onBrandPrimary}
              />
            </Row>
          </Group>

          <Group label="Family & Privacy">
            <Row icon="people-outline" title="Family access" subtitle="Who can view and manage" testID="settings-family-access" onPress={() => {}} />
            <Row icon="shield-checkmark-outline" title="Privacy" subtitle="Your health details stay private" testID="settings-privacy" onPress={() => {}} />
          </Group>

          <Group label="App">
            <Row icon="color-palette-outline" title="Appearance" subtitle="Light theme — dark coming soon" testID="settings-appearance" onPress={() => {}} />
            <Row icon="language-outline" title="Language" subtitle="English" testID="settings-language" onPress={() => {}} />
            <Row icon="time-outline" title="Timezone" subtitle="Auto" testID="settings-timezone" onPress={() => {}} />
            <Row icon="cloud-outline" title="Offline & sync" subtitle="Local caching on this device" testID="settings-offline" onPress={() => {}} />
          </Group>

          <Group label="About">
            <Row icon="help-circle-outline" title="Help & support" subtitle="Get answers about DawaiSathi" testID="settings-help" onPress={() => {}} />
            <Row icon="document-text-outline" title="Privacy policy" subtitle="How we protect your data" testID="settings-policy" onPress={() => {}} />
            <Row icon="reader-outline" title="Terms" subtitle="Terms of service" testID="settings-terms" onPress={() => {}} />
            <Row icon="information-circle-outline" title="App information" subtitle="Version 1.0" testID="settings-app-info" />
          </Group>
        </>
      )}
    </ScreenShell>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label.toUpperCase()}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    head: { gap: 4 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    group: { gap: 8 },
    groupLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    groupBody: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 20,
      paddingHorizontal: 14,
      overflow: "hidden",
    },
    row: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
    },
    rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "750" },
    rowSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
    pressed: { opacity: 0.85 },
  }),
);
