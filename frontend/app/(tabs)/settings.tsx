import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer } from "expo-audio";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useAuth } from "@/src/auth-context";
import { api } from "@/src/api";
import { ScreenShell } from "@/src/components/dawai-ui";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { SettingsButton, SettingsGroup, SettingsRow, SettingsToggle, settingsStyles as styles } from "@/src/components/settings-ui";
import PressableScale from "@/src/components/ui/PressableScale";
import type { NotificationPreference } from "@/src/types";
import { setHapticsEnabled, useHapticsEnabled } from "@/src/utils/haptic-preference";
import { setTextSize, useTextSize, type TextSize } from "@/src/utils/text-size";
import { press } from "@/src/utils/haptics";
const defaults: NotificationPreference = { medicine_reminders: true, checkup_reminders: true, eye_drop_reminders: true, reminder_sound: true, voice_reminders: false, push_enabled: false, whatsapp_linked: false, telegram_linked: false };
const sounds = [
    { name: "Gentle", source: require("../../assets/sounds/gentle.wav") },
    { name: "Chime", source: require("../../assets/sounds/chime.wav") },
    { name: "Bell", source: require("../../assets/sounds/bell.wav") },
    { name: "Soft", source: require("../../assets/sounds/soft.wav") },
];
export default function SettingsScreen() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const hapticFeedback = useHapticsEnabled();
    const textSize = useTextSize();
    const [preferences, setPreferences] = useState(defaults);
    const current = useRef(defaults);
    const revision = useRef(0);
    const saveQueue = useRef(Promise.resolve());
    const confirmed = useRef(defaults);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [sheet, setSheet] = useState<"sound" | "text" | "telegram" | "logout" | null>(null);
    const [sound, setSound] = useState("Gentle");
    const [busy, setBusy] = useState(false);
    const player = useAudioPlayer(null);
    const localKey = `dawaisathi.reminder-audio:${user?.id ?? ""}`;
    useEffect(() => {
        let active = true;
        void api.notificationPreferences().then(value => { if (active) {
            current.current = value;
            confirmed.current = value;
            setPreferences(value);
            setReady(true);
        } }).catch(() => { if (active)
            setError("Could not load preferences. Reopen Settings to try again."); });
        void AsyncStorage.getItem(localKey).then(value => { if (!active || !value)
            return; const saved = JSON.parse(value); if (sounds.some(s => s.name === saved.sound))
            setSound(saved.sound); }).catch(() => { });
        return () => { active = false; player.pause(); };
    }, [localKey, player]);
    const update = (key: keyof NotificationPreference, value: boolean) => {
        if (!ready)
            return;
        const before = current.current;
        const next = { ...before, [key]: value };
        const version = ++revision.current;
        current.current = next;
        setPreferences(next);
        setError("");
        saveQueue.current = saveQueue.current.then(async () => {
            try {
                confirmed.current = await api.saveNotificationPreferences(next);
            }
            catch {
                if (revision.current === version) {
                    current.current = confirmed.current;
                    setPreferences(confirmed.current);
                    setError("Could not save this change. Please try again.");
                }
            }
        });
    };
    const storeSound = async (nextSound: string) => { await AsyncStorage.mergeItem(localKey, JSON.stringify({ sound: nextSound })); setSound(nextSound); };
    const close = () => { player.pause(); if (!busy)
        setSheet(null); };
    const toggle = (label: string, key: keyof NotificationPreference) => <SettingsToggle label={label} disabled={!ready} value={preferences[key] ?? true} onChange={value => update(key, value)}/>;
    const preview = (source: number | string) => { try {
        player.replace(source);
        player.play();
    }
    catch {
        setError("Could not play this sound.");
    } };
    return <ScreenShell testID="settings-screen"><Text style={styles.title}>Settings</Text>
    <SettingsGroup><SettingsRow prominent icon="person-outline" label="Profile" helper="Name, login ID and password" onPress={() => router.push("/settings/profile")}/></SettingsGroup>
    <SettingsGroup title="What to remind me about"><SettingsRow icon="medical-outline" label="Medicine reminders">{toggle("Medicine reminders", "medicine_reminders")}</SettingsRow><SettingsRow icon="calendar-outline" label="Checkup reminders">{toggle("Checkup reminders", "checkup_reminders")}</SettingsRow><SettingsRow icon="water-outline" label="Staggered eye drop reminders">{toggle("Staggered eye drop reminders", "eye_drop_reminders")}</SettingsRow></SettingsGroup>
    {!preferences.medicine_reminders && <Text style={styles.warning}>Medicine reminders are off. You will not be reminded to take your medicines.</Text>}
    <SettingsGroup title="How to remind me"><SettingsRow icon="logo-whatsapp" label="WhatsApp" helper={preferences.whatsapp_linked ? "Reminders on" : "Reminders off"}>{toggle("WhatsApp", "whatsapp_linked")}</SettingsRow>
      <SettingsRow icon="paper-plane-outline" label="Telegram" helper={preferences.telegram_linked && preferences.telegram_reminders !== false ? "Reminders on" : "Reminders off"}>{preferences.telegram_linked ? toggle("Telegram", "telegram_reminders") : <SettingsButton label="Set up" outline onPress={() => setSheet("telegram")}/>}</SettingsRow>
      <SettingsRow icon="volume-medium-outline" label="Reminder sound" helper={sound} onPress={() => setSheet("sound")}/>
      <SettingsRow icon="mic-outline" label="Voice note reminders" helper="Play attached voice notes">{toggle("Voice note reminders", "voice_reminders")}</SettingsRow>
    </SettingsGroup>
    <SettingsGroup title="Comfort"><SettingsRow icon="text-outline" label="Text size" helper={textSize} onPress={() => setSheet("text")}/><SettingsRow icon="hand-left-outline" label="Haptic feedback" helper="Gentle buzz when you tap"><SettingsToggle label="Haptic feedback" value={hapticFeedback} onChange={setHapticsEnabled}/></SettingsRow></SettingsGroup>
    {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    <SettingsButton label="Log out" soft onPress={() => setSheet("logout")}/>
    <BottomSheet visible={sheet !== null} onClose={close} title={sheet === "sound" ? "Reminder sound" : sheet === "text" ? "Text size" : sheet === "telegram" ? "Set up Telegram" : "Log out?"}>
      {sheet === "sound" && <View style={{ gap: 12 }}>
        <Text style={styles.helper}>Choose and preview a sound. Notification delivery will be connected in a development build.</Text>
        {sounds.map(item => <View key={item.name} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <PressableScale haptic={false} onPressIn={press} accessibilityRole="radio" accessibilityState={{ checked: sound === item.name }} aria-checked={sound === item.name} accessibilityLabel={item.name} onPress={() => { void storeSound(item.name).catch(() => setError("Could not save sound.")); }} style={[styles.row, { flex: 1 }]}><Ionicons name={sound === item.name ? "radio-button-on" : "radio-button-off"} size={24} color="#0F6E56"/><Text style={styles.label}>{item.name}</Text></PressableScale>
          <PressableScale scaleTo={0.88} accessibilityLabel={`Preview ${item.name}`} onPress={() => preview(item.source)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="play" size={24} color="#0F6E56"/></PressableScale>
        </View>)}
      </View>}
      {sheet === "text" && <View accessibilityRole="radiogroup">{(["Normal", "Large", "Extra large"] as TextSize[]).map(size => <PressableScale key={size} accessibilityRole="radio" accessibilityLabel={size} accessibilityState={{ checked: textSize === size }} aria-checked={textSize === size} onPress={() => setTextSize(size)} style={styles.row}><Ionicons name={textSize === size ? "radio-button-on" : "radio-button-off"} size={24} color="#0F6E56"/><Text style={styles.label}>{size}</Text></PressableScale>)}</View>}
      {sheet === "telegram" && <View style={{ gap: 16 }}><Text style={styles.label}>1. Install or open Telegram</Text><SettingsButton label="Open Telegram" onPress={() => { void Linking.openURL("https://telegram.org/apps").catch(() => setError("Could not open Telegram.")); }}/><Text style={styles.label}>2. Connect DawaiSathi</Text><Text style={styles.helper}>Telegram account linking is not configured yet. You will be able to connect here when the reminder bot is available.</Text><SettingsButton label="Connect DawaiSathi — coming soon" disabled onPress={() => { }}/></View>}
      {sheet === "logout" && <View style={{ gap: 14 }}><Text style={styles.helper}>Log out? You will need your ID and password to come back.</Text><SettingsButton label="Stay logged in" disabled={busy} onPress={close}/><SettingsButton label={busy ? "Logging out…" : "Log out"} outline disabled={busy} onPress={() => { setBusy(true); void logout().catch(e => setError(e instanceof Error ? e.message : "Could not log out.")).finally(() => setBusy(false)); }}/></View>}
    </BottomSheet>
  </ScreenShell>;
}
