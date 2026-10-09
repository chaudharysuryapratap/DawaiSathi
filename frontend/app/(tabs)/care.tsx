import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { AppHeader } from "@/src/components/app-header";
import { FamilyReminderButton } from "@/src/components/family-reminder-button";
import { CareIllustration } from "@/src/components/care-illustration";
import { ErrorState, LoadingState, ScreenShell } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";

const actions = [
  { kind: "medicine", title: "Medicines", detail: "Add, edit, or\nrefill medicines", route: "/care/medicines", testID: "care-medicines", tint: "#E0F5EE", border: "#E1F1EB", background: ["#F6FCF9", "#F0FAF7"], accent: "#008D7F" },
  { kind: "appointment", title: "Checkups", detail: "View or add\ndoctor checkups", route: "/care/calendar", testID: "care-appointments", tint: "#FFF1D2", border: "#FCF0D9", background: ["#FFFCF5", "#FFFAEE"], accent: "#F5A62F" },
  { kind: "prescription", title: "Prescriptions", detail: "View, upload, or\nscan prescriptions", route: "/care/prescription", testID: "care-prescriptions", tint: "#E1EEFF", border: "#E2EFFF", background: ["#F4F9FF", "#F0F7FF"], accent: "#3476F0" },
  { kind: "family", title: "Family members", detail: "Manage family\nmembers and access", route: "/care/family-management", testID: "care-family-management", tint: "#EBE3FF", border: "#ECE5FF", background: ["#F9F6FF", "#F5F1FF"], accent: "#6243C7" },
] as const;

export default function CareScreen() {
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = fontScale >= 1.2 || width < 360;
  const { loading, error, refresh } = useData();
  return <ScreenShell testID="care-screen" header={<AppHeader />}>
    {loading ? <LoadingState label="Loading Care" /> : error ? <ErrorState message={error} onRetry={refresh} /> : <View style={styles.content}>
      <FamilyReminderButton onSend={async () => {
        // Temporary UI preview requested by the user. No notifications are sent.
        // Replace this no-op with the delivery API when notifications are integrated.
      }} />
      <View testID="care-card-grid" style={[styles.grid, singleColumn && styles.singleGrid]}>
        {actions.map(action => <Pressable key={action.kind} accessibilityRole="button" accessibilityLabel={action.title + ". " + action.detail.replace("\n", " ")} accessibilityHint="Opens management tools" testID={action.testID} onPress={() => router.push(action.route)} style={({ pressed }) => [styles.cardWrap, singleColumn && styles.singleCard, pressed && styles.pressed]}>
          <LinearGradient colors={action.background} style={[styles.card, { borderColor: action.border }]}>
            <View style={[styles.iconTile, { backgroundColor: action.tint }]}><CareIllustration kind={action.kind} /></View>
            <Text style={styles.cardTitle}>{action.title}</Text>
            <View style={styles.cardBottom}>
              <Text style={styles.cardDetail}>{singleColumn ? action.detail.replace("\n", " ") : action.detail}</Text>
              <View style={[styles.arrow, singleColumn && { position: "relative" }, { backgroundColor: action.tint }]}><Ionicons name="arrow-forward" size={24} color={action.accent} /></View>
            </View>
          </LinearGradient>
        </Pressable>)}
      </View>
    </View>}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  singleGrid: { flexDirection: "column" },
  cardWrap: { width: "48.5%", flexGrow: 1, minWidth: 0 },
  singleCard: { width: "100%" },
  card: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 14, minHeight: 170, gap: 8 },
  iconTile: { width: 68, height: 68, borderRadius: 25, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  cardTitle: { color: "#0B1020", fontSize: 17, lineHeight: 23, fontWeight: "800", letterSpacing: -0.5 },
  cardBottom: { flexDirection: "row", alignItems: "flex-end", gap: 4, flex: 1 },
  cardDetail: { flex: 1, color: "#767D8B", fontSize: 12, lineHeight: 18 },
  arrow: { position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.8 },
});
