import PressableScale from "@/src/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { TextInput } from "@/src/components/focus-input";

import { FamilyInviteSheet } from "@/src/components/family-invite-sheet";
import { FamilyQrScanner } from "@/src/components/family-qr-scanner";
import { SwipeDeleteRow } from "@/src/components/swipe-delete-row";
import { DeleteConfirmation } from "@/src/components/delete-confirmation";
import type { FamilyGroup } from "@/src/types";
import { isFamilyCode } from "@/src/family-code";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

export function FamilyGroupSelector({ accessOnly = false }: { accessOnly?: boolean } = {}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { width, fontScale } = useWindowDimensions();
  const stackedCards = width < 360 || fontScale > 1.25;
  const { user } = useAuth();
  const {
    familyGroups,
    activeFamilyGroup,
    activeFamilyGroupId,
    setActiveFamilyGroup,
    createFamilyGroup,
    renameFamilyGroup,
    deleteFamilyGroup,
    leaveFamilyGroup,
    refresh,
  } = useData();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState("");
  const [form, setForm] = useState<"join" | "create" | null>(null);
  const [role, setRole] = useState<"member" | "care_taker">("member");
  const [scanning, setScanning] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FamilyGroup | null>(null);
  const deleting = useRef(false);

  const removeGroup = async () => {
    if (!pendingDelete || deleting.current) return;
    deleting.current = true;
    setBusy(true); setError(null);
    try {
      if (pendingDelete.owner_user_id === user?.id) await deleteFamilyGroup(pendingDelete.id);
      else await leaveFamilyGroup(pendingDelete.id);
      setPendingDelete(null); setOpenRow(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove this family.");
    } finally { deleting.current = false; setBusy(false); }
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setNameError("Enter the family name");
      return;
    }
    setNameError(null);
    setBusy(true);
    setError(null);
    try {
      const created = await createFamilyGroup(name, role);
      setActiveFamilyGroup(created.id);
      setNewName("");
      setForm(null); setOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t create family group");
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async () => {
    const name = renameValue.trim();
    if (!editingId || !name) return;
    setBusy(true);
    setError(null);
    try {
      await renameFamilyGroup(editingId, name);
      setEditingId(null);
      setRenameValue("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t rename family group");
    } finally {
      setBusy(false);
    }
  };

  const submitJoin = async () => {
    if (!joinToken.trim()) {
      setJoinError("Family code is not present");
      return;
    }
    setJoinError(null);
    setBusy(true);
    setError(null);
    try {
      const joined = await (isFamilyCode(joinToken) ? api.acceptFamilyCode(joinToken.trim()) : api.acceptFamilyInvitation(joinToken.trim()));
      await refresh();
      setActiveFamilyGroup(joined.family_group_id);
      setJoinToken("");
      setForm(null); setOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t join this family");
    } finally {
      setBusy(false);
    }
  };

  const label = activeFamilyGroup?.name ?? "Create family group";
  const familyLabel = label === "Create family group" ? label : label + "'s Family";
  const accessCards = <View style={[styles.cardGrid, stackedCards && styles.stackedCards]}>
    {(["join", "create"] as const).map(kind => <LinearGradient key={kind} colors={kind === "join" ? ["#F7FCFA", "#E3F4EC"] : ["#FFFCF7", "#FFF0DC"]} style={[styles.featureCard, kind === "join" ? styles.joinCard : styles.newCard, stackedCards && styles.stackedCard]}>
      <View style={styles.featureContent}><Text accessibilityRole="header" style={styles.featureTitle}>{kind === "join" ? "Join a family" : "Create a family"}</Text><Text style={styles.featureDetail}>{kind === "join" ? "Enter the family code or invitation shared with you." : "Give a name to your family group."}</Text></View>
      <View style={styles.cardFooter}><Image source={kind === "join" ? require("../../assets/images/family-join.svg") : require("../../assets/images/family-create.svg")} style={styles.cardArt} contentFit="contain" contentPosition="top" accessible={false} />
        <PressableScale accessibilityRole="button" accessibilityLabel={kind === "join" ? "Join family" : "Create family"} accessibilityState={{ disabled: busy }} onPress={() => { setForm(kind); setOpen(true); setOpenRow(null); setError(null); }} disabled={busy} testID={kind === "join" ? "family-invitation-accept" : "family-group-create"} style={({ pressed }) => [styles.featureButton, kind === "join" ? styles.joinButton : styles.createButton, pressed && styles.pressed]}><Text style={styles.buttonLabel}>{kind === "join" ? "Join family" : "Create family"}</Text><Ionicons name="arrow-forward" size={22} color="#FFFFFF" /></PressableScale>
      </View>
    </LinearGradient>)}
  </View>;

  return (
    <>
      {accessOnly ? accessCards : <Pressable
        testID="family-group-selector"
        accessibilityLabel={`Switch family group, currently ${familyLabel}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
      >
        <Text style={styles.selectorLabel} numberOfLines={2}>{familyLabel}</Text>
      </Pressable>}

      <BottomSheet
        visible={open}
        onDismissAll={() => { if (!busy) { setOpen(false); setForm(null); setScanning(false); setPendingDelete(null); setEditingId(null); setError(null); } }}
        onClose={() => {
          if (busy) return;
          if (scanning) { setScanning(false); return; }
          if (pendingDelete) { setPendingDelete(null); return; }
          if (form) { setForm(null); if (accessOnly) setOpen(false); return; }
          setOpen(false);
          setEditingId(null);
          setRenameValue("");
          setError(null);
          setJoinError(null);
          setNameError(null);
          setOpenRow(null);
          setPendingDelete(null);
          setForm(null);
          setScanning(false);
        }}
        title={pendingDelete ? (pendingDelete.owner_user_id === user?.id ? "Delete family?" : "Leave family?") : form === "create" ? "Create a Family" : form === "join" ? "Join a Family" : "Family groups"}
        description={pendingDelete ? undefined : form === "create" ? "Create another family group and manage it from your family selector." : form === "join" ? "Enter the family code or invitation shared with you." : "Switch the family whose care data you want to see."}
        testID="family-group-picker-sheet"
        appearance="family"
      >
        {pendingDelete ? <DeleteConfirmation
          message={pendingDelete.owner_user_id === user?.id
            ? `Delete “${pendingDelete.name}”? Everyone will lose access to this family's profiles and health records. Login accounts and other families stay unchanged. You can restore this family and its members from Deleted families within 30 days.`
            : `Leave “${pendingDelete.name}”? You will lose access to its health records. The family and its other members will stay unchanged.`}
          label={pendingDelete.owner_user_id === user?.id ? "Delete family" : "Leave family"}
          busy={busy} error={error} onCancel={() => { setPendingDelete(null); setError(null); }} onConfirm={() => { void removeGroup(); }}
        /> : scanning ? <FamilyQrScanner onScan={code => { setJoinToken(code); setJoinError(null); setScanning(false); }} onCancel={() => setScanning(false)} /> : form ? <View style={{ gap: 18 }}>
          <View style={[styles.formInputBar, inputFocused && { borderColor: colors.brandPrimary, boxShadow: "0 0 0 2px rgba(19,134,125,0.12)" }]}>
          <TextInput focusOutline={false} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} accessibilityLabel={form === "create" ? "New family group name" : "Family invitation token"} testID={form === "create" ? "family-group-name-input" : "family-invitation-token"} value={form === "create" ? newName : joinToken} onChangeText={value => { if (form === "create") { setNewName(value); setNameError(null); } else { setJoinToken(value); setJoinError(null); } }} placeholder={form === "create" ? "e.g. Sharma" : "Family code or invitation"} placeholderTextColor={colors.muted} autoCapitalize={form === "create" ? "words" : "none"} autoCorrect={false} style={[styles.input, { borderWidth: 0 }]} />
          {form === "join" && <PressableScale scaleTo={0.88} hitSlop={14} accessibilityRole="button" accessibilityLabel="Scan family QR code" testID="family-scan-qr" onPress={() => setScanning(true)} style={styles.mini}><Ionicons name="scan-outline" size={24} color={colors.brandPrimary} /></PressableScale>}
          </View>
          {(form === "create" ? nameError : joinError) ? <Text accessibilityRole="alert" style={styles.fieldError}>{form === "create" ? nameError : joinError}</Text> : null}
          {form === "create" && <><Text style={styles.detail}>Your role in this group</Text><View style={{ flexDirection: "row", gap: 10 }}>{(["member", "care_taker"] as const).map(value => <PressableScale key={value} accessibilityRole="button" accessibilityState={{ selected: role === value }} onPress={() => setRole(value)} style={[styles.roleButton, role === value && styles.roleSelected]}><Text style={styles.roleLabel}>{value === "member" ? "Member" : "Caretaker"}</Text></PressableScale>)}</View></>}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <PressableScale accessibilityRole="button" disabled={busy} testID={form === "create" ? "family-create-submit" : "family-join-submit"} onPress={form === "create" ? submitCreate : submitJoin} style={[styles.formButton, busy && { opacity: 0.6 }]}><Text style={styles.formButtonLabel}>{busy ? "Please wait…" : form === "create" ? "Create Family" : "Join Family"}</Text></PressableScale>
          <PressableScale accessibilityRole="button" disabled={busy} onPress={() => { setForm(null); if (accessOnly) setOpen(false); setError(null); }} style={styles.roleButton}><Text style={styles.detail}>Cancel</Text></PressableScale>
        </View> : <>
        <View style={styles.list}>
          {familyGroups.map((group) => {
            const selected = group.id === activeFamilyGroupId;
            const editing = editingId === group.id;
            return (
              <View key={group.id} style={styles.groupWrap}>
                <SwipeDeleteRow testID={`family-swipe-${group.id}`} open={openRow === group.id} disabled={busy || editing}
                  label={group.owner_user_id === user?.id ? "Delete" : "Leave"}
                  onOpen={() => setOpenRow(group.id)} onClose={() => setOpenRow(current => current === group.id ? null : current)}
                  onRequestDelete={() => { setOpenRow(null); setError(null); setPendingDelete(group); }}>
                <View style={[styles.row, selected && styles.rowSelected]}>
                  <PressableScale
                  testID={`family-group-${group.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${group.name}`}
                  accessibilityState={{ selected }}
                  disabled={busy || editing}
                  onPress={() => {
                    setActiveFamilyGroup(group.id);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                >
                  <View style={styles.groupIcon}>
                    <Ionicons name="people-outline" size={25} color="#13867D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    {editing ? (
                      <TextInput
                        testID={`family-group-rename-${group.id}`}
                        value={renameValue}
                        onChangeText={setRenameValue}
                        placeholder="Family group name"
                        placeholderTextColor={colors.muted}
                        style={styles.renameInput}
                        autoFocus
                      />
                    ) : (
                      <Text style={styles.name}>{/\bfamily\s*$/i.test(group.name) ? group.name : `${group.name}’s Family`}</Text>
                    )}
                    <Text style={styles.detail}>
                      {group.member_count} {group.member_count === 1 ? "member" : "members"}
                    </Text>
                  </View>
                  </PressableScale>

                {editing ? (
                  <View style={styles.actions}>
                    <PressableScale scaleTo={0.88} hitSlop={14} accessibilityRole="button" accessibilityLabel="Save family name" onPress={submitRename} disabled={busy} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                      <Ionicons name="checkmark" size={16} color={colors.brandPrimary} />
                    </PressableScale>
                    <PressableScale scaleTo={0.88} hitSlop={14} accessibilityRole="button" accessibilityLabel="Cancel rename" onPress={() => { setEditingId(null); setRenameValue(""); }} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                      <Ionicons name="close" size={16} color={colors.onSurfaceSecondary} />
                    </PressableScale>
                  </View>
                ) : group.owner_user_id === user?.id ? (
                  <PressableScale scaleTo={0.88} hitSlop={14}
                    testID={`family-group-edit-${group.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Rename ${group.name}`}
                    onPress={() => {
                      setEditingId(group.id);
                      setRenameValue(group.name);
                    }}
                    style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
                  >
                    <Ionicons name="pencil" size={20} color="#596565" />
                  </PressableScale>
                ) : null}
                {group.owner_user_id === user?.id && !editing ? (
                  <PressableScale scaleTo={0.88} hitSlop={14}
                    accessibilityRole="button"
                    accessibilityLabel={`Invite someone to ${group.name}`}
                    testID={`family-group-invite-${group.id}`}
                    onPress={() => {
                      setInvitingId(group.id);
                      setError(null);
                    }}
                    style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
                  >
                    <Ionicons name="person-add-outline" size={22} color="#13867D" />
                  </PressableScale>
                ) : null}
                {!editing && <PressableScale scaleTo={0.88} hitSlop={14} accessibilityRole="button" accessibilityLabel={`Removal options for ${group.name}`} testID={`family-options-${group.id}`} disabled={busy} onPress={() => setOpenRow(current => current === group.id ? null : group.id)} style={styles.mini}><Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurfaceSecondary} /></PressableScale>}
                </View>
                </SwipeDeleteRow>
              </View>
            );
          })}
        </View>

        {accessCards}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        </>}
      </BottomSheet>
      <FamilyInviteSheet group={familyGroups.find(group => group.id === invitingId) ?? null} onClose={() => setInvitingId(null)} />
    </>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    selector: {
      alignSelf: "flex-start",
      maxWidth: "100%",
      minWidth: 0,
      flexShrink: 1,
      flex: 1,
      marginRight: 12,
      paddingVertical: 4,
      paddingHorizontal: 0,
    },
    selectorLabel: { color: "#000000", fontSize: 28, lineHeight: 35, fontWeight: "800", letterSpacing: -0.7, flexShrink: 1 },
    list: { gap: 10 },
    groupWrap: { gap: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, backgroundColor: "#F2F8F7", padding: 10, borderWidth: 1.5, borderColor: "transparent" },
    rowSelected: { borderColor: colors.brandPrimary },
    rowMain: {
      flex: 1,
      minHeight: 58,
      borderRadius: 16,
      paddingHorizontal: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    groupIcon: {
      width: 46,
      height: 46,
      borderRadius: 12,
      backgroundColor: "#E0F4EF",
      alignItems: "center",
      justifyContent: "center",
    },
    name: { color: "#000000", fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
    detail: { color: "#7B8593", fontSize: 13, marginTop: 4 },
    actions: { flexDirection: "row", gap: 4 },
    mini: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#E8F2F0",
      alignItems: "center",
      justifyContent: "center",
    },
    renameInput: {
      color: "#000000",
      fontSize: 15,
      fontWeight: "800",
      borderBottomWidth: 1,
      borderBottomColor: colors.brandSecondary,
      paddingVertical: 3,
    },
    cardGrid: { flexDirection: "row", gap: 10, marginTop: 4, alignItems: "stretch" },
    stackedCards: { flexDirection: "column" },
    featureCard: { flex: 1, minWidth: 0, borderRadius: 20, borderWidth: 1, overflow: "hidden" },
    stackedCard: { flex: 0 },
    featureContent: { paddingHorizontal: 12, paddingTop: 12, gap: 6 },
    joinCard: { borderColor: "#E3EEEA" },
    newCard: { borderColor: "#F3EADF" },
    featureTitle: { color: "#090D15", fontSize: 17, lineHeight: 22, fontWeight: "800", letterSpacing: -0.4 },
    featureDetail: { color: "#7B8593", fontSize: 12, lineHeight: 17, minHeight: 34, marginBottom: 3 },
    featureInputWrap: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 9, borderRadius: 11, borderWidth: 1, borderColor: "#DFE5E1", backgroundColor: "#FFFFFFF0" },
    featureInput: { flex: 1, minWidth: 0, color: "#161D22", fontSize: 12, paddingVertical: 0, height: 42 },
    // Artwork spans the card edge-to-edge, with the button over its lower hills.
    cardFooter: { height: 104, marginTop: 4, justifyContent: "flex-end", padding: 8 },
    cardArt: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    featureButton: { minHeight: 46, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, paddingHorizontal: 9, shadowColor: "#42655A", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
    joinButton: { backgroundColor: "#087F73" },
    createButton: { backgroundColor: "#C57128" },
    fieldError: { color: "#AD3434", fontSize: 12, lineHeight: 16 },
    buttonLabel: { flexShrink: 1, color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    inviteCard: {
      flexBasis: "100%",
      borderRadius: 16,
      backgroundColor: colors.surfaceSecondary,
      padding: 14,
      gap: 10,
    },
    inviteCode: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surfaceTertiary,
      color: colors.onSurface,
      fontSize: 13,
      lineHeight: 20,
    },
    success: { color: colors.success, fontSize: 13, fontWeight: "700" },
    createTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
    roleButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" },
    roleSelected: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
    roleLabel: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
    formButton: { minHeight: 52, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
    formButtonLabel: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
    input: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.surfaceTertiary,
      paddingHorizontal: 14,
      color: colors.onSurface,
      fontSize: 15,
    },
    error: { color: colors.error, fontSize: 12 },
    formInputBar: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, backgroundColor: colors.surfaceTertiary, paddingRight: 4 },
    pressed: { opacity: 0.78 },
  }),
);
