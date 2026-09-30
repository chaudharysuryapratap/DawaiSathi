import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { PrimaryButton } from "@/src/components/dawai-ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

export function FamilyGroupSelector() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { user } = useAuth();
  const {
    familyGroups,
    activeFamilyGroup,
    activeFamilyGroupId,
    setActiveFamilyGroup,
    createFamilyGroup,
    renameFamilyGroup,
    refresh,
  } = useData();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState("");
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) return;
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

  const submitInvite = async () => {
    if (!invitingId || !inviteEmail.trim()) return;
    setBusy(true);
    setError(null);
    setInviteToken(null);
    try {
      const invitation = await api.createFamilyInvitation(invitingId, inviteEmail.trim());
      setInviteToken(invitation.token);
      setInviteEmail("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t create invitation");
    } finally {
      setBusy(false);
    }
  };

  const submitJoin = async () => {
    if (!joinToken.trim()) return;
    setBusy(true);
    setError(null);
    setJoinMessage(null);
    try {
      const joined = await api.acceptFamilyInvitation(joinToken.trim());
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
  const familyLabel = label === "Create family group" ? label : label + "'s family";

  return (
    <>
      <Pressable
        testID="family-group-selector"
        accessibilityLabel={`Switch family group, currently ${familyLabel}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
      >
        <Text style={styles.selectorLabel} numberOfLines={1}>{familyLabel}</Text>
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => {
          setOpen(false);
          setEditingId(null);
          setRenameValue("");
          setError(null);
        }}
        title="Family groups"
        description="Switch the family whose care data you want to see."
        testID="family-group-picker-sheet"
      >
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {familyGroups.map((group) => {
            const selected = group.id === activeFamilyGroupId;
            const editing = editingId === group.id;
            return (
              <View key={group.id} style={styles.groupWrap}>
                <View style={styles.row}>
                  <Pressable
                  testID={`family-group-${group.id}`}
                  onPress={() => {
                    setActiveFamilyGroup(group.id);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                >
                  <View style={styles.groupIcon}>
                    <Ionicons name="people-outline" size={18} color={colors.brandPrimary} />
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
                      <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
                    )}
                    <Text style={styles.detail}>
                      {group.member_count} {group.member_count === 1 ? "member" : "members"}
                    </Text>
                  </View>
                  {selected && !editing ? (
                    <Ionicons name="checkmark-circle" size={21} color={colors.brandPrimary} />
                  ) : null}
                  </Pressable>

                {editing ? (
                  <View style={styles.actions}>
                    <Pressable onPress={submitRename} disabled={busy} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                      <Ionicons name="checkmark" size={16} color={colors.brandPrimary} />
                    </Pressable>
                    <Pressable onPress={() => { setEditingId(null); setRenameValue(""); }} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                      <Ionicons name="close" size={16} color={colors.onSurfaceSecondary} />
                    </Pressable>
                  </View>
                ) : group.owner_user_id === user?.id ? (
                  <Pressable
                    testID={`family-group-edit-${group.id}`}
                    onPress={() => {
                      setEditingId(group.id);
                      setRenameValue(group.name);
                    }}
                    style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
                  >
                    <Ionicons name="pencil" size={15} color={colors.onSurfaceSecondary} />
                  </Pressable>
                ) : null}
                {group.owner_user_id === user?.id && !editing ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Invite someone to ${group.name}`}
                    testID={`family-group-invite-${group.id}`}
                    onPress={() => {
                      setInvitingId(invitingId === group.id ? null : group.id);
                      setInviteToken(null);
                      setInviteEmail("");
                      setError(null);
                    }}
                    style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
                  >
                    <Ionicons name="person-add-outline" size={16} color={colors.brandPrimary} />
                  </Pressable>
                ) : null}
                </View>
                {invitingId === group.id ? (
                  <View style={styles.inviteCard}>
                    <Text style={styles.createTitle}>Invite to {group.name}</Text>
                    <TextInput
                      accessibilityLabel="Invitee email address"
                      testID="family-invite-email"
                      value={inviteEmail}
                      onChangeText={setInviteEmail}
                      placeholder="family@example.com"
                      placeholderTextColor={colors.muted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.input}
                    />
                    <PrimaryButton
                      label={busy ? "Creating…" : "Create invitation"}
                      onPress={submitInvite}
                      disabled={busy || !inviteEmail.trim()}
                      testID="family-invite-create"
                    />
                    {inviteToken ? (
                      <Text selectable accessibilityLabel="Invitation token" style={styles.inviteCode}>
                        Share this 7-day token with the invited person:{"\n"}{inviteToken}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.createCard}>
          <Text style={styles.createTitle}>Join a family</Text>
          <Text style={styles.detail}>Enter the invitation token shared with your account email.</Text>
          <TextInput
            accessibilityLabel="Family invitation token"
            testID="family-invitation-token"
            value={joinToken}
            onChangeText={setJoinToken}
            placeholder="Invitation token"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.input}
          />
          <PrimaryButton
            label={busy ? "Joining…" : "Join family"}
            onPress={submitJoin}
            disabled={busy || !joinToken.trim()}
            testID="family-invitation-accept"
          />
          {joinMessage ? <Text style={styles.success}>{joinMessage}</Text> : null}
        </View>

        <View style={styles.createCard}>
          <Text style={styles.createTitle}>Write your family group name</Text>
          <TextInput
            testID="family-group-name-input"
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Sharma Family"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={60}
          />
          <PrimaryButton label="Create family group" icon="people" onPress={submitCreate} disabled={busy || !newName.trim()} testID="family-group-create" />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </BottomSheet>
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
      paddingVertical: 4,
      paddingHorizontal: 0,
    },
    selectorLabel: { color: colors.onSurface, fontSize: 24, fontWeight: "800", letterSpacing: -0.3, flexShrink: 1 },
    list: { gap: 8 },
    groupWrap: { gap: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowMain: {
      flex: 1,
      minHeight: 64,
      borderRadius: 16,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surfaceSecondary,
    },
    groupIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    name: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    detail: { color: colors.muted, fontSize: 12, marginTop: 2 },
    actions: { flexDirection: "row", gap: 4 },
    mini: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    renameInput: {
      color: colors.onSurface,
      fontSize: 15,
      fontWeight: "800",
      borderBottomWidth: 1,
      borderBottomColor: colors.brandSecondary,
      paddingVertical: 3,
    },
    createCard: {
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
      padding: 14,
      gap: 10,
      marginTop: 4,
    },
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
