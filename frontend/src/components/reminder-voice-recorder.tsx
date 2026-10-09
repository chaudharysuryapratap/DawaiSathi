import { Ionicons } from "@expo/vector-icons";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import PressableScale from "./ui/PressableScale";
import { SettingsButton, settingsStyles as styles } from "./settings-ui";
export type ReminderVoice = {
    uri: string;
    seconds: number;
};
export function ReminderVoiceRecorder({ onSave }: {
    onSave: (voice: ReminderVoice) => Promise<void>;
}) {
    const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: "document" });
    const status = useAudioRecorderState(recorder, 100);
    const [clip, setClip] = useState<ReminderVoice | null>(null);
    const [recording, setRecording] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const player = useAudioPlayer(clip?.uri ?? null);
    const active = useRef(true);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stopRef = useRef<() => Promise<void>>(async () => { });
    const lock = useRef(false);
    const startedAt = useRef(0);
    const stop = async () => {
        if (lock.current)
            return;
        lock.current = true;
        if (timer.current)
            clearTimeout(timer.current);
        const duration = Math.max(1, Math.min(15, Math.round((Date.now() - startedAt.current) / 1000)));
        try {
            if (recorder.isRecording)
                await recorder.stop();
            if (active.current && recorder.uri)
                setClip({ uri: recorder.uri, seconds: duration });
        }
        catch {
            if (active.current)
                setError("Could not finish recording. Try again.");
        }
        finally {
            await setAudioModeAsync({ allowsRecording: false }).catch(() => { });
            lock.current = false;
            if (active.current) {
                setRecording(false);
                setBusy(false);
            }
        }
    };
    useEffect(() => { stopRef.current = stop; });
    useEffect(() => {
        active.current = true;
        const subscription = AppState.addEventListener("change", state => { if (state !== "active") {
            player.pause();
            if (recorder.isRecording)
                void stopRef.current();
        } });
        return () => { active.current = false; subscription.remove(); if (timer.current)
            clearTimeout(timer.current); player.pause(); if (recorder.isRecording)
            void recorder.stop().then(() => setAudioModeAsync({ allowsRecording: false })).catch(() => { }); };
    }, [recorder, player]);
    const start = async () => {
        if (lock.current)
            return;
        lock.current = true;
        setBusy(true);
        setError("");
        player.pause();
        try {
            const permission = await requestRecordingPermissionsAsync();
            if (!permission.granted)
                throw new Error("Allow microphone access to record your reminder. You can change this in your device settings.");
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
            await recorder.prepareToRecordAsync();
            if (!active.current || AppState.currentState === "background") {
                await recorder.stop();
                await setAudioModeAsync({ allowsRecording: false });
                return;
            }
            recorder.record({ forDuration: 15 });
            startedAt.current = Date.now();
            setRecording(true);
            setClip(null);
            timer.current = setTimeout(() => { void stopRef.current(); }, 15000);
        }
        catch (e) {
            if (active.current)
                setError(e instanceof Error ? e.message : "Could not record.");
            await setAudioModeAsync({ allowsRecording: false }).catch(() => { });
        }
        finally {
            lock.current = false;
            if (active.current)
                setBusy(false);
        }
    };
    const save = async () => {
        if (!clip || busy)
            return;
        setBusy(true);
        setError("");
        try {
            let uri = clip.uri;
            if (Platform.OS === "web") {
                const blob = await (await fetch(uri)).blob();
                uri = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not save recording.")); reader.readAsDataURL(blob); });
            }
            await onSave({ ...clip, uri });
        }
        catch {
            if (active.current)
                setError("Could not save recording. Try again.");
        }
        finally {
            if (active.current)
                setBusy(false);
        }
    };
    return <View style={{ gap: 20 }}><Text style={styles.helper}>Allow the microphone so you can record your own reminder. Tap the mic to start, then tap again to stop. Maximum 15 seconds.</Text>
    <PressableScale accessibilityLabel={recording ? "Stop recording" : "Start recording"} disabled={busy} onPress={() => { void (recording ? stop() : start()); }} style={{ alignSelf: "center", width: 100, height: 100, borderRadius: 50, backgroundColor: "#E1F5EE", alignItems: "center", justifyContent: "center" }}><Ionicons name={recording ? "stop" : "mic"} size={44} color="#0F6E56"/></PressableScale>
    <Text accessibilityLiveRegion="polite" style={[styles.title, { textAlign: "center" }]}>{recording ? Math.min(15, Math.floor(status.durationMillis / 1000)) : clip?.seconds ?? 0} / 15 seconds</Text>
    {clip && <><SettingsButton outline label="Play" disabled={busy} onPress={() => { void player.seekTo(0).then(() => player.play()).catch(() => setError("Could not play recording.")); }}/><SettingsButton label={busy ? "Saving…" : "Save"} disabled={busy} onPress={() => { void save(); }}/></>}
    {!!error && <Text style={styles.error}>{error}</Text>}
  </View>;
}
