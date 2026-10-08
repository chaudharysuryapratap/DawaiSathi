import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Line, Rect } from "react-native-svg";

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
  { id: "add-medicine", title: "Add medicine", description: "Set a new dose and reminder schedule", icon: "bandage-outline", route: "/add-medicine" },
  { id: "staggered-eye-drops", title: "Staggered eye drops", description: "Set up an eye-drop protocol with timed steps", icon: "water-outline", route: "/add-eye-drop-protocol" },
  { id: "scan-prescription", title: "Scan prescription", description: "Use the camera to capture a script", icon: "scan-outline", route: "/care/prescription?mode=scan" },
  { id: "upload-prescription", title: "Upload prescription", description: "Choose an image or PDF from your device", icon: "cloud-upload-outline", route: "/care/prescription?mode=upload" },
  { id: "add-checkup", title: "Add checkup", description: "Log a doctor visit or lab checkup", icon: "calendar-outline", route: "/add-checkup" },
];

export function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="What would you like to do?"
      appearance="family"
      singleLineTitle
      description="Everything you can start from here."
      testID="add-sheet"
    >
      <View style={styles.list}>
        {OPTIONS.map((option, index) => {
          const palette = [{ bg: "#F0F8F6", icon: "#D6F1EC", ink: "#0F766E" }, { bg: "#FFFAF0", icon: "#FFF0CE", ink: "#C67D0A" }, { bg: "#F0F8FE", icon: "#DDF0FF", ink: "#098FD0" }, { bg: "#F6F3FF", icon: "#EAE2FF", ink: "#6D35BD" }, { bg: "#F0F8F6", icon: "#D3EEE7", ink: "#0F766E" }][index];
          return (
          <Pressable
            key={option.id}
            testID={`add-option-${option.id}`}
            onPress={() => {
              onClose();
              router.push(option.route as never);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { backgroundColor: palette.bg }, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, { backgroundColor: palette.icon }]}>
              {option.id === "add-medicine" ? <Svg width={32} height={32} viewBox="0 0 32 32" accessible={false}>
                <G rotation={45} origin="16, 16">
                  <Rect x={9} y={2} width={14} height={28} rx={7} fill="none" stroke={palette.ink} strokeWidth={2.3} />
                  <Line x1={9} y1={16} x2={23} y2={16} stroke={palette.ink} strokeWidth={2.3} />
                </G>
              </Svg> : <Ionicons name={option.id === "scan-prescription" ? "camera-outline" : option.icon} size={30} color={palette.ink} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{option.title}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ); })}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    list: { gap: 10 },
    row: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 22,
      backgroundColor: colors.surfaceSecondary,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
    },
    title: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
    description: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
    pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  }),
);
