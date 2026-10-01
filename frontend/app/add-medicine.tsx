import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingState, PrimaryButton } from "@/src/components/dawai-ui";
import { api, authHeaders, resolveMediaUrl } from "@/src/api";
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
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { medicines, loading } = useData();
  const existing = medicines.find((medicine) => medicine.id === id);

  if (id && loading && !existing) {
    return <LoadingState label="Loading medicine" />;
  }

  return <AddMedicineForm existing={existing} />;
}

function AddMedicineForm({ existing }: { existing: Medicine | undefined }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const photoStyles = useMemo(
    () =>
      StyleSheet.create({
        field: { gap: 8 },
        label: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
        imagePreview: {
          width: "100%",
          height: 180,
          borderRadius: 16,
          backgroundColor: colors.surfaceTertiary,
        },
        imagePlaceholder: {
          height: 112,
          borderRadius: 16,
          backgroundColor: colors.surfaceSecondary,
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        },
        imagePlaceholderText: { color: colors.muted, fontSize: 13 },
        imageButtons: { flexDirection: "row", alignItems: "center", gap: 12 },
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

  const [name, setName] = useState(existing?.name ?? "");
  const [dosage, setDosage] = useState(existing?.dosage ?? "");
  const [frequency, setFrequency] = useState(existing?.frequency ?? "Daily");
  const [times, setTimes] = useState<string[]>(existing?.times ?? ["08:00"]);
  const [customTime, setCustomTime] = useState("");
  const [instructions, setInstructions] = useState(existing?.instructions ?? "");
  const [quantity, setQuantity] = useState(existing ? String(existing.quantity_total || "") : "");
  const [identification, setIdentification] = useState(existing?.identification_cue || "");
  const [imageUrl, setImageUrl] = useState(existing?.image_url || "");
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    contentType: string;
  } | null>(null);
  const [memberId, setMemberId] = useState<string | null>(existing ? existing.member_id ?? null : activeMemberId);
  const [days, setDays] = useState<number[]>(existing?.days?.length ? existing.days : [0, 1, 2, 3, 4, 5, 6]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTime = (time: string) =>
    setTimes((current) => (current.includes(time) ? current.filter((value) => value !== time) : [...current, time].sort()));

  const addCustomTime = () => {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(customTime) && !times.includes(customTime)) {
      setTimes((current) => [...current, customTime].sort());
      setCustomTime("");
    }
  };

  const toggleDay = (day: number) =>
    setDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]));

  const chooseImage = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64 || !asset.mimeType) {
        setError("Could not read that photo. Choose a JPEG, PNG, or WebP image.");
        return;
      }
      setSelectedImage({ base64: asset.base64, contentType: asset.mimeType });
    } catch (pickerError) {
      setError(pickerError instanceof Error ? pickerError.message : "Could not open the photo library.");
    }
  };

  const save = async () => {
    if (!name.trim() || !dosage.trim() || times.length === 0) {
      setError("Add a medicine name, dosage, and at least one reminder time.");
      return;
    }
    if (days.length === 0) {
      setError("Choose at least one day of the week.");
      return;
    }
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
        member_id: memberId,
        days,
      };
      if (existing) await updateMedicine(existing.id, input);
      else await addMedicine(input);
      router.back();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t save this medicine.");
    } finally {
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
        <Pressable
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          testID="add-medicine-close"
        >
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{existing ? "Edit medicine" : "Add medicine"}</Text>
        <View style={styles.close} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{existing ? "Keep the details up to date so reminders stay useful." : "Just the essentials. You can always change these later."}</Text>

        <Field label="Medicine name" value={name} onChangeText={setName} placeholder="e.g. Vitamin D" autoCapitalize="words" testID="medicine-name-input" />
        <Field label="Dosage" value={dosage} onChangeText={setDosage} placeholder="e.g. 1 tablet" testID="medicine-dosage-input" />

        <View style={photoStyles.field}>
          <Text style={photoStyles.label}>Medicine photo</Text>
          {selectedImage || imageUrl ? (
            <Image
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
          ) : (
            <View style={photoStyles.imagePlaceholder}>
              <Ionicons name="image-outline" size={26} color={colors.muted} />
              <Text style={photoStyles.imagePlaceholderText}>Add an optional photo</Text>
            </View>
          )}
          <View style={photoStyles.imageButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose medicine photo"
              testID="medicine-photo-choose"
              disabled={saving}
              onPress={() => void chooseImage()}
              style={({ pressed }) => [photoStyles.imageButton, pressed && photoStyles.pressed]}
            >
              <Text style={photoStyles.imageButtonText}>
                {selectedImage || imageUrl ? "Change photo" : "Choose photo"}
              </Text>
            </Pressable>
            {selectedImage || imageUrl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove medicine photo"
                testID="medicine-photo-remove"
                disabled={saving}
                onPress={() => {
                  setImageUrl("");
                  setSelectedImage(null);
                }}
                style={({ pressed }) => [photoStyles.imageRemoveButton, pressed && photoStyles.pressed]}
              >
                <Text style={photoStyles.imageRemoveText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={photoStyles.helper}>JPEG, PNG, or WebP, up to 5 MB. Stored with your local backend.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Who is this for?</Text>
          <View style={styles.chips}>
            {members.map((member) => (
              <Pressable
                key={member.id}
                testID={`medicine-member-${member.id}`}
                onPress={() => setMemberId(member.id)}
                style={({ pressed }) => [styles.chip, memberId === member.id && styles.chipActive, pressed && styles.pressed]}
              >
                <View style={[styles.chipDot, { backgroundColor: member.color }]} />
                <Text style={[styles.chipText, memberId === member.id && styles.chipTextActive]}>{member.name}</Text>
              </Pressable>
            ))}
            <Pressable
              testID="medicine-member-none"
              onPress={() => setMemberId(null)}
              style={({ pressed }) => [styles.chip, memberId === null && styles.chipActive, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, memberId === null && styles.chipTextActive]}>Shared</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>How often?</Text>
          <View style={styles.chips}>
            {FREQUENCIES.map((item) => (
              <Pressable
                key={item}
                onPress={() => setFrequency(item)}
                style={({ pressed }) => [styles.chip, frequency === item && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, frequency === item && styles.chipTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Which days?</Text>
          <View style={styles.chips}>
            {WEEKDAYS.map((day) => (
              <Pressable
                key={day.id}
                testID={`medicine-day-${day.id}`}
                onPress={() => toggleDay(day.id)}
                style={({ pressed }) => [styles.chipCompact, days.includes(day.id) && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, days.includes(day.id) && styles.chipTextActive]}>{day.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Reminder times</Text>
          <Text style={styles.helper}>Pick preset times or add your own.</Text>
          <View style={styles.chips}>
            {PRESET_TIMES.map((time) => (
              <Pressable
                key={time}
                testID={`medicine-time-${time}`}
                onPress={() => toggleTime(time)}
                style={({ pressed }) => [styles.chip, times.includes(time) && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, times.includes(time) && styles.chipTextActive]}>{time}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.customTime}>
            <TextInput
              value={customTime}
              onChangeText={setCustomTime}
              placeholder="Custom time, e.g. 17:30"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
              style={styles.customInput}
              maxLength={5}
              testID="medicine-custom-time"
            />
            <Pressable onPress={addCustomTime} style={({ pressed }) => [styles.addTime, pressed && styles.pressed]} testID="medicine-custom-add">
              <Text style={styles.addTimeText}>Add</Text>
            </Pressable>
          </View>
          {times.length > 0 ? <Text style={styles.selectedTimes}>Selected: {times.join(" · ")}</Text> : null}
        </View>

        <Field label="How many do you have?" value={quantity} onChangeText={setQuantity} placeholder="Optional" keyboardType="number-pad" />
        <Field label="Identification cue" value={identification} onChangeText={setIdentification} placeholder="e.g. Small round white tablet" multiline />
        <Field label="Extra instructions" value={instructions} onChangeText={setInstructions} placeholder="e.g. After breakfast" multiline />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          testID="save-medicine-button"
          label={saving ? "Saving…" : existing ? "Save changes" : "Save medicine"}
          onPress={save}
          disabled={saving}
        />
        {existing ? (
          <Pressable onPress={archive} disabled={saving} style={({ pressed }) => [styles.archive, pressed && styles.pressed]} testID="archive-medicine-button">
            <Text style={styles.archiveText}>Archive medicine</Text>
          </Pressable>
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
    selectedTimes: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", marginTop: 4 },
    error: { color: colors.error, fontSize: 13 },
    archive: { minHeight: 44, alignItems: "center", justifyContent: "center" },
    archiveText: { color: colors.error, fontSize: 14, fontWeight: "700" },
    pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  }),
);
