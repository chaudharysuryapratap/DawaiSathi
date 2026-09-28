import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { useData } from "@/src/data-context";
import { formatIsoDateTime } from "@/src/dose-status";
import { makeStyles, useTheme } from "@/src/theme";
import type { AttentionItem, AttentionKind } from "@/src/types";

const iconFor: Record<AttentionKind, keyof typeof Ionicons.glyphMap> = {
  "missed-dose": "close-circle-outline",
  "late-dose": "time-outline",
  refill: "reload-outline",
  checkup: "calendar-outline",
  "family-request": "people-outline",
};

const toneFor: Record<AttentionKind, "error" | "warning" | "info" | "brand"> = {
  "missed-dose": "error",
  "late-dose": "warning",
  refill: "warning",
  checkup: "info",
  "family-request": "brand",
};

export function AttentionCenter({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { attention, refresh, logDose } = useData();

  const takeAction = async (item: AttentionItem) => {
    if ((item.kind === "missed-dose" || item.kind === "late-dose") && item.medicine_id) {
      const time = item.id.split(":")[2];
      try {
        await logDose(item.medicine_id, time);
      } catch {
        // no-op — refresh will surface latest state
      }
    } else if (item.kind === "refill" && item.medicine_id) {
      onClose();
      router.push(`/care/medicines?refill=${item.medicine_id}`);
      return;
    } else if (item.kind === "checkup" && item.checkup_id) {
      onClose();
      router.push(`/care/checkups?id=${item.checkup_id}`);
      return;
    }
    await refresh();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Attention"
      description={attention.length > 0 ? `${attention.length} item${attention.length === 1 ? "" : "s"} need your attention` : "You're all caught up"}
      testID="attention-sheet"
    >
      {attention.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-circle-outline" size={30} color={colors.brandPrimary} />
          <Text style={styles.emptyTitle}>Nothing needs you right now</Text>
          <Text style={styles.emptyText}>New missed doses, refill reminders, and checkups will appear here.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {attention.map((item) => {
            const tone = toneFor[item.kind];
            const toneStyle = styles[`tone_${tone}` as keyof typeof styles] as object | undefined;
            return (
              <Pressable
                key={item.id}
                testID={`attention-item-${item.id}`}
                onPress={() => takeAction(item)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={[styles.iconWrap, toneStyle]}>
                  <Ionicons name={iconFor[item.kind]} size={19} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.detail}>{item.detail}</Text>
                  <Text style={styles.when}>{formatIsoDateTime(item.when)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    empty: { alignItems: "center", padding: 22, gap: 8 },
    emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "750" },
    emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
    list: { gap: 10 },
    row: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
    detail: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
    when: { color: colors.muted, fontSize: 11, marginTop: 3 },
    pressed: { opacity: 0.8 },
    tone_error: { backgroundColor: colors.error },
    tone_warning: { backgroundColor: colors.warning },
    tone_info: { backgroundColor: colors.info },
    tone_brand: { backgroundColor: colors.brandPrimary },
  }),
);
