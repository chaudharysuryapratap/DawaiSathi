import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusPill } from "@/src/components/status-pill";
import { formatTime } from "@/src/dose-status";
import {
  PROTOCOL_STATUS_LABEL,
  nextActionableStep,
  protocolOverallStatus,
  protocolStatusToDoseStatus,
  stepStatuses,
} from "@/src/protocol-status";
import { makeStyles, useTheme } from "@/src/theme";
import type { TodayProtocol } from "@/src/types";

type Props = {
  protocol: TodayProtocol;
  onPress: () => void;
  testID?: string;
};

export function EyeDropCard({ protocol, onPress, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const views = useMemo(() => stepStatuses(protocol.steps), [protocol.steps]);
  const overall = useMemo(() => protocolOverallStatus(views), [views]);
  const takenCount = views.filter((view) => view.logged_at).length;
  const total = views.length;
  const nextStep = useMemo(() => nextActionableStep(views), [views]);
  const activeStep =
    nextStep ??
    views.find((view) => !view.logged_at) ??
    views[views.length - 1];
  const activeIndex = activeStep ? views.findIndex((view) => view.order === activeStep.order) : total - 1;
  const doseStatus = protocolStatusToDoseStatus(overall);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <View style={styles.iconWrap}>
          <Ionicons name="water" size={22} color={colors.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{protocol.name}</Text>
          <Text style={styles.subtitle}>
            {total}-step protocol · Every {protocol.interval_minutes} min
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaLine}>
          {formatTime(protocol.start_time)}–{formatTime(protocol.end_time)}
        </Text>
        <Text style={styles.metaLine}>
          {takenCount} / {total} steps taken
        </Text>
      </View>

      <View style={styles.dots}>
        {views.map((view, index) => {
          const filled = Boolean(view.logged_at);
          const active = index === activeIndex && !filled;
          return (
            <View
              key={view.order}
              style={[
                styles.dot,
                filled && { backgroundColor: colors.brandPrimary },
                active && { backgroundColor: colors.info },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepLabel}>
            {overall === "completed"
              ? `✓ ${PROTOCOL_STATUS_LABEL[overall]}`
              : activeStep
                ? `Step ${activeStep.order} of ${total} · ${activeStep.medicine_name}`
                : PROTOCOL_STATUS_LABEL[overall]}
          </Text>
          {activeStep && overall !== "completed" ? (
            <Text style={styles.stepMeta}>
              {activeStep.dose} · {formatTime(activeStep.time)}
            </Text>
          ) : null}
        </View>
        <StatusPill status={doseStatus} testID={`${testID ?? "eye-drop-card"}-status`} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    card: {
      minHeight: 148,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 12 },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.infoTint,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
    subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
    meta: { flexDirection: "row", justifyContent: "space-between" },
    metaLine: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
    dots: { flexDirection: "row", gap: 6, alignItems: "center" },
    dot: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceTertiary,
    },
    footer: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepLabel: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
    stepMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  }),
);
