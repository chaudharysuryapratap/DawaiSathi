import type { DoseStatus } from "@/src/types";
import { StyleSheet, Text, View } from "react-native";

import { makeStyles } from "@/src/theme";
import { STATUS_LABEL } from "@/src/dose-status";

export function StatusPill({ status, testID, compact = false }: { status: DoseStatus; testID?: string; compact?: boolean }) {
  const styles = useStyles();
  const pillStyle = styles[`pill_${status.replace(/-/g, "_")}` as keyof typeof styles] as object | undefined;
  const textStyle = styles[`pillText_${status.replace(/-/g, "_")}` as keyof typeof styles] as object | undefined;
  return (
    <View testID={testID} style={[styles.base, compact && styles.compact, compact && status === "locked" && styles.upcoming, pillStyle]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.text, compact && styles.compactText, compact && status === "locked" && styles.upcomingText, textStyle]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    base: {
      alignSelf: "flex-start",
      maxWidth: "100%",
      flexShrink: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceTertiary,
    },
    text: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.onSurfaceSecondary,
    },
    compact: { paddingHorizontal: 6, paddingVertical: 4 },
    compactText: { fontSize: 12 },
    upcoming: { paddingHorizontal: 8, paddingVertical: 5 },
    upcomingText: { fontSize: 13 },
    pill_locked: { backgroundColor: "#E4ECF2" },
    pillText_locked: { color: "#476988" },
    pill_ready: { backgroundColor: colors.brandTertiary },
    pillText_ready: { color: colors.brandPrimary },
    pill_late: { backgroundColor: "#FBEBD0" },
    pillText_late: { color: "#8A5A00" },
    pill_missed: { backgroundColor: "#F9DAD9" },
    pillText_missed: { color: "#A11919" },
    pill_taken: { backgroundColor: "#DEEDE1" },
    pillText_taken: { color: "#1F5F2C" },
    "pill_taken_late": { backgroundColor: "#FBEBD0" },
    "pillText_taken_late": { color: "#8A5A00" },
    "pill_taken_very_late": { backgroundColor: "#F9DAD9" },
    "pillText_taken_very_late": { color: "#A11919" },
  }),
);
