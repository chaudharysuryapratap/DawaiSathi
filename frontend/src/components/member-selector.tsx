import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { FamilyInviteSheet } from "@/src/components/family-invite-sheet";
import { SwipeDeleteRow } from "@/src/components/swipe-delete-row";
import { DeleteConfirmation } from "@/src/components/delete-confirmation";
import type { Member } from "@/src/types";
import { useAuth } from "@/src/auth-context";
import { Image } from "expo-image";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

export function MemberSelector() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { user } = useAuth();
  const { activeFamilyGroup, members, activeMember, setActiveMember, updateMember, removeMember } = useData();
  const [showPicker, setShowPicker] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Member | null>(null);
  const deleting = useRef(false);
  const ownsFamily = activeFamilyGroup?.owner_user_id === user?.id;

  const label = activeMember?.name ?? "Select member";
  const dotColor = activeMember?.color ?? colors.brandPrimary;

  const submitRename = async () => {
    if (!renameId || !renameValue.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateMember(renameId, { name: renameValue.trim() });
      setRenameId(null);
      setRenameValue("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t rename member");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (deleting.current) return;
    deleting.current = true;
    setBusy(true);
    setError(null);
    try {
      await removeMember(id);
      setPendingDelete(null);
      setOpenRow(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t remove member");
    } finally {
      deleting.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        testID="member-selector"
        onPress={() => setShowPicker(true)}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Active member ${label}`}
      >
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.selectorLabel}>{label}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.onSurfaceSecondary} />
      </Pressable>
      <BottomSheet
        visible={showPicker}
        onClose={() => {
          if (busy) return;
          setShowPicker(false);
          setRenameId(null);
          setError(null);
          setPendingDelete(null);
          setOpenRow(null);
        }}
        title={pendingDelete ? `Remove ${pendingDelete.name}?` : "Who is this for?"}
        description={pendingDelete ? undefined : "Switch between people you care for."}
        testID="member-picker-sheet"
        appearance="family"
      >
        {pendingDelete ? <DeleteConfirmation
          message={`Remove ${pendingDelete.name} from this family? Their care records will stay here as shared records. Profiles in other families and login accounts will stay unchanged.`}
          label="Remove profile" busy={busy} error={error}
          onCancel={() => { setPendingDelete(null); setError(null); }}
          onConfirm={() => { void remove(pendingDelete.id); }}
        /> : <>
        <View style={styles.list}>
          {members.map((member) => {
            const active = member.id === activeMember?.id;
            const editing = renameId === member.id;
            return (
              <SwipeDeleteRow key={member.id} testID={`member-swipe-${member.id}`} label="Remove"
                open={openRow === member.id} disabled={busy || editing || member.is_primary || !ownsFamily}
                onOpen={() => setOpenRow(member.id)} onClose={() => setOpenRow(current => current === member.id ? null : current)}
                onRequestDelete={() => { setOpenRow(null); setError(null); setPendingDelete(member); }}>
              <View style={[styles.row, active && styles.rowSelected]}>
                <Pressable
                  testID={`member-${member.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${member.name}`}
                  accessibilityState={{ selected: active }}
                  disabled={busy || editing}
                  onPress={() => {
                    setActiveMember(member.id);
                    setShowPicker(false);
                  }}
                  style={({ pressed }) => [styles.rowInner, pressed && styles.pressed]}
                >
                  <View style={styles.avatarFrame}><View style={[styles.avatar, { backgroundColor: member.color }]}>
                    <Text style={styles.avatarLetter}>{member.name.slice(0, 1).toUpperCase()}</Text>
                  </View></View>
                  <View style={{ flex: 1 }}>
                    {editing ? (
                      <TextInput
                        testID={`member-rename-input-${member.id}`}
                        value={renameValue}
                        onChangeText={setRenameValue}
                        placeholder="Rename"
                        placeholderTextColor={colors.muted}
                        style={styles.renameInput}
                        autoFocus
                      />
                    ) : (
                      <Text style={styles.name}>{member.name}</Text>
                    )}
                    <Text style={styles.role}>{member.is_primary ? "Primary member" : member.role || "Member"}</Text>
                  </View>
                </Pressable>
                <View style={styles.rowActions}>
                  {editing ? (
                    <>
                      <Pressable onPress={submitRename} testID={`member-save-${member.id}`} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                        <Ionicons name="checkmark" size={16} color={colors.brandPrimary} />
                      </Pressable>
                      <Pressable onPress={() => { setRenameId(null); setRenameValue(""); }} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                        <Ionicons name="close" size={16} color={colors.onSurfaceSecondary} />
                      </Pressable>
                    </>
                  ) : ownsFamily ? (
                    <>
                      <Pressable onPress={() => { setRenameId(member.id); setRenameValue(member.name); }} testID={`member-edit-${member.id}`} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                        <Ionicons name="pencil" size={22} color={colors.onSurfaceSecondary} />
                      </Pressable>
                      {!member.is_primary ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Removal options for ${member.name}`} disabled={busy} onPress={() => setOpenRow(current => current === member.id ? null : member.id)} testID={`member-options-${member.id}`} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                          <Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurfaceSecondary} />
                        </Pressable>
                      ) : null}
                    </>
                  ) : null}
                </View>
              </View>
              </SwipeDeleteRow>
            );
          })}
        </View>
        <View style={styles.inviteCard}>
          <Image source={require("../../assets/images/member-invite.svg")} style={styles.inviteArt} contentFit="cover" accessible={false} />
          <Text style={styles.cardTitle}>Add family member</Text>
          <Text style={styles.cardDescription}>Add someone you care for to this family group.</Text>
          <Pressable accessibilityRole="button" disabled={!activeFamilyGroup || activeFamilyGroup.owner_user_id !== user?.id} onPress={() => { setShowPicker(false); setInviting(true); }} testID="member-invite" style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed, activeFamilyGroup?.owner_user_id !== user?.id && { opacity: 0.5 }]}>
            <Text style={styles.inviteLabel}>Invite member</Text><Ionicons name="add" size={26} color={colors.onBrandPrimary} />
          </Pressable>
          {activeFamilyGroup?.owner_user_id !== user?.id && <Text style={styles.role}>Only the family owner can invite accounts.</Text>}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        </>}
      </BottomSheet>
      <FamilyInviteSheet group={inviting ? activeFamilyGroup : null} onClose={() => setInviting(false)} />
    </>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    selector: {
      alignSelf: "flex-start",
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.brandTertiary,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    dot: { width: 12, height: 12, borderRadius: 6 },
    selectorLabel: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
    list: { gap: 10 },
    row: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, backgroundColor: colors.surfaceSecondary, borderRadius: 20, borderWidth: 1.5, borderColor: "transparent" },
    rowSelected: { borderColor: colors.brandPrimary },
    rowInner: {
      flex: 1,
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatarFrame: { padding: 4, borderRadius: 12, backgroundColor: colors.brandTertiary },
    avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    avatarLetter: { color: "#FFFFFF", fontWeight: "800", fontSize: 20 },
    name: { color: colors.onSurface, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
    role: { color: colors.muted, fontSize: 13, marginTop: 4 },
    rowActions: { flexDirection: "row", gap: 4 },
    mini: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceTertiary,
    },
    renameInput: {
      color: colors.onSurface,
      fontSize: 15,
      fontWeight: "700",
      borderBottomWidth: 1,
      borderBottomColor: colors.brandSecondary,
      paddingVertical: 4,
    },
    inviteCard: { overflow: "hidden", borderRadius: 20, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.borderStrong, padding: 12, gap: 6 },
    inviteArt: { position: "absolute", right: 0, bottom: 0, width: "100%", height: "100%", opacity: 0.8 },
    cardTitle: { color: colors.onSurface, fontSize: 17, lineHeight: 22, fontWeight: "800", maxWidth: "85%" },
    cardDescription: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 17, maxWidth: "68%" },
    inviteButton: { alignSelf: "flex-start", marginTop: 10, minHeight: 46, flexDirection: "row", gap: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary, borderRadius: 13, paddingHorizontal: 14 },
    inviteLabel: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "800" },
    error: { color: colors.error, fontSize: 12 },
    pressed: { opacity: 0.75 },
  }),
);
