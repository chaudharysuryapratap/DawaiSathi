import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";

import { FamilyInviteSheet } from "@/src/components/family-invite-sheet";
import { SwipeDeleteRow } from "@/src/components/swipe-delete-row";
import { DeleteConfirmation } from "@/src/components/delete-confirmation";
import type { FamilyGroup } from "@/src/types";
import { isFamilyCode } from "@/src/family-code";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

export function FamilyGroupSelector() {
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
    restoreFamilyGroup,
    leaveFamilyGroup,
    refresh,
  } = useData();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState("");
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FamilyGroup | null>(null);
  const [deletedGroups, setDeletedGroups] = useState<Awaited<ReturnType<typeof api.deletedFamilyGroups>>>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const deleting = useRef(false);

  const removeGroup = async () => {
    if (!pendingDelete || deleting.current) return;
    deleting.current = true;
    setBusy(true); setError(null);
    try {
      if (pendingDelete.owner_user_id === user?.id) await deleteFamilyGroup(pendingDelete.id);
      else await leaveFamilyGroup(pendingDelete.id);
      setPendingDelete(null); setOpenRow(null); setShowDeleted(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove this family.");
    } finally { deleting.current = false; setBusy(false); }
  };
  const loadDeleted = async () => {
    setShowDeleted(true); setLoadingDeleted(true); setError(null);
    try { setDeletedGroups(await api.deletedFamilyGroups()); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not load deleted families."); }
    finally { setLoadingDeleted(false); }
  };
  const restore = async (id: string) => {
    if (deleting.current) return;
    deleting.current = true; setBusy(true); setError(null);
    try {
      await restoreFamilyGroup(id);
      setDeletedGroups(current => current.filter(group => group.id !== id));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not restore this family."); }
    finally { deleting.current = false; setBusy(false); }
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
      const created = await createFamilyGroup(name);
      setActiveFamilyGroup(created.id);
      setNewName("");
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
    setJoinMessage(null);
    try {
      const joined = await (isFamilyCode(joinToken) ? api.acceptFamilyCode(joinToken.trim()) : api.acceptFamilyInvitation(joinToken.trim()));
      await refresh();
      setActiveFamilyGroup(joined.family_group_id);
      setJoinToken("");
      setJoinMessage("You joined the family. Your view is switching now.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t join this family");
    } finally {
      setBusy(false);
    }
  };

  const label = activeFamilyGroup?.name ?? "Create family group";
  const familyLabel = label === "Create family group" ? label : label + "'s Family";

  return (
    <>
      <Pressable
        testID="family-group-selector"
        accessibilityLabel={`Switch family group, currently ${familyLabel}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
      >
        <Text style={styles.selectorLabel} numberOfLines={2}>{familyLabel}</Text>
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => {
          if (busy) return;
          setOpen(false);
          setEditingId(null);
          setRenameValue("");
          setError(null);
          setJoinError(null);
          setNameError(null);
          setOpenRow(null);
          setPendingDelete(null);
          setShowDeleted(false);
        }}
        title={pendingDelete ? (pendingDelete.owner_user_id === user?.id ? "Delete family?" : "Leave family?") : "Family groups"}
        description={pendingDelete ? undefined : "Switch the family whose care data you want to see."}
        testID="family-group-picker-sheet"
        appearance="family"
      >
        {pendingDelete ? <DeleteConfirmation
          message={pendingDelete.owner_user_id === user?.id
            ? `Delete “${pendingDelete.name}”? Everyone will lose access to this family's profiles and health records. Login accounts and other families stay unchanged. You can restore this family and its members from Deleted families within 30 days.`
            : `Leave “${pendingDelete.name}”? You will lose access to its health records. The family and its other members will stay unchanged.`}
          label={pendingDelete.owner_user_id === user?.id ? "Delete family" : "Leave family"}
          busy={busy} error={error} onCancel={() => { setPendingDelete(null); setError(null); }} onConfirm={() => { void removeGroup(); }}
        /> : <>
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
                  <Pressable
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
                  </Pressable>

                {editing ? (
                  <View style={styles.actions}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Save family name" onPress={submitRename} disabled={busy} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                      <Ionicons name="checkmark" size={16} color={colors.brandPrimary} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Cancel rename" onPress={() => { setEditingId(null); setRenameValue(""); }} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                      <Ionicons name="close" size={16} color={colors.onSurfaceSecondary} />
                    </Pressable>
                  </View>
                ) : group.owner_user_id === user?.id ? (
                  <Pressable
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
                  </Pressable>
                ) : null}
                {group.owner_user_id === user?.id && !editing ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Invite someone to ${group.name}`}
                    testID={`family-group-invite-${group.id}`}
                    onPress={() => {
                      setOpen(false);
                      setInvitingId(group.id);
                      setError(null);
                    }}
                    style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
                  >
                    <Ionicons name="person-add-outline" size={22} color="#13867D" />
                  </Pressable>
                ) : null}
                {!editing && <Pressable accessibilityRole="button" accessibilityLabel={`Removal options for ${group.name}`} testID={`family-options-${group.id}`} disabled={busy} onPress={() => setOpenRow(current => current === group.id ? null : group.id)} style={styles.mini}><Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurfaceSecondary} /></Pressable>}
                </View>
                </SwipeDeleteRow>
              </View>
            );
          })}
        </View>

        <View style={[styles.cardGrid, stackedCards && styles.stackedCards]}>
        <LinearGradient colors={["#F7FCFA", "#E3F4EC"]} style={[styles.featureCard, styles.joinCard, stackedCards && styles.stackedCard]}>
          <View style={styles.featureContent}>
          <Text accessibilityRole="header" style={styles.featureTitle}>Join a family</Text>
          <Text style={styles.featureDetail}>Enter the family code or invitation shared with you.</Text>
          <View style={styles.featureInputWrap}>
          <Ionicons name="key-outline" size={19} color="#7E898A" />
          <TextInput
            accessibilityLabel="Family invitation token"
            testID="family-invitation-token"
            value={joinToken}
            onChangeText={(value) => { setJoinToken(value); setJoinError(null); }}
            placeholder="Family code or token"
            placeholderTextColor="#9299A2"
            autoCapitalize="none"
            style={styles.featureInput}
            autoCorrect={false}
            multiline={false}
          />
          </View>
          {joinError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.fieldError}>{joinError}</Text> : null}
          </View>
          <View style={styles.cardFooter}>
          <Image source={require("../../assets/images/family-join.svg")} style={styles.cardArt} contentFit="cover" accessible={false} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} onPress={submitJoin} disabled={busy} testID="family-invitation-accept" style={({ pressed }) => [styles.featureButton, styles.joinButton, pressed && styles.pressed]}>
            <Text style={styles.buttonLabel}>{busy ? "Joining…" : "Join family"}</Text><Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
          </Pressable>
          </View>
          {joinMessage ? <Text style={styles.success}>{joinMessage}</Text> : null}
        </LinearGradient>

        <LinearGradient colors={["#FFFCF7", "#FFF0DC"]} style={[styles.featureCard, styles.newCard, stackedCards && styles.stackedCard]}>
          <View style={styles.featureContent}>
          <Text accessibilityRole="header" style={styles.featureTitle}>Create a family</Text>
          <Text style={styles.featureDetail}>Give a name to your family group.</Text>
          <View style={styles.featureInputWrap}>
          <Ionicons name="people-outline" size={20} color="#7E898A" />
          <TextInput
            accessibilityLabel="New family group name"
            testID="family-group-name-input"
            value={newName}
            onChangeText={(value) => { setNewName(value); setNameError(null); }}
            placeholder="e.g. Sharma"
            placeholderTextColor="#9299A2"
            style={styles.featureInput}
            maxLength={60}
            multiline={false}
          />
          </View>
          {nameError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.fieldError}>{nameError}</Text> : null}
          </View>
          <View style={styles.cardFooter}>
          <Image source={require("../../assets/images/family-create.svg")} style={styles.cardArt} contentFit="cover" accessible={false} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} onPress={submitCreate} disabled={busy} testID="family-group-create" style={({ pressed }) => [styles.featureButton, styles.createButton, pressed && styles.pressed]}>
            <Text style={styles.buttonLabel}>{busy ? "Creating…" : "Create family"}</Text><Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
          </Pressable>
          </View>
        </LinearGradient>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" testID="deleted-families-toggle" disabled={busy || loadingDeleted} onPress={() => { if (showDeleted) setShowDeleted(false); else void loadDeleted(); }} style={styles.recoveryToggle}><Text style={styles.recoveryText}>{showDeleted ? "Hide deleted families" : "Deleted families"}</Text></Pressable>
        {showDeleted && <View style={styles.list}>
          <Text style={styles.detail}>{loadingDeleted ? "Loading…" : deletedGroups.length ? "Restore within 30 days of deletion." : "No families available to restore."}</Text>
          {!loadingDeleted && deletedGroups.map(group => <View key={group.id} style={styles.row}>
            <Text style={[styles.name, { flex: 1 }]}>{group.name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Restore ${group.name}`} testID={`family-restore-${group.id}`} disabled={busy} style={styles.recoveryToggle} onPress={() => { void restore(group.id); }}><Text style={styles.recoveryText}>Restore</Text></Pressable>
          </View>)}
        </View>}
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
    recoveryToggle: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
    recoveryText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
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
    cardFooter: { height: 86, marginTop: 4, justifyContent: "flex-end", padding: 8 },
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
    input: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.surfaceTertiary,
      paddingHorizontal: 14,
      color: colors.onSurface,
      fontSize: 15,
    },
    error: { color: colors.error, fontSize: 12 },
    pressed: { opacity: 0.78 },
  }),
);
