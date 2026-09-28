import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/src/components/app-header";
import { ErrorState, LoadingState, ScreenShell } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

type CareLinkProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
  testID?: string;
  accent?: string;
};

function CareLink({ icon, title, detail, onPress, testID, accent }: CareLinkProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <View style={[styles.linkIcon, accent ? { backgroundColor: accent } : null]}>
        <Ionicons name={icon} size={19} color={accent ? "#FFFFFF" : colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function CareScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { activeFamilyGroup, members, medicines, archivedMedicines, checkups, loading, error, refresh } = useData();

  return (
    <ScreenShell testID="care-screen" header={<AppHeader />}>
      {loading ? (
        <LoadingState label="Loading your Care hub" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <>
          <View style={styles.headline}>
            <Text style={styles.eyebrow}>CARE</Text>
            <Text style={styles.title}>What are you managing?</Text>
            <Text style={styles.subtitle}>Family, medicines, calendar, and prescriptions — organised in one place.</Text>
          </View>

          <Section title="Family">
            <CareLink
              icon="people-outline"
              title={activeFamilyGroup?.name ?? "My Family"}
              detail={`${members.length} ${members.length === 1 ? "member" : "members"} · Family group`}
              onPress={() => router.push("/care/family")}
              testID="care-family"
            />
            {members.slice(0, 4).map((member) => (
              <CareLink
                key={member.id}
                icon="person-circle-outline"
                title={member.name}
                detail={member.is_primary ? "Primary member" : member.role || "Member"}
                onPress={() => router.push({ pathname: "/care/family", params: { id: member.id } })}
                testID={`care-member-${member.id}`}
                accent={member.color}
              />
            ))}
          </Section>

          <Section title="Care tools">
            <CareLink
              icon="medical-outline"
              title="Medicines"
              detail={`${medicines.length} active${archivedMedicines.length ? ` · ${archivedMedicines.length} archived` : ""}`}
              onPress={() => router.push("/care/medicines")}
              testID="care-medicines"
            />
            <CareLink
              icon="calendar-outline"
              title="Schedule"
              detail={`Calendar · ${checkups.length} ${checkups.length === 1 ? "checkup" : "checkups"}`}
              onPress={() => router.push("/care/calendar")}
              testID="care-schedule"
            />
            <CareLink
              icon="scan-outline"
              title="Prescription"
              detail="Scan · Upload · Review with AI"
              onPress={() => router.push("/care/prescription")}
              testID="care-prescription"
            />
          </Section>

          <Section title="Family management">
            <CareLink
              icon="settings-outline"
              title="Family management"
              detail="Invite, rename, roles, join requests"
              onPress={() => router.push("/care/family-management")}
              testID="care-family-management"
            />
          </Section>
        </>
      )}
    </ScreenShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    headline: { gap: 4 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    section: { gap: 8 },
    sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    card: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 20,
      paddingHorizontal: 14,
      overflow: "hidden",
    },
    link: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    linkIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    linkTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "750" },
    linkDetail: { color: colors.muted, fontSize: 12, marginTop: 2 },
    pressed: { opacity: 0.8 },
  }),
);
