import PressableScale from "@/src/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { api, authHeaders, resolveMediaUrl } from "@/src/api";
import { useTheme } from "@/src/theme";

type Note = { uri: string; contentType: string; name: string; stored?: boolean };
const MAX_BYTES = 5 * 1024 * 1024;

async function readAudio(note: Note) {
  if (Platform.OS !== "web") {
    const file = new File(note.uri);
    if (file.size > MAX_BYTES) throw new Error("Choose an audio file smaller than 5 MB.");
    return file.base64();
  }
  const blob = await (await fetch(note.uri)).blob();
  if (blob.size > MAX_BYTES) throw new Error("Choose an audio file smaller than 5 MB.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read this audio file."));
    reader.readAsDataURL(blob);
  });
}

export function useVoiceNote(initialUrl = "") {
  const [enabled, setEnabled] = useState(!!initialUrl);
  const [note, setNote] = useState<Note | null>(initialUrl ? { uri: initialUrl, contentType: "", name: "Saved voice note", stored: true } : null);
  const [busy, setBusy] = useState(false);
  const uploaded = useRef<{ note: Note; url: string } | null>(null);
  const reset = () => { setEnabled(false); setNote(null); uploaded.current = null; };
  const save = async () => {
    if (busy) throw new Error("Finish recording before saving.");
    if (!enabled) return "";
    if (!note) throw new Error("Record or upload a voice note, or uncheck the voice note option.");
    if (note.stored) return note.uri;
    if (uploaded.current?.note === note) return uploaded.current.url;
    const result = await api.uploadVoiceNote(note.contentType, await readAudio(note));
    uploaded.current = { note, url: result.voice_note_url };
    return result.voice_note_url;
  };
  return { enabled, setEnabled, note, setNote, busy, setBusy, reset, save };
}

export function VoiceNoteField({ value, disabled = false }: { value: ReturnType<typeof useVoiceNote>; disabled?: boolean }) {
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [webAudio, setWebAudio] = useState<{ source: string; uri: string } | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopping = useRef(false);
  const operationActive = useRef(false);
  const mounted = useRef(true);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const note = value.note;
  const player = useAudioPlayer(note ? (note.stored ? (Platform.OS === "web" ? (webAudio?.source === note.uri ? webAudio.uri : null) : { uri: resolveMediaUrl(note.uri), headers: authHeaders() }) : note.uri) : null);
  const status = useAudioPlayerStatus(player);
  const locked = disabled || value.busy;

  useEffect(() => {
    if (Platform.OS !== "web" || !note?.stored) return;
    let canceled = false;
    let objectUrl: string | undefined;
    void fetch(resolveMediaUrl(note.uri), { headers: authHeaders() }).then(async response => {
      if (!response.ok) throw new Error("Could not load this voice note.");
      const blob = await response.blob();
      if (!canceled) { objectUrl = URL.createObjectURL(blob); setWebAudio({ source: note.uri, uri: objectUrl }); }
    }).catch(e => { if (!canceled) setError(e.message); });
    return () => { canceled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [note]);

  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    setRecording(false);
    if (timer.current) clearTimeout(timer.current);
    try {
      await recorder.stop();
      if (mounted.current && recorder.uri) value.setNote({ uri: recorder.uri, name: "Recorded voice note", contentType: Platform.OS === "web" ? "audio/webm" : "audio/mp4" });
    } catch { if (mounted.current) setError("Could not finish recording. Please try again."); }
    finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (mounted.current) { setRecording(false); value.setBusy(false); }
      stopping.current = false;
      operationActive.current = false;
    }
  };
  useEffect(() => { stopRef.current = stop; });
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") { player.pause(); if (recorder.isRecording) void stopRef.current(); }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
      if (recorder.isRecording) void recorder.stop().then(() => setAudioModeAsync({ allowsRecording: false })).catch(() => {});
    };
  }, [player, recorder]);

  const record = async () => {
    if (operationActive.current) return;
    operationActive.current = true;
    setError(null); value.setBusy(true); player.pause();
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Allow microphone access in Settings to record a voice note.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      await recorder.prepareToRecordAsync();
      if (!mounted.current || AppState.currentState === "background") {
        await recorder.stop();
        throw new Error("Return to the app to record a voice note.");
      }
      recorder.record(); setRecording(true);
      timer.current = setTimeout(() => { void stopRef.current(); }, 30_000);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start recording."); value.setBusy(false); operationActive.current = false; await setAudioModeAsync({ allowsRecording: false }).catch(() => {}); }
  };
  const upload = async () => {
    if (operationActive.current) return;
    operationActive.current = true;
    setError(null); value.setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true, multiple: false });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (asset.size && asset.size > MAX_BYTES) throw new Error("Choose an audio file smaller than 5 MB.");
        const extension = asset.name.split(".").pop()?.toLowerCase();
        const contentType = asset.mimeType || ({ m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg" } as Record<string, string>)[extension || ""];
        if (!contentType) throw new Error("Choose an M4A, MP3, WAV, WebM, or Ogg file.");
        player.pause(); value.setNote({ uri: asset.uri, name: asset.name, contentType });
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not choose this audio file."); }
    finally { value.setBusy(false); operationActive.current = false; }
  };
  const togglePlayback = async () => {
    try {
      if (status.playing) player.pause();
      else { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false }); if (status.didJustFinish) await player.seekTo(0); player.play(); }
    } catch { setError("Could not play this voice note."); }
  };
  const progress = status.duration ? status.currentTime / status.duration : 0;
  return <View style={styles.container}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value.enabled, disabled: locked }} disabled={locked} onPress={() => { player.pause(); value.setEnabled(!value.enabled); setError(null); }} style={styles.checkbox} testID="voice-note-checkbox">
      <Ionicons name={value.enabled ? "checkbox" : "square-outline"} size={24} color={colors.brandPrimary} />
      <Text style={[styles.label, { color: colors.onSurface }]}>Add a voice note reminder</Text>
    </Pressable>
    {value.enabled && <View style={[styles.section, { backgroundColor: colors.surfaceSecondary }]}>
      <Text style={[styles.label, { color: colors.onSurface }]}>Voice note reminder</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>Record up to 30 seconds or upload audio up to 5 MB.</Text>
      <View style={styles.row}>
        <PressableScale accessibilityRole="button" disabled={disabled || (value.busy && !recording)} onPress={recording ? stop : record} style={[styles.action, { backgroundColor: colors.brandPrimary }]} testID="voice-note-record"><Ionicons name={recording ? "stop" : "mic-outline"} size={20} color={colors.onBrandPrimary} /><Text style={[styles.actionText, { color: colors.onBrandPrimary }]}>{recording ? "Stop recording" : "Record"}</Text></PressableScale>
        <PressableScale accessibilityRole="button" disabled={locked} onPress={upload} style={[styles.action, { backgroundColor: colors.brandPrimary }, locked && styles.disabled]} testID="voice-note-upload"><Ionicons name="cloud-upload-outline" size={20} color={colors.onBrandPrimary} /><Text style={[styles.actionText, { color: colors.onBrandPrimary }]}>Upload</Text></PressableScale>
      </View>
      {recording && <Text accessibilityLiveRegion="polite" style={{ color: colors.brandPrimary }}>Recording… tap Stop when finished.</Text>}
      {note && <>
        <View style={[styles.audio, { backgroundColor: colors.brandSecondary }]} testID="voice-note-preview">
          <PressableScale scaleTo={0.88} hitSlop={14} accessibilityRole="button" accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"} disabled={locked || !status.isLoaded} onPress={togglePlayback} style={styles.play} testID="voice-note-play"><Ionicons name={status.playing ? "pause" : "play"} size={25} color={colors.onBrandSecondary} /></PressableScale>
          <View style={styles.wave} accessibilityLabel="Audio playback progress">
            {Array.from({ length: 36 }, (_, i) => <View key={i} style={{ flex: 1, height: 5 + Math.sin(i * 1.7) ** 2 * (12 + 22 * Math.sin(i / 36 * Math.PI)), borderRadius: 2, backgroundColor: colors.onBrandSecondary, opacity: i / 36 <= progress ? 1 : 0.55 }} />)}
          </View>
          <Text style={[styles.duration, { color: colors.onBrandSecondary }]}>{Math.floor(status.currentTime || 0)}s</Text>
        </View>
        <View style={styles.row}><Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 12 }}>{note.name}</Text><PressableScale accessibilityRole="button" disabled={locked} onPress={() => { player.pause(); value.setNote(null); setError(null); }} testID="voice-note-remove" style={styles.remove}><Text style={{ color: colors.error, fontWeight: "700" }}>Remove</Text></PressableScale></View>
      </>}
      {(error || status.error) && <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>{error || "Could not play this voice note. Try another recording or file."}</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 12 }, checkbox: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  label: { fontSize: 16, fontWeight: "700", flexShrink: 1 }, section: { borderRadius: 20, padding: 16, gap: 14 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" }, action: { flex: 1, minHeight: 48, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, paddingHorizontal: 8 },
  actionText: { fontSize: 14, fontWeight: "700", flexShrink: 1 }, disabled: { opacity: 0.5 },
  audio: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, padding: 12 },
  play: { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }, wave: { flex: 1, height: 44, flexDirection: "row", alignItems: "center", gap: 2 },
  duration: { fontSize: 12 }, remove: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
});
