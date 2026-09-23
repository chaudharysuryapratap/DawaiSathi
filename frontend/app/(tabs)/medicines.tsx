import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useData } from "@/src/data-context";
import { EmptyState, ErrorState, LoadingState, PageHeader, PrimaryButton, ScreenShell } from "@/src/components/dawai-ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function MedicinesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const { medicines, loading, error, refresh } = useData();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => medicines.filter((medicine) => `${medicine.name} ${medicine.dosage}`.toLowerCase().includes(query.toLowerCase())), [medicines, query]);
  return <ScreenShell testID="medicines-screen">
    <PageHeader eyebrow="Your cabinet" title="Medicines" subtitle="Everything you take, in one simple place." action={<Pressable accessibilityLabel="Add medicine" onPress={() => router.push("/add-medicine")} style={({ pressed }) => [styles.addIcon, pressed && styles.pressed]}><Ionicons name="add" size={24} color={colors.onBrandPrimary} /></Pressable>} />
    {loading ? <LoadingState label="Loading your medicines" /> : error ? <ErrorState message={error} onRetry={refresh} /> : medicines.length === 0 ? <EmptyState onPress={() => router.push("/add-medicine")} /> : <>
      <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color={colors.muted} /><TextInput testID="medicine-search" value={query} onChangeText={setQuery} placeholder="Search medicines" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" /></View>
      <View style={styles.libraryHeader}><Text style={styles.sectionTitle}>Active medicines</Text><Text style={styles.sectionMeta}>{filtered.length}</Text></View>
      {filtered.length === 0 ? <Text style={styles.noResults}>No medicine matches “{query}”.</Text> : <View style={styles.list}>{filtered.map((medicine) => <Pressable key={medicine.id} testID={`medicine-card-${medicine.id}`} onPress={() => router.push({ pathname: "/add-medicine", params: { id: medicine.id } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.medicineIcon}><Ionicons name="medical" size={20} color={colors.brandPrimary} /></View>
        <View style={styles.cardCopy}><Text style={styles.medicineName}>{medicine.name}</Text><Text style={styles.medicineDetails}>{medicine.dosage} · {medicine.frequency}</Text><Text style={styles.medicineTimes}>{medicine.times.join("  ·  ")}</Text></View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>)}</View>}
      <PrimaryButton label="Add medicine" onPress={() => router.push("/add-medicine")} />
    </>}
  </ScreenShell>;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  addIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  searchBox: { height: 50, borderRadius: 14, backgroundColor: colors.surfaceTertiary, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, gap: 10 },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15 },
  libraryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: colors.onSurface, fontSize: 19, fontWeight: "800" },
  sectionMeta: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800", backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  list: { gap: 10 },
  card: { minHeight: 92, borderRadius: 18, backgroundColor: colors.surfaceSecondary, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  medicineIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  cardCopy: { flex: 1, gap: 4 },
  medicineName: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  medicineDetails: { color: colors.onSurfaceSecondary, fontSize: 13 },
  medicineTimes: { color: colors.muted, fontSize: 12 },
  noResults: { color: colors.muted, fontSize: 14, textAlign: "center", padding: 24 },
}));