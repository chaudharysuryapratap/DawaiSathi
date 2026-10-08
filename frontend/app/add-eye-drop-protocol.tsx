import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View } from "react-native";
import { TextInput } from "@/src/components/focus-input";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState, LoadingState, PrimaryButton } from "@/src/components/dawai-ui";
import { MedicineTimePicker } from "@/src/components/medicine-time-picker";
import { VoiceNoteField, useVoiceNote } from "@/src/components/voice-note-field";
import { useData } from "@/src/data-context";
import { EYE_LABEL } from "@/src/protocol-status";
import { makeStyles, useTheme } from "@/src/theme";
import type { EyeDropProtocol, EyeTarget } from "@/src/types";

const EYES: EyeTarget[] = ["left", "right", "both"];
const INTERVAL_PRESETS = [3, 5, 10, 15];
const PRESET_STARTS = ["07:00", "08:00", "12:00", "18:00", "22:00"];

type StepDraft = { medicine_name: string; dose: string; eye: EyeTarget };

const emptyStep = (): StepDraft => ({ medicine_name: "", dose: "1 drop", eye: "both" });

export default function AddEyeDropProtocolScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { protocols, loading, error, refresh } = useData();
  const router = useRouter();
  const existing = protocols.find(protocol => protocol.id === id);
  if (id && !existing) {
    if (loading) return <LoadingState label="Loading protocol" />;
    if (error) return <ErrorState message={error} onRetry={refresh} />;
    return <ErrorState message="Protocol not found. It may have been removed." onRetry={() => router.back()} />;
  }
  return <EyeDropProtocolForm key={id ?? "create"} existing={existing} />;
}

function EyeDropProtocolForm({ existing }: { existing?: EyeDropProtocol }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const { members, activeMemberId, addProtocol, updateProtocol } = useData();

  const [name, setName] = useState(existing?.name ?? "Post-surgery eye drops");
  const [startTime, setStartTime] = useState(existing?.start_time ?? "08:00");
  const [interval, setInterval] = useState(existing?.interval_minutes ?? 5);
  const [memberId, setMemberId] = useState<string | null>(existing ? existing.member_id : activeMemberId);
  const [steps, setSteps] = useState<StepDraft[]>(existing?.steps.map(step => ({ medicine_name: step.medicine_name, dose: step.dose, eye: step.eye })) ?? [
    { medicine_name: "", dose: "1 drop", eye: "both" },
    { medicine_name: "", dose: "1 drop", eye: "both" },
  ]);
  const voiceNote = useVoiceNote(existing?.voice_note_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeline = useMemo(() => {
    const [h, m] = startTime.split(":").map(Number);
    return steps.map((_, index) => {
      const total = h * 60 + m + interval * index;
      const bounded = total % (24 * 60);
      return `${String(Math.floor(bounded / 60)).padStart(2, "0")}:${String(bounded % 60).padStart(2, "0")}`;
    });
  }, [startTime, interval, steps]);

  const updateStep = (index: number, patch: Partial<StepDraft>) =>
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));

  const addStep = () => setSteps((current) => [...current, emptyStep()]);

  const removeStep = (index: number) =>
    setSteps((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    const cleanedSteps = steps.map((step) => ({
      medicine_name: step.medicine_name.trim(),
      dose: step.dose.trim() || "1 drop",
      eye: step.eye,
    }));
    if (!name.trim()) {
      setError("Give the protocol a name.");
      return;
    }
    if (cleanedSteps.some((step) => !step.medicine_name)) {
      setError("Every step needs a medicine name.");
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      setError("Choose a valid start time (HH:MM).");
      return;
    }
    if (voiceNote.busy) return;
    setSaving(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        voice_note_url: await voiceNote.save(),
        start_time: startTime,
        interval_minutes: interval,
        steps: cleanedSteps,
        member_id: memberId,
      };
      if (existing) await updateProtocol(existing.id, input);
      else await addProtocol(input);
      router.back();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t save this protocol.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          testID="protocol-close"
        >
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{existing ? "Modify protocol" : "Staggered eye drops"}</Text>
        <View style={styles.close} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Add each eye drop in the order it should be taken. We’ll space them out and remind
          you at every step.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Protocol name</Text>
          <TextInput
            testID="protocol-name-input"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Post-surgery eye drops"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="sentences"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Who is this for?</Text>
          <View style={styles.chips}>
            {members.map((member) => (
              <Pressable
                key={member.id}
                testID={`protocol-member-${member.id}`}
                onPress={() => setMemberId(member.id)}
                style={({ pressed }) => [
                  styles.chip,
                  memberId === member.id && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.chipDot, { backgroundColor: member.color }]} />
                <Text style={[styles.chipText, memberId === member.id && styles.chipTextActive]}>
                  {member.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              testID="protocol-member-none"
              onPress={() => setMemberId(null)}
              style={({ pressed }) => [
                styles.chip,
                memberId === null && styles.chipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, memberId === null && styles.chipTextActive]}>Shared</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Start time</Text>
          <View style={styles.chips}>
            {PRESET_STARTS.map((time) => (
              <Pressable
                key={time}
                testID={`protocol-start-${time}`}
                onPress={() => setStartTime(time)}
                style={({ pressed }) => [
                  styles.chip,
                  startTime === time && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, startTime === time && styles.chipTextActive]}>{time}</Text>
              </Pressable>
            ))}
          </View>
          <MedicineTimePicker onSelect={setStartTime} disabled={saving} />
          <Text style={styles.helper}>Currently starts at {startTime}.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Interval between steps</Text>
          <View style={styles.chips}>
            {INTERVAL_PRESETS.map((value) => (
              <Pressable
                key={value}
                testID={`protocol-interval-${value}`}
                onPress={() => setInterval(value)}
                style={({ pressed }) => [
                  styles.chip,
                  interval === value && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, interval === value && styles.chipTextActive]}>
                  {value} min
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.stepsHeader}>
          <Text style={styles.label}>Eye drops in order</Text>
          <Pressable
            testID="protocol-add-step"
            onPress={addStep}
            style={({ pressed }) => [styles.addStepButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={16} color={colors.brandPrimary} />
            <Text style={styles.addStepText}>Add step</Text>
          </Pressable>
        </View>

        {steps.map((step, index) => (
          <View key={index} style={styles.stepCard} testID={`protocol-step-card-${index}`}>
            <View style={styles.stepHead}>
              <View style={styles.stepIndex}>
                <Text style={styles.stepIndexText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepTime}>{timeline[index]}</Text>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => moveStep(index, -1)}
                disabled={index === 0}
                style={({ pressed }) => [
                  styles.iconButton,
                  index === 0 && styles.iconDisabled,
                  pressed && styles.pressed,
                ]}
                testID={`protocol-step-up-${index}`}
              >
                <Ionicons name="arrow-up" size={14} color={colors.brandPrimary} />
              </Pressable>
              <Pressable
                onPress={() => moveStep(index, 1)}
                disabled={index === steps.length - 1}
                style={({ pressed }) => [
                  styles.iconButton,
                  index === steps.length - 1 && styles.iconDisabled,
                  pressed && styles.pressed,
                ]}
                testID={`protocol-step-down-${index}`}
              >
                <Ionicons name="arrow-down" size={14} color={colors.brandPrimary} />
              </Pressable>
              <Pressable
                onPress={() => removeStep(index)}
                disabled={steps.length === 1}
                style={({ pressed }) => [
                  styles.iconButton,
                  steps.length === 1 && styles.iconDisabled,
                  pressed && styles.pressed,
                ]}
                testID={`protocol-step-remove-${index}`}
              >
                <Ionicons name="trash-outline" size={14} color={colors.error} />
              </Pressable>
            </View>
            <TextInput
              testID={`protocol-step-name-${index}`}
              value={step.medicine_name}
              onChangeText={(value) => updateStep(index, { medicine_name: value })}
              placeholder="Medicine name (e.g. Moxifloxacin)"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="words"
            />
            <View style={styles.stepRow}>
              <TextInput
                testID={`protocol-step-dose-${index}`}
                value={step.dose}
                onChangeText={(value) => updateStep(index, { dose: value })}
                placeholder="1 drop"
                placeholderTextColor={colors.muted}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <View style={styles.chips}>
              {EYES.map((eye) => (
                <Pressable
                  key={eye}
                  testID={`protocol-step-eye-${index}-${eye}`}
                  onPress={() => updateStep(index, { eye })}
                  style={({ pressed }) => [
                    styles.chip,
                    step.eye === eye && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, step.eye === eye && styles.chipTextActive]}>
                    {EYE_LABEL[eye]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Timeline preview</Text>
          {steps.map((step, index) => (
            <Text key={index} style={styles.timelineLine}>
              {timeline[index]} · Step {index + 1} — {step.medicine_name || "Unnamed"} ·{" "}
              {EYE_LABEL[step.eye]}
            </Text>
          ))}
        </View>

        <VoiceNoteField value={voiceNote} disabled={saving} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          testID="save-protocol-button"
          label={saving ? "Saving…" : "Save protocol"}
          onPress={save}
          disabled={saving || voiceNote.busy}
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
    close: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
    content: { padding: 20, gap: 18 },
    intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    field: { gap: 8 },
    label: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
    helper: { color: colors.muted, fontSize: 12 },
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
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      minHeight: 40,
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
    customTime: { flexDirection: "row", gap: 8, marginTop: 4 },
    customInput: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 14,
      color: colors.onSurface,
      fontSize: 14,
    },
    addTime: {
      minWidth: 62,
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    addTimeText: { color: colors.brandPrimary, fontWeight: "800", fontSize: 14 },
    stepsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    addStepButton: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 4,
    },
    addStepText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
    stepCard: {
      gap: 10,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    stepIndex: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    stepIndexText: { color: colors.brandPrimary, fontWeight: "800", fontSize: 13 },
    stepTime: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
    stepRow: { flexDirection: "row", gap: 8 },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    iconDisabled: { opacity: 0.35 },
    timelineCard: {
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.brandTertiary,
      gap: 4,
    },
    timelineTitle: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
    timelineLine: { color: colors.onSurface, fontSize: 13 },
    error: { color: colors.error, fontSize: 13 },
    pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  }),
);
