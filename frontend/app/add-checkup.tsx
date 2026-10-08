import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/src/components/focus-input";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState, LoadingState, PrimaryButton } from "@/src/components/dawai-ui";
import { MedicineTimePicker } from "@/src/components/medicine-time-picker";
import { CheckupDatePicker } from "@/src/components/checkup-date-picker";
import { VoiceNoteField, useVoiceNote } from "@/src/components/voice-note-field";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

function toLocalIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

type Checkup = ReturnType<typeof useData>["checkups"][number];

export default function AddCheckupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; copyId?: string }>();
  const { checkups, loading, error, refresh } = useData();
  if (!params.id && !params.copyId) return <AddCheckupForm mode={{ kind: "create" }} />;

  const existing = checkups.find((checkup) => checkup.id === (params.id ?? params.copyId));
  if (loading && !existing) {
    return <LoadingState label="Loading checkup" />;
  }
  if (error && !existing) return <ErrorState message={error} onRetry={refresh} />;
  if (!existing) {
    return <EditRecordNotFound label="Checkup" onBack={() => router.back()} />;
  }

  return <AddCheckupForm key={`${params.id ?? params.copyId}`} mode={params.copyId ? { kind: "create", copy: existing } : { kind: "edit", checkup: existing }} />;
}

function EditRecordNotFound({ label, onBack }: { label: string; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
      <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "700", textAlign: "center" }}>
        {label} not found
      </Text>
      <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
        This item may have been removed or is no longer available.
      </Text>
      <PrimaryButton label="Go back" onPress={onBack} variant="secondary" />
    </View>
  );
}

type CheckupFormMode = { kind: "create"; copy?: Checkup } | { kind: "edit"; checkup: Checkup };

function AddCheckupForm({ mode }: { mode: CheckupFormMode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const { members, activeMemberId, addCheckup, updateCheckup } = useData();
  const existing = mode.kind === "edit" ? mode.checkup : undefined;
  const initial = existing ?? (mode.kind === "create" ? mode.copy : undefined);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [doctor, setDoctor] = useState(initial?.doctor ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dateValue, setDateValue] = useState(() => {
    if (existing) return new Date(existing.scheduled_at);
    const next = new Date();
    next.setHours(next.getHours() + 24, 0, 0, 0);
    return next;
  });
  const [memberId, setMemberId] = useState<string | null>(initial ? initial.member_id : activeMemberId);
  const voiceNote = useVoiceNote(initial?.voice_note_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) {
      setError("Add a title so you know what this checkup is for.");
      return;
    }
    if (voiceNote.busy) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        voice_note_url: await voiceNote.save(),
        doctor: doctor.trim(),
        location: location.trim(),
        notes: notes.trim(),
        scheduled_at: toLocalIso(dateValue),
        member_id: memberId,
      };
      if (mode.kind === "edit") await updateCheckup(mode.checkup.id, payload);
      else await addCheckup(payload);
      router.replace({ pathname: "/care/checkups", params: { message: existing ? "Checkup updated" : "Checkup saved" } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t save this checkup.");
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (day: Date) => {
    const combined = new Date(dateValue);
    combined.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    setDateValue(new Date(combined));
  };

  const updateTime = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    const combined = new Date(dateValue);
    combined.setHours(hour, minute, 0, 0);
    setDateValue(new Date(combined));
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          testID="add-checkup-close"
        >
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{existing ? "Edit checkup" : "Add checkup"}</Text>
        <View style={styles.close} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Log a doctor visit or lab test. Upcoming checkups appear on Today automatically.</Text>
        <Field label="What is this checkup for?" value={title} onChangeText={setTitle} placeholder="e.g. Eye checkup" testID="checkup-title" />
        <Field label="Doctor’s name" value={doctor} onChangeText={setDoctor} placeholder="e.g. Dr. Sharma" testID="checkup-doctor" />

        <View style={styles.field}>
          <Text style={styles.label}>Who is this checkup for?</Text>
          <View style={styles.chips}>
            {members.map((member) => (
              <Pressable
                key={member.id}
                testID={`checkup-member-${member.id}`}
                onPress={() => setMemberId(member.id)}
                style={({ pressed }) => [styles.chip, memberId === member.id && styles.chipActive, pressed && styles.pressed]}
              >
                <View style={[styles.chipDot, { backgroundColor: member.color }]} />
                <Text style={[styles.chipText, memberId === member.id && styles.chipTextActive]}>{member.name}</Text>
              </Pressable>
            ))}
            <Pressable
              testID="checkup-member-none"
              onPress={() => setMemberId(null)}
              style={({ pressed }) => [styles.chip, memberId === null && styles.chipActive, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, memberId === null && styles.chipTextActive]}>Family</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <CheckupDatePicker value={dateValue} onSelect={updateDay} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Time</Text>
          <MedicineTimePicker onSelect={updateTime} disabled={saving} initialTime={`${String(dateValue.getHours()).padStart(2, "0")}:${String(dateValue.getMinutes()).padStart(2, "0")}`} label={dateValue.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} />
        </View>

        <Field label="Location" value={location} onChangeText={setLocation} placeholder="e.g. Apollo Hospital" testID="checkup-location" />
        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Instructions or questions for your doctor" multiline testID="checkup-notes" />

        <VoiceNoteField value={voiceNote} disabled={saving} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
        <PrimaryButton
          testID="save-checkup-button"
          label={saving ? "Saving…" : existing ? "Save changes" : "Save checkup"}
          onPress={save}
          disabled={saving || voiceNote.busy}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
    headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
    content: { padding: 20, gap: 18 },
    intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    field: { gap: 8 },
    label: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
    input: {
      minHeight: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 15,
      color: colors.onSurface,
      fontSize: 15,
    },
    multiline: { minHeight: 88, paddingTop: 14, textAlignVertical: "top" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      minHeight: 48,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      flexDirection: "row",
      gap: 8,
    },
    chipActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
    chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
    chipTextActive: { color: colors.brandPrimary },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    dayRow: { gap: 8, paddingRight: 6 },
    dayChip: {
      minWidth: 56,
      minHeight: 60,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    dayLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
    dayNumber: { color: colors.onSurface, fontSize: 17, fontWeight: "800", marginTop: 2 },
    error: { color: colors.error, fontSize: 13 },
    delete: { minHeight: 44, alignItems: "center", justifyContent: "center" },
    deleteText: { color: colors.error, fontSize: 14, fontWeight: "700" },
    pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  }),
);
