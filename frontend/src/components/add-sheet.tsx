import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { makeStyles, useTheme } from "@/src/theme";

type AddOption = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  route: string;
};

const OPTIONS: AddOption[] = [
  { id: "add-medicine", title: "Add medicine", description: "Set a new dose and reminder schedule", icon: "medical-outline", route: "/add-medicine" },
  { id: "staggered-eye-drops", title: "Staggered eye drops", description: "Set up an eye-drop protocol with timed steps", icon: "water-outline", route: "/add-eye-drop-protocol" },
  { id: "scan-prescription", title: "Scan prescription", description: "Use the camera to capture a script", icon: "scan-outline", route: "/care/prescription?mode=scan" },
  { id: "upload-prescription", title: "Upload prescription", description: "Choose an image or PDF from your device", icon: "cloud-upload-outline", route: "/care/prescription?mode=upload" },
  { id: "add-checkup", title: "Add checkup", description: "Log a doctor visit or lab appointment", icon: "calendar-outline", route: "/add-checkup" },
];

export function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="What would you like to add?"
      description="Everything you can start from here."
      testID="add-sheet"
    >
      <View style={styles.list}>
        {OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            testID={`add-option-${option.id}`}
            onPress={() => {
              onClose();
              router.push(option.route as never);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={option.icon} size={20} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{option.title}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    list: { gap: 10 },
    row: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
    },
    title: { color: colors.onSurface, fontSize: 15, fontWeight: "750" },
    description: { color: colors.muted, fontSize: 12, marginTop: 2 },
    pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  }),
);
