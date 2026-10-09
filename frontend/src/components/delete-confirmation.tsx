import PressableScale from "@/src/components/ui/PressableScale";
import { StyleSheet, Text, View } from "react-native";
import { makeStyles } from "@/src/theme";

export function DeleteConfirmation({ message, label, busy, error, onCancel, onConfirm }: {
  message: string; label: string; busy: boolean; error: string | null;
  onCancel: () => void; onConfirm: () => void;
}) {
  const styles = useStyles();
  return <View style={styles.body} testID="delete-confirmation">
    <Text style={styles.message}>{message}</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={styles.actions}>
      <PressableScale accessibilityRole="button" testID="delete-cancel" disabled={busy} onPress={onCancel} style={[styles.button, styles.cancel]}><Text style={styles.cancelText}>Cancel</Text></PressableScale>
      <PressableScale accessibilityRole="button" testID="delete-confirm" disabled={busy} onPress={onConfirm} style={[styles.button, styles.confirm, busy && { opacity: 0.6 }]}><Text style={styles.confirmText}>{busy ? "Please wait…" : label}</Text></PressableScale>
    </View>
  </View>;
}
const useStyles = makeStyles(colors => StyleSheet.create({
  body: { gap: 18 }, message: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", gap: 10 }, button: { flex: 1, minHeight: 48, borderRadius: 13, padding: 12, alignItems: "center", justifyContent: "center" },
  cancel: { backgroundColor: colors.brandTertiary }, confirm: { backgroundColor: colors.error },
  cancelText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700", textAlign: "center" }, confirmText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", textAlign: "center" },
  error: { color: colors.error, fontSize: 13 },
}));
