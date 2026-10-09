import PressableScale from "@/src/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AddSheet } from "@/src/components/add-sheet";
import { InboxSheet } from "@/src/components/inbox-sheet";
import { FamilyGroupSelector } from "@/src/components/family-group-selector";
import { MemberSelector } from "@/src/components/member-selector";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

export function AppHeader({ testID }: { testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { attention } = useData();
  const [showInbox, setShowInbox] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const count = attention.length;
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.brandRow}>
        <FamilyGroupSelector />
        <View style={styles.actions}>
          <PressableScale
            scaleTo={0.88}
            testID="attention-button"
            accessibilityLabel={`Inbox${count ? `, ${count} alerts` : ""}`}
            onPress={() => setShowInbox(true)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.onSurface} />
            {count > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
              </View>
            ) : null}
          </PressableScale>
          <PressableScale scaleTo={0.88} hitSlop={14}
            testID="global-add-button"
            accessibilityLabel="Add"
            onPress={() => setShowAdd(true)}
            style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={24} color={colors.onBrandPrimary} />
          </PressableScale>
        </View>
      </View>
      <View style={styles.memberRow}>
        <MemberSelector />
      </View>
      <AddSheet visible={showAdd} onClose={() => setShowAdd(false)} />
      <InboxSheet visible={showInbox} onClose={() => setShowInbox(false)} />
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
