import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/src/components/dawai-ui";
import { makeStyles, useTheme } from "@/src/theme";

const STEPS = [
  { id: "capture", title: "Scan or upload", detail: "Capture a photo or pick a saved image / PDF." },
  { id: "extract", title: "AI extraction", detail: "We analyse the prescription and pull out medicines." },
  { id: "review", title: "Review", detail: "Confirm each medicine, dose, and schedule." },
  { id: "edit", title: "Edit", detail: "Fine-tune anything the AI missed before saving." },
  { id: "approve", title: "Approve & save", detail: "One tap to add them all to your cabinet." },
];

export default function PrescriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === "upload" ? "upload" : "scan";

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Prescription" }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>PRESCRIPTION</Text>
          <Text style={styles.title}>{mode === "upload" ? "Upload prescription" : "Scan prescription"}</Text>
          <Text style={styles.subtitle}>Digitise a prescription and add every medicine in one review flow.</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={({ pressed }) => [styles.action, pressed && styles.pressed]} testID="prescription-scan">
            <View style={[styles.actionIcon, { backgroundColor: colors.brandPrimary }]}>
              <Ionicons name="scan" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Scan with camera</Text>
              <Text style={styles.actionMeta}>Requires camera permission on device</Text>
            </View>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.action, pressed && styles.pressed]} testID="prescription-upload">
            <View style={[styles.actionIcon, { backgroundColor: colors.info }]}>
              <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Upload image or PDF</Text>
              <Text style={styles.actionMeta}>Choose from Files or Photos</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.notice}>
          <Ionicons name="sparkles-outline" size={18} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>AI review runs on your device once connected</Text>
            <Text style={styles.noticeBody}>
              Enable Claude Sonnet 5 or OpenAI vision to extract medicines automatically. Manual add is always available below.
            </Text>
          </View>
        </View>

        <View style={styles.stepList}>
          {STEPS.map((step, index) => (
            <View key={step.id} style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDetail}>{step.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <PrimaryButton label="Add medicine manually" icon="add" onPress={() => router.push("/add-medicine")} testID="prescription-manual-add" />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    content: { padding: 20, gap: 18 },
    head: { gap: 4 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
    subtitle: { color: colors.muted, fontSize: 13 },
    actionRow: { gap: 10 },
    action: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
    },
    actionIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    actionTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    actionMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    notice: {
      borderRadius: 18,
      backgroundColor: colors.brandTertiary,
      padding: 14,
      flexDirection: "row",
      gap: 10,
    },
    noticeTitle: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800" },
    noticeBody: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 },
    stepList: { gap: 8 },
    step: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surfaceSecondary,
    },
    stepNumber: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.brandPrimary,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumberText: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "800" },
    stepTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
    stepDetail: { color: colors.muted, fontSize: 12, marginTop: 2 },
    pressed: { opacity: 0.85 },
  }),
);
