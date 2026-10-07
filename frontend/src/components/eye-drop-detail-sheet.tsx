import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { PrimaryButton } from "@/src/components/dawai-ui";
import { StatusPill } from "@/src/components/status-pill";
import { useData } from "@/src/data-context";
import { formatTime } from "@/src/dose-status";
import {
  EYE_LABEL,
  PROTOCOL_STATUS_LABEL,
  nextActionableStep,
  protocolOverallStatus,
  protocolStatusToDoseStatus,
  stepStatuses,
} from "@/src/protocol-status";
import { makeStyles, useTheme } from "@/src/theme";
import type { TodayProtocol } from "@/src/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  protocol: TodayProtocol | null;
};

export function EyeDropDetailSheet({ visible, onClose, protocol }: Props) {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { logProtocolStep, undoProtocolStep, archiveProtocol } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const views = useMemo(() => (protocol ? stepStatuses(protocol.steps) : []), [protocol]);
  const overall = useMemo(() => protocolOverallStatus(views), [views]);
  const next = useMemo(() => nextActionableStep(views), [views]);
  const memberName = protocol?.member_name ?? "";

  if (!protocol) return null;

  const total = protocol.steps.length;
  const takenCount = views.filter((view) => view.logged_at).length;
  const doseStatus = protocolStatusToDoseStatus(overall);

  const markNext = async () => {
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      await logProtocolStep(protocol.protocol_id, next.order);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "That change didn’t save.");
    } finally {
      setBusy(false);
    }
  };

  const undo = async (order: number) => {
    setBusy(true);
    setError(null);
    try {
      await undoProtocolStep(protocol.protocol_id, order);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t undo that step.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await archiveProtocol(protocol.protocol_id);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t remove protocol.");
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      {next ? (
        <PrimaryButton
          testID="protocol-mark-step"
          label={`Mark Step ${next.order} as taken`}
          icon="checkmark"
          onPress={markNext}
          disabled={busy}
        />
      ) : overall === "completed" ? (
        <View style={styles.completedNote}>
          <Ionicons name="checkmark-done" size={16} color={colors.success} />
          <Text style={styles.completedText}>All {total} steps taken. Great job.</Text>
        </View>
      ) : null}
      <View style={styles.actions}>
      <Pressable
        testID="protocol-modify"
        accessibilityRole="button"
        onPress={() => { onClose(); router.push({ pathname: "/add-eye-drop-protocol", params: { id: protocol.protocol_id } }); }}
        disabled={busy}
        style={({ pressed }) => [styles.modifyButton, pressed && styles.pressed]}
      >
        <Ionicons name="pencil" size={16} color={colors.brandPrimary} />
        <Text style={styles.modifyText}>Modify protocol</Text>
      </Pressable>
      <Pressable
        testID="protocol-delete"
        onPress={remove}
        disabled={busy}
        style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
      >
        <Ionicons name="trash-outline" size={16} color={colors.error} />
        <Text style={styles.dangerText}>Remove protocol</Text>
      </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={protocol.name}
      description={memberName ? `For ${memberName}` : undefined}
      footer={footer}
      testID="eye-drop-detail-sheet"
    >
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <Ionicons name="water" size={24} color={colors.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dosageLabel}>{total}-STEP PROTOCOL</Text>
          <Text style={styles.dosageValue}>
            {formatTime(protocol.start_time)} · Every {protocol.interval_minutes} min
          </Text>
          <Text style={styles.metaLine}>
            {takenCount} / {total} taken · {PROTOCOL_STATUS_LABEL[overall]}
          </Text>
        </View>
        <StatusPill status={doseStatus} testID="protocol-status" />
      </View>

      <View style={styles.stepList}>
        {views.map((view, index) => {
          const takenOk = view.logged_at;
          return (
            <View key={view.order}>
              <View
                testID={`protocol-step-${view.order}`}
                style={[styles.stepRow, takenOk && styles.stepRowTaken]}
              >
                <View style={styles.stepIndex}>
                  <Text style={styles.stepIndexText}>{view.order}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepName}>{view.medicine_name}</Text>
                  <Text style={styles.stepMeta}>
                    {view.dose} · {EYE_LABEL[view.eye]} · {formatTime(view.time)}
                  </Text>
                </View>
                {takenOk ? (
                  <Pressable
                    testID={`protocol-step-undo-${view.order}`}
                    onPress={() => undo(view.order)}
                    style={({ pressed }) => [styles.undoButton, pressed && styles.pressed]}
                    disabled={busy}
                  >
                    <Ionicons name="arrow-undo-outline" size={14} color={colors.brandPrimary} />
                    <Text style={styles.undoText}>Undo</Text>
                  </Pressable>
                ) : (
                  <StatusPill status={view.status} testID={`protocol-step-status-${view.order}`} />
                )}
              </View>
              {index < views.length - 1 ? (
                <View style={styles.gap}>
                  <View style={styles.gapLine} />
                  <Text style={styles.gapLabel}>{protocol.interval_minutes} min</Text>
                  <View style={styles.gapLine} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    head: { flexDirection: "row", alignItems: "center", gap: 14 },
    headIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.infoTint,
      alignItems: "center",
      justifyContent: "center",
    },
    dosageLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    dosageValue: { color: colors.onSurface, fontSize: 16, fontWeight: "800", marginTop: 2 },
    metaLine: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
    stepList: { gap: 4 },
    stepRow: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepRowTaken: {
      backgroundColor: colors.brandTertiary,
      borderColor: colors.brandTertiary,
    },
    stepIndex: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    stepIndexText: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
    stepName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    stepMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    gap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 22,
      paddingVertical: 6,
    },
    gapLine: { flex: 1, height: 1, backgroundColor: colors.border },
    gapLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
    undoButton: {
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.brandTertiary,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    undoText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
    completedNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.brandTertiary,
    },
    completedText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
    actions: { flexDirection: "row", gap: 10 },
    modifyButton: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, paddingHorizontal: 8 },
    modifyText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700", flexShrink: 1, textAlign: "center" },
    dangerButton: {
      flex: 1,
      paddingHorizontal: 8,
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.error,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      backgroundColor: colors.surface,
    },
    dangerText: { color: colors.error, fontSize: 13, fontWeight: "700", flexShrink: 1, textAlign: "center" },
    pressed: { opacity: 0.75 },
    error: { color: colors.error, fontSize: 12 },
  }),
);
