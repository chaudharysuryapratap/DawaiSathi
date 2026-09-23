import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

const presetTimes = ["08:00", "13:00", "20:00"];
const frequencies = ["Daily", "Weekly", "As needed"];

export default function AddMedicineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { medicines, addMedicine, updateMedicine, archiveMedicine } = useData();
  const existing = useMemo(() => medicines.find((medicine) => medicine.id === id), [id, medicines]);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Daily");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [customTime, setCustomTime] = useState("");
  const [instructions, setInstructions] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setDosage(existing.dosage);
    setFrequency(existing.frequency);
    setTimes(existing.times);
    setInstructions(existing.instructions);
    setQuantity(String(existing.quantity_total || ""));
  }, [existing]);

  const toggleTime = (time: string) => setTimes((current) => current.includes(time) ? current.filter((value) => value !== time) : [...current, time].sort());
  const addCustomTime = () => {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(customTime) && !times.includes(customTime)) {
      setTimes((current) => [...current, customTime].sort());
      setCustomTime("");
    }
  };
  const save = async () => {
    if (!name.trim() || !dosage.trim() || times.length === 0) {
      setError("Add a medicine name, dosage, and at least one reminder time.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), dosage: dosage.trim(), frequency, times, instructions: instructions.trim(), quantity_total: Number(quantity) || 0 };
      if (existing) await updateMedicine(existing.id, input); else await addMedicine(input);
      router.back();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t save this medicine.");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!existing) return;
    setSaving(true);
    try { await archiveMedicine(existing.id); router.back(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Couldn’t remove this medicine."); } finally { setSaving(false); }
  };

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}><Pressable accessibilityLabel="Close" onPress={() => router.back()} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable><Text style={styles.headerTitle}>{existing ? "Edit medicine" : "Add medicine"}</Text><View style={styles.closePlaceholder} /></View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>{existing ? "Keep the details up to date so reminders stay useful." : "Just the essentials. You can always change these later."}</Text>
      <Field label="Medicine name" value={name} onChangeText={setName} placeholder="e.g. Vitamin D" autoCapitalize="words" testID="medicine-name-input" />
      <Field label="Dosage" value={dosage} onChangeText={setDosage} placeholder="e.g. 1 tablet" testID="medicine-dosage-input" />
      <View style={styles.field}><Text style={styles.label}>How often?</Text><View style={styles.chips}>{frequencies.map((item) => <Pressable key={item} onPress={() => setFrequency(item)} style={({ pressed }) => [styles.chip, frequency === item && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, frequency === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View></View>
      <View style={styles.field}><Text style={styles.label}>Reminder times</Text><Text style={styles.helper}>Select one or more times each day.</Text><View style={styles.chips}>{presetTimes.map((time) => <Pressable key={time} onPress={() => toggleTime(time)} style={({ pressed }) => [styles.chip, times.includes(time) && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, times.includes(time) && styles.chipTextActive]}>{time}</Text></Pressable>)}</View><View style={styles.customTime}><TextInput value={customTime} onChangeText={setCustomTime} placeholder="Custom time, e.g. 17:30" placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" style={styles.customInput} maxLength={5} /><Pressable onPress={addCustomTime} style={({ pressed }) => [styles.addTime, pressed && styles.pressed]}><Text style={styles.addTimeText}>Add</Text></Pressable></View>{times.length > 0 ? <Text style={styles.selectedTimes}>Selected: {times.join(" · ")}</Text> : null}</View>
      <Field label="How many do you have?" value={quantity} onChangeText={setQuantity} placeholder="Optional" keyboardType="number-pad" />
      <Field label="Extra instructions" value={instructions} onChangeText={setInstructions} placeholder="e.g. After breakfast" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable testID="save-medicine-button" accessibilityRole="button" disabled={saving} onPress={save} style={({ pressed }) => [styles.saveButton, saving && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveText}>{saving ? "Saving…" : existing ? "Save changes" : "Save medicine"}</Text></Pressable>
      {existing ? <Pressable disabled={saving} onPress={remove} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}><Text style={styles.removeText}>Remove medicine</Text></Pressable> : null}
    </ScrollView>
  </KeyboardAvoidingView>;
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize = "sentences", testID }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; keyboardType?: "default" | "number-pad" | "numbers-and-punctuation"; autoCapitalize?: "none" | "sentences" | "words"; testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput testID={testID} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.multiline]} multiline={multiline} keyboardType={keyboardType} autoCapitalize={autoCapitalize} /></View>;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  closePlaceholder: { width: 44 },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  content: { padding: 20, gap: 20 },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  field: { gap: 8 },
  label: { color: colors.onSurface, fontSize: 14, fontWeight: "750" },
  helper: { color: colors.muted, fontSize: 13 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 15, color: colors.onSurface, fontSize: 15 },
  multiline: { minHeight: 88, paddingTop: 14, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  chipActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
  chipTextActive: { color: colors.brandPrimary },
  customTime: { flexDirection: "row", gap: 8 },
  customInput: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 14, color: colors.onSurface, fontSize: 14 },
  addTime: { minWidth: 62, height: 48, borderRadius: 14, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  addTimeText: { color: colors.brandPrimary, fontWeight: "800", fontSize: 14 },
  selectedTimes: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
  error: { color: colors.error, fontSize: 13, lineHeight: 19 },
  saveButton: { minHeight: 52, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: 3 },
  saveText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "800" },
  removeButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  removeText: { color: colors.error, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
}));