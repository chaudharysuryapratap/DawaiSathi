import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "@/src/theme";

const CAPABILITIES = [
  { icon: "person-add-outline", title: "Invite members", detail: "Share a code or link to invite a family member." },
  { icon: "shield-checkmark-outline", title: "Roles & permissions", detail: "Choose who can add, edit, or only view." },
  { icon: "mail-open-outline", title: "Join requests", detail: "Approve or reject requests to join your family." },
  { icon: "swap-horizontal-outline", title: "Switch families", detail: "Move between families you belong to." },
  { icon: "trash-outline", title: "Leave or remove", detail: "Leave a family or delete one you created." },
] as const;

export default function FamilyManagementScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Family management" }} />
      <View style={[styles.content, { paddingBottom: insets.bottom + 60 }]}>
        <Text style={styles.eyebrow}>FAMILY MANAGEMENT</Text>
        <Text style={styles.title}>Manage your family</Text>
        <Text style={styles.subtitle}>
          Family, roles, invitations, and join requests all live here. Existing DawaiSathi family features
          plug into this shell as they roll out.
        </Text>
        <View style={styles.list}>
          {CAPABILITIES.map((item) => (
            <View key={item.title} style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name={item.icon} size={19} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    content: { padding: 20, gap: 14 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    list: { gap: 8 },
    row: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandTertiary,
    },
    rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    rowDetail: { color: colors.muted, fontSize: 12, marginTop: 2 },
  }),
);
