import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { PrimaryButton } from "@/src/components/dawai-ui";
import { StatusPill } from "@/src/components/status-pill";
import { useData } from "@/src/data-context";
import {
  TIME_SLOT_LABEL,
  computeDoseStatus,
  formatIsoDate,
  formatTime,
} from "@/src/dose-status";
import { makeStyles, useTheme } from "@/src/theme";
import type { DoseStatus, Medicine, TodayDose } from "@/src/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  dose: TodayDose | null;
};

export function MedicineDetailSheet({ visible, onClose, dose }: Props) {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { medicines, history, members, logDose, undoDose, archiveMedicine } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const medicine: Medicine | undefined = useMemo(
    () => (dose ? medicines.find((item) => item.id === dose.medicine_id) : undefined),
    [dose, medicines],
  );

  const status: DoseStatus | null = useMemo(
    () => (dose ? computeDoseStatus(dose.time, dose.logged_at) : null),
    [dose],
  );

  const recentHistory = useMemo(
    () => (dose ? history.filter((entry) => entry.medicine_id === dose.medicine_id).slice(0, 7) : []),
    [dose, history],
  );

  const memberName = useMemo(() => {
    if (!medicine || !medicine.member_id) return "";
    return members.find((member) => member.id === medicine.member_id)?.name ?? "";
  }, [medicine, members]);

  if (!dose) return null;

  const canMark = status === "ready" || status === "late" || status === "missed";
  const isTaken = status === "taken" || status === "taken-late" || status === "taken-very-late";

  const primary = async () => {
    if (!dose) return;
    setBusy(true);
    setError(null);
    try {
      if (isTaken) {
        await undoDose(dose.medicine_id, dose.time);
      } else {
        await logDose(dose.medicine_id, dose.time);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "That change didn’t save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!medicine) return;
    setBusy(true);
    setError(null);
    try {
      await archiveMedicine(medicine.id);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t remove medicine.");
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      {status === "locked" ? (
        <View style={styles.lockedNote}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.info} />
          <Text style={styles.lockedText}>Locked · Available at {formatTime(dose.time)}</Text>
        </View>
      ) : null}
      {(canMark || isTaken) ? (
        <PrimaryButton
          testID="detail-primary-action"
          label={isTaken ? "Undo taken" : "Mark as taken"}
          icon={isTaken ? "arrow-undo-outline" : "checkmark"}
          onPress={primary}
          disabled={busy}
          variant={isTaken ? "secondary" : "primary"}
        />
      ) : null}
      <View style={styles.secondaryRow}>
        <Pressable
          testID="detail-edit"
          onPress={() => {
            onClose();
            router.push({ pathname: "/add-medicine", params: { id: dose.medicine_id } });
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Ionicons name="pencil" size={16} color={colors.brandPrimary} />
          <Text style={styles.secondaryText}>Edit medicine</Text>
        </Pressable>
        <Pressable
          testID="detail-delete"
          onPress={remove}
          disabled={busy}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={16} color={colors.error} />
          <Text style={styles.dangerText}>Delete</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={dose.medicine_name}
      description={memberName ? `For ${memberName}` : undefined}
      footer={footer}
      testID="medicine-detail-sheet"
    >
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <Ionicons name="medical" size={24} color={colors.brandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dosageLabel}>Dosage</Text>
          <Text style={styles.dosageValue}>{dose.dosage}</Text>
        </View>
        {status ? <StatusPill status={status} testID="detail-status" /> : null}
      </View>
      <View style={styles.metaRow}>
        <MetaBlock label="Schedule" value={`${TIME_SLOT_LABEL[dose.time_slot]} · ${formatTime(dose.time)}`} />
        {dose.instructions ? <MetaBlock label="Instruction" value={dose.instructions} /> : null}
      </View>
      {dose.identification_cue ? (
        <MetaBlock label="Identification" value={dose.identification_cue} />
      ) : null}
      {medicine ? (
        <MetaBlock
          label="Stock"
          value={
            medicine.quantity_total > 0
              ? `${medicine.quantity_remaining} left of ${medicine.quantity_total}`
              : "Not tracked"
          }
        />
      ) : null}
      <View>
        <Text style={styles.sectionTitle}>Dose history</Text>
        <Text style={styles.sectionMeta}>Last 7 logs</Text>
        {recentHistory.length === 0 ? (
          <Text style={styles.historyEmpty}>No dose logs yet for this medicine.</Text>
        ) : (
          <View style={styles.historyList}>
            {recentHistory.map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <Text style={styles.historyDate}>{formatIsoDate(entry.logged_at, { day: "numeric", month: "short" })}</Text>
                <View style={styles.historyDot}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.historyTime}>{formatTime(entry.time)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.metaBlock}>
      <Text style={styles.metaLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    head: { flexDirection: "row", alignItems: "center", gap: 14 },
    headIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    dosageLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    dosageValue: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginTop: 2 },
    metaRow: { flexDirection: "row", gap: 12 },
    metaBlock: {
      flex: 1,
      minHeight: 60,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      gap: 2,
    },
    metaLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
    metaValue: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
    sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
    sectionMeta: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 8 },
    historyEmpty: { color: colors.muted, fontSize: 13, paddingVertical: 8 },
    historyList: { gap: 6 },
    historyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
    },
    historyDate: { minWidth: 66, color: colors.muted, fontSize: 12, fontWeight: "700" },
    historyDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    historyTime: { flex: 1, color: colors.onSurface, fontSize: 13, fontWeight: "700" },
    lockedNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: "#E4ECF2",
    },
    lockedText: { color: "#345169", fontSize: 13, fontWeight: "700" },
    secondaryRow: { flexDirection: "row", gap: 10 },
    secondaryButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },
    secondaryText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
    dangerButton: {
      flex: 1,
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
    dangerText: { color: colors.error, fontSize: 13, fontWeight: "700" },
    pressed: { opacity: 0.75 },
    error: { color: colors.error, fontSize: 12 },
  }),
);
