import PressableScale from "@/src/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/src/components/focus-input";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingState, PrimaryButton } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";
import type { Medicine } from "@/src/types";

export default function MedicinesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { medicines, archivedMedicines, members, loading, restoreMedicine, refillMedicine } = useData();
  const params = useLocalSearchParams<{ refill?: string }>();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [refillFor, setRefillFor] = useState<Medicine | null>(() =>
    params.refill ? medicines.find((medicine) => medicine.id === params.refill) ?? null : null,
  );
  const [refillQuantity, setRefillQuantity] = useState("");

  const list = tab === "active" ? medicines : archivedMedicines;
  const filtered = useMemo(
    () => list.filter((medicine) => `${medicine.name} ${medicine.dosage}`.toLowerCase().includes(query.toLowerCase())),
    [list, query],
  );

  const submitRefill = async () => {
    if (!refillFor) return;
    const quantity = Number(refillQuantity);
    if (!quantity || quantity <= 0) return;
    try {
      await refillMedicine(refillFor.id, quantity);
      Alert.alert("Stock updated", `${refillFor.name} refilled with ${quantity} units.`);
      setRefillFor(null);
      setRefillQuantity("");
    } catch (requestError) {
      Alert.alert("Refill failed", requestError instanceof Error ? requestError.message : "Try again");
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Medicines" }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.eyebrow}>MEDICINE LIBRARY</Text>
          <Text style={styles.title}>Everything in your cabinet</Text>
          <Text style={styles.subtitle}>Search, refill, or archive medicines.</Text>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            testID="medicine-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search medicines"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        <View style={styles.tabs}>
          {(["active", "archived"] as const).map((option) => (
            <PressableScale
              key={option}
              onPress={() => setTab(option)}
              testID={`medicine-tab-${option}`}
              style={({ pressed }) => [styles.tab, tab === option && styles.tabActive, pressed && styles.pressed]}
            >
              <Text style={[styles.tabText, tab === option && styles.tabTextActive]}>
                {option === "active" ? `Active · ${medicines.length}` : `Archived · ${archivedMedicines.length}`}
              </Text>
            </PressableScale>
          ))}
        </View>

        {loading ? (
          <LoadingState label="Loading medicines" />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="medkit-outline" size={30} color={colors.muted} />
            <Text style={styles.emptyTitle}>{tab === "active" ? "No active medicines" : "Nothing archived"}</Text>
            <Text style={styles.emptyText}>{tab === "active" ? "Add a medicine to see it here." : "Archived medicines appear here to restore."}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((medicine) => {
              const owner = medicine.member_id ? members.find((member) => member.id === medicine.member_id) : null;
              return (
                <Pressable
                  key={medicine.id}
                  testID={`medicine-card-${medicine.id}`}
                  onPress={() => router.push({ pathname: "/add-medicine", params: { id: medicine.id } })}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={styles.cardIcon}>
                    <Ionicons name="medical" size={22} color={colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{medicine.name}</Text>
                    <Text style={styles.cardMeta}>{medicine.dosage} · {medicine.times.join(", ")}</Text>
                    {owner ? <Text style={styles.cardOwner}>For {owner.name}</Text> : null}
                    <Text style={styles.cardStock}>
                      {medicine.quantity_total > 0
                        ? `${medicine.quantity_remaining} left of ${medicine.quantity_total}`
                        : "Stock not tracked"}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    {tab === "active" ? (
                      <PressableScale
                        onPress={() => setRefillFor(medicine)}
                        style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                        testID={`medicine-refill-${medicine.id}`}
                      >
                        <Ionicons name="reload-outline" size={14} color={colors.brandPrimary} />
                        <Text style={styles.smallButtonText}>Refill</Text>
                      </PressableScale>
                    ) : (
                      <PressableScale
                        onPress={() => restoreMedicine(medicine.id)}
                        style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                        testID={`medicine-restore-${medicine.id}`}
                      >
                        <Ionicons name="return-up-back-outline" size={14} color={colors.brandPrimary} />
                        <Text style={styles.smallButtonText}>Restore</Text>
                      </PressableScale>
                    )}
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {refillFor ? (
          <View style={styles.refillPanel}>
            <Text style={styles.refillTitle}>Refill {refillFor.name}</Text>
            <TextInput
              value={refillQuantity}
              onChangeText={setRefillQuantity}
              placeholder="How many units are you adding?"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={styles.refillInput}
              testID="refill-quantity-input"
            />
            <View style={styles.refillActions}>
              <PrimaryButton label="Confirm refill" onPress={submitRefill} testID="refill-confirm" />
              <PressableScale
                onPress={() => { setRefillFor(null); setRefillQuantity(""); }}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </PressableScale>
            </View>
          </View>
        ) : null}

        <PrimaryButton label="Add medicine" icon="add" onPress={() => router.push("/add-medicine")} testID="care-medicines-add" />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    content: { padding: 20, gap: 16 },
    head: { gap: 4 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
    subtitle: { color: colors.muted, fontSize: 13 },
    searchBox: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: colors.surfaceTertiary,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 8,
    },
    searchInput: { flex: 1, color: colors.onSurface, fontSize: 14 },
    tabs: { flexDirection: "row", gap: 8 },
    tab: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    tabActive: { backgroundColor: colors.brandPrimary },
    tabText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
    tabTextActive: { color: colors.onBrandPrimary },
    list: { gap: 10 },
    card: {
      minHeight: 96,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
    cardName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    cardMeta: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 3 },
    cardOwner: { color: colors.brandPrimary, fontSize: 12, marginTop: 3, fontWeight: "700" },
    cardStock: { color: colors.muted, fontSize: 11, marginTop: 3 },
    cardActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    smallButton: {
      minHeight: 34,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 4,
    },
    smallButtonText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
    refillPanel: { gap: 10, borderRadius: 18, backgroundColor: colors.brandTertiary, padding: 16 },
    refillTitle: { color: colors.brandPrimary, fontSize: 15, fontWeight: "800" },
    refillInput: {
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      color: colors.onSurface,
      fontSize: 14,
    },
    refillActions: { gap: 8 },
    cancelButton: { minHeight: 42, alignItems: "center", justifyContent: "center" },
    cancelText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
    empty: { alignItems: "center", padding: 24, gap: 8 },
    emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
    emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
    pressed: { opacity: 0.85 },
  }),
);
