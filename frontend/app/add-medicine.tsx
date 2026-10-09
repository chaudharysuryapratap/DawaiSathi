import PressableScale from "@/src/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/src/components/focus-input";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState, LoadingState, PrimaryButton } from "@/src/components/dawai-ui";
import { MedicineTimePicker } from "@/src/components/medicine-time-picker";
import { api, authHeaders, resolveMediaUrl } from "@/src/api";
import { VoiceNoteField, useVoiceNote } from "@/src/components/voice-note-field";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

const PRESET_TIMES = ["08:00", "13:00", "18:00", "22:00"];
const FREQUENCIES = ["Daily", "Weekly", "As needed"];
const WEEKDAYS = [
  { id: 0, label: "Mon" },
  { id: 1, label: "Tue" },
  { id: 2, label: "Wed" },
  { id: 3, label: "Thu" },
  { id: 4, label: "Fri" },
  { id: 5, label: "Sat" },
  { id: 6, label: "Sun" },
];

type Medicine = ReturnType<typeof useData>["medicines"][number];

export default function AddMedicineScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { medicines, loading, error, refresh } = useData();
  if (!id) return <AddMedicineForm mode={{ kind: "create" }} />;

  const existing = medicines.find((medicine) => medicine.id === id);
  if (loading && !existing) {
    return <LoadingState label="Loading medicine" />;
  }
  if (error && !existing) return <ErrorState message={error} onRetry={refresh} />;
  if (!existing) {
    return <EditRecordNotFound onBack={() => router.back()} />;
  }

  return <AddMedicineForm mode={{ kind: "edit", medicine: existing }} />;
}

function EditRecordNotFound({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
      <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "700", textAlign: "center" }}>
        Medicine not found
      </Text>
      <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
        This item may have been removed or is no longer available.
      </Text>
      <PrimaryButton label="Go back" onPress={onBack} variant="secondary" />
    </View>
  );
}

type MedicineFormMode = { kind: "create" } | { kind: "edit"; medicine: Medicine };

function AddMedicineForm({ mode }: { mode: MedicineFormMode }) {
  const router = useRouter();
  const prescription = useLocalSearchParams<{ prescriptionName?: string; prescriptionDosage?: string; prescriptionInstructions?: string; prescriptionMember?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const photoStyles = useMemo(
    () =>
      StyleSheet.create({
        field: { gap: 8 },
        imagePreview: {
          width: "100%",
          height: 180,
          borderRadius: 16,
          backgroundColor: colors.surfaceTertiary,
        },
        imageButtons: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
        imageButton: {
          minHeight: 44,
          borderRadius: 12,
          backgroundColor: colors.brandTertiary,
          paddingHorizontal: 14,
          alignItems: "center",
          justifyContent: "center",
        },
        imageButtonText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },
        imageRemoveButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10 },
        imageRemoveText: { color: colors.error, fontSize: 14, fontWeight: "700" },
        pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
        helper: { color: colors.muted, fontSize: 12 },
      }),
    [colors],
  );
  const { members, activeMemberId, addMedicine, updateMedicine, archiveMedicine } = useData();
  const existing = mode.kind === "edit" ? mode.medicine : undefined;

  const [name, setName] = useState(existing?.name ?? prescription.prescriptionName ?? "");
  const [dosage, setDosage] = useState(existing?.dosage ?? prescription.prescriptionDosage ?? "");
  const [frequency, setFrequency] = useState(existing?.frequency ?? "Daily");
  const [times, setTimes] = useState<string[]>(existing?.times ?? (prescription.prescriptionName ? [] : ["08:00"]));
  const [instructions, setInstructions] = useState(existing?.instructions ?? prescription.prescriptionInstructions ?? "");
  const [quantity, setQuantity] = useState(existing ? String(existing.quantity_total || "") : "");
  const [identification, setIdentification] = useState(existing?.identification_cue || "");
  const [imageUrl, setImageUrl] = useState(existing?.image_url || "");
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    contentType: string;
  } | null>(null);
  const [memberId, setMemberId] = useState<string | null>(existing ? existing.member_id ?? null : prescription.prescriptionMember ?? activeMemberId);
  const [days, setDays] = useState<number[]>(existing?.days?.length ? existing.days : [0, 1, 2, 3, 4, 5, 6]);
  const voiceNote = useVoiceNote(existing?.voice_note_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const saveInFlight = useRef(false);

  const toggleTime = (time: string) =>
    setTimes((current) => (current.includes(time) ? current.filter((value) => value !== time) : [...current, time].sort()));

  const addCustomTime = (time: string) => {
    setTimes((current) => current.includes(time) ? current : [...current, time].sort());
  };

  const toggleDay = (day: number) =>
    setDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]));

  const chooseImage = async (source: "library" | "camera" = "library") => {
    setError(null);
    try {
      if (source === "camera" && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError("Camera access is needed to take a photo. You can enable it in Settings or choose a photo instead.");
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      };
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64 || !asset.mimeType) {
        setError("Could not read that photo. Choose a JPEG, PNG, or WebP image.");
        return;
      }
      setSelectedImage({ base64: asset.base64, contentType: asset.mimeType });
    } catch (pickerError) {
      setError(pickerError instanceof Error ? pickerError.message : source === "camera" ? "Could not open the camera." : "Could not open the photo library.");
    }
  };

  const save = async (addAnother = false) => {
    if (saveInFlight.current || voiceNote.busy) return;
    if (!name.trim() || !dosage.trim() || times.length === 0) {
      setError("Add a medicine name, dosage, and at least one reminder time.");
      return;
    }
    if (days.length === 0) {
      setError("Choose at least one day of the week.");
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const savedImageUrl = selectedImage
        ? (await api.uploadMedicineImage(selectedImage.contentType, selectedImage.base64)).image_url
        : imageUrl;
      const input = {
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        times,
        instructions: instructions.trim(),
        quantity_total: Number(quantity) || 0,
        identification_cue: identification.trim(),
        image_url: savedImageUrl,
        voice_note_url: await voiceNote.save(),
        member_id: memberId,
        days,
      };
      if (mode.kind === "edit") await updateMedicine(mode.medicine.id, input);
      else await addMedicine(input);
      if (addAnother && mode.kind === "create") {
        voiceNote.reset();
        setName("");
        setDosage("");
        setFrequency("Daily");
        setTimes(["08:00"]);
        setInstructions("");
        setQuantity("");
        setIdentification("");
        setImageUrl("");
        setSelectedImage(null);
        setMemberId(activeMemberId);
        setDays([0, 1, 2, 3, 4, 5, 6]);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        router.back();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t save this medicine.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await archiveMedicine(existing.id);
      router.back();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t archive medicine.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <PressableScale scaleTo={0.88} hitSlop={14}
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          testID="add-medicine-close"
        >
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </PressableScale>
        <Text style={styles.headerTitle}>{existing ? "Edit medicine" : "Add medicine"}</Text>
        <View style={styles.close} />
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{existing ? "Keep the details up to date so reminders stay useful." : "Just the essentials. You can always change these later."}</Text>

        <Field label="Medicine name" value={name} onChangeText={setName} placeholder="e.g. Vitamin D" autoCapitalize="words" testID="medicine-name-input" />
        <Field label="Dosage" value={dosage} onChangeText={setDosage} placeholder="e.g. 1 tablet" testID="medicine-dosage-input" />

        <View style={styles.field}>
          <Text style={styles.label}>Who is this for?</Text>
          <View style={styles.chips}>
            {members.map((member) => (
              <PressableScale
                key={member.id}
                testID={`medicine-member-${member.id}`}
                onPress={() => setMemberId(member.id)}
                style={({ pressed }) => [styles.chip, memberId === member.id && styles.chipActive, pressed && styles.pressed]}
              >
                <View style={[styles.chipDot, { backgroundColor: member.color }]} />
                <Text style={[styles.chipText, memberId === member.id && styles.chipTextActive]}>{member.name}</Text>
              </PressableScale>
            ))}
            <PressableScale
              testID="medicine-member-none"
              onPress={() => setMemberId(null)}
              style={({ pressed }) => [styles.chip, memberId === null && styles.chipActive, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, memberId === null && styles.chipTextActive]}>Shared</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>How often?</Text>
          <View style={styles.chips}>
            {FREQUENCIES.map((item) => (
              <PressableScale
                key={item}
                onPress={() => setFrequency(item)}
                style={({ pressed }) => [styles.chip, frequency === item && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, frequency === item && styles.chipTextActive]}>{item}</Text>
              </PressableScale>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Which days?</Text>
          <View style={styles.chips}>
            {WEEKDAYS.map((day) => (
              <PressableScale
                key={day.id}
                testID={`medicine-day-${day.id}`}
                onPress={() => toggleDay(day.id)}
                style={({ pressed }) => [styles.chipCompact, days.includes(day.id) && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, days.includes(day.id) && styles.chipTextActive]}>{day.label}</Text>
              </PressableScale>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Reminder times</Text>
          <Text style={styles.helper}>Pick preset times or add your own.</Text>
          <View style={styles.chips}>
            {PRESET_TIMES.map((time) => (
              <PressableScale
                key={time}
                testID={`medicine-time-${time}`}
                accessibilityRole="button"
                accessibilityState={{ selected: times.includes(time) }}
                onPress={() => toggleTime(time)}
                style={({ pressed }) => [styles.chip, times.includes(time) && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, times.includes(time) && styles.chipTextActive]}>{time}</Text>
              </PressableScale>
            ))}
          </View>
          <MedicineTimePicker onSelect={addCustomTime} disabled={saving || voiceNote.busy} />
          {times.length > 0 ? (
            <View style={styles.field}>
              <Text style={styles.selectedTimes}>Selected times</Text>
              <View style={styles.chips}>
                {times.map((time) => (
                  <PressableScale
                    key={time}
                    testID={`medicine-selected-time-${time}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove reminder time ${time}`}
                    hitSlop={4}
                    disabled={saving || voiceNote.busy}
                    onPress={() => setTimes((current) => current.filter((value) => value !== time))}
                    style={({ pressed }) => [styles.chip, styles.chipActive, styles.selectedTimeChip, pressed && styles.pressed]}
                  >
                    <Text style={[styles.chipText, styles.chipTextActive, styles.selectedTimeText]}>{time}</Text>
                    <Ionicons name="close" size={14} color={colors.brandPrimary} />
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <Field label="How many do you have?" value={quantity} onChangeText={setQuantity} placeholder="Optional" keyboardType="number-pad" />
        <View style={photoStyles.field} testID="medicine-identification-section">
          <Field label="Identification cue" value={identification} onChangeText={setIdentification} placeholder="e.g. Small round white tablet" multiline testID="medicine-identification-input" />
          {selectedImage || imageUrl ? (
            <Image
              testID="medicine-photo-preview"
              accessibilityLabel={`${name || "Medicine"} photo preview`}
              source={{
                uri: selectedImage
                  ? `data:${selectedImage.contentType};base64,${selectedImage.base64}`
                  : resolveMediaUrl(imageUrl),
                headers: selectedImage ? undefined : authHeaders(),
              }}
              contentFit="cover"
              style={photoStyles.imagePreview}
            />
          ) : null}
          <View style={photoStyles.imageButtons}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Choose medicine photo"
              testID="medicine-photo-choose"
              disabled={saving || voiceNote.busy}
              onPress={() => void chooseImage()}
              style={({ pressed }) => [photoStyles.imageButton, pressed && photoStyles.pressed]}
            >
              <Text style={photoStyles.imageButtonText}>
                {selectedImage || imageUrl ? "Change photo" : "Choose photo"}
              </Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Take medicine photo with camera"
              testID="medicine-photo-camera"
              disabled={saving || voiceNote.busy}
              onPress={() => void chooseImage("camera")}
              style={({ pressed }) => [photoStyles.imageButton, pressed && photoStyles.pressed]}
            >
              <Text style={photoStyles.imageButtonText}>Take photo</Text>
            </PressableScale>
            {selectedImage || imageUrl ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Remove medicine photo"
                testID="medicine-photo-remove"
                disabled={saving || voiceNote.busy}
                onPress={() => {
                  setImageUrl("");
                  setSelectedImage(null);
                }}
                style={({ pressed }) => [photoStyles.imageRemoveButton, pressed && photoStyles.pressed]}
              >
                <Text style={photoStyles.imageRemoveText}>Remove</Text>
              </PressableScale>
            ) : null}
          </View>
          <Text style={photoStyles.helper}>JPEG, PNG, or WebP, up to 5 MB.</Text>
        </View>
        <Field label="Extra instructions" value={instructions} onChangeText={setInstructions} placeholder="e.g. After breakfast" multiline />

        <VoiceNoteField value={voiceNote} disabled={saving} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          testID="save-medicine-button"
          label={saving ? "Saving…" : existing ? "Save changes" : "Save medicine"}
          onPress={() => save()}
          disabled={saving || voiceNote.busy}
        />
        {!existing ? (
          <PressableScale
            testID="add-another-medicine-button"
            accessibilityRole="button"
            accessibilityLabel="Add another medicine"
            accessibilityHint="Saves this medicine and starts a new blank medicine form."
            disabled={saving || voiceNote.busy}
            onPress={() => save(true)}
            style={({ pressed }) => [styles.addAnother, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={20} color={colors.brandPrimary} />
            <Text style={styles.addAnotherText}>Add another medicine</Text>
          </PressableScale>
        ) : null}
        {existing ? (
          <PressableScale onPress={archive} disabled={saving || voiceNote.busy} style={({ pressed }) => [styles.archive, pressed && styles.pressed]} testID="archive-medicine-button">
            <Text style={styles.archiveText}>Archive medicine</Text>
          </PressableScale>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize = "sentences",
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad" | "numbers-and-punctuation";
  autoCapitalize?: "none" | "sentences" | "words";
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
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
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
    multiline: { minHeight: 88, paddingTop: 14, textAlignVertical: "top" },
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
    chipCompact: {
      minHeight: 40,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 12,
      minWidth: 46,
      alignItems: "center",
      justifyContent: "center",
    },
    chipActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
    chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
    chipTextActive: { color: colors.brandPrimary },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    selectedTimes: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", marginTop: 4 },
    selectedTimeChip: { minHeight: 36, paddingHorizontal: 10, gap: 5 },
    selectedTimeText: { fontSize: 12 },
    addAnother: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.brandPrimary, borderRadius: 16, backgroundColor: colors.brandTertiary },
    addAnotherText: { color: colors.brandPrimary, fontSize: 15, fontWeight: "800" },
    error: { color: colors.error, fontSize: 13 },
    archive: { minHeight: 44, alignItems: "center", justifyContent: "center" },
    archiveText: { color: colors.error, fontSize: 14, fontWeight: "700" },
    pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  }),
);
