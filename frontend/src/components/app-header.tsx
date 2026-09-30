import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AddSheet } from "@/src/components/add-sheet";
import { AttentionCenter } from "@/src/components/attention-center";
import { FamilyGroupSelector } from "@/src/components/family-group-selector";
import { MemberSelector } from "@/src/components/member-selector";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

export function AppHeader({ testID }: { testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { attention } = useData();
  const [showAttention, setShowAttention] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const count = attention.length;
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.brandRow}>
        <FamilyGroupSelector />
        <View style={styles.actions}>
          <Pressable
            testID="attention-button"
            accessibilityLabel={`Attention center${count ? `, ${count} items` : ""}`}
            onPress={() => setShowAttention(true)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.onSurface} />
            {count > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            testID="global-add-button"
            accessibilityLabel="Add"
            onPress={() => setShowAdd(true)}
            style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={24} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.memberRow}>
        <MemberSelector />
      </View>
      <AttentionCenter visible={showAttention} onClose={() => setShowAttention(false)} />
      <AddSheet visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    wrap: { gap: 14 },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    memberRow: { alignItems: "flex-start" },
    brand: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
    actions: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    plusButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.brandPrimary,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: -3,
      right: -3,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: colors.error,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: colors.onError, fontSize: 11, fontWeight: "800" },
    pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  }),
);
