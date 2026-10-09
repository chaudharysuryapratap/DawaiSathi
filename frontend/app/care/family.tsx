import PressableScale from "@/src/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/src/components/focus-input";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/src/components/dawai-ui";
import { SwipeDeleteRow } from "@/src/components/swipe-delete-row";
import { DeleteConfirmation } from "@/src/components/delete-confirmation";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { useAuth } from "@/src/auth-context";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

export default function FamilyScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const params = useLocalSearchParams<{ id?: string }>();
  const {
    activeFamilyGroup,
    members,
    addMember,
    updateMember,
    removeMember,
    setActiveMember,
    renameFamilyGroup,
  } = useData();

  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(params.id ?? null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addMember(newName.trim());
      setNewName("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t add");
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async () => {
    if (!renameId || !renameValue.trim()) return;
    setBusy(true);
    try {
      if (renameId === "family-group") {
        if (activeFamilyGroup) await renameFamilyGroup(activeFamilyGroup.id, renameValue.trim());
      } else {
        await updateMember(renameId, { name: renameValue.trim() });
      }
      setRenameId(null);
      setRenameValue("");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeMember(id);
      setPendingRemove(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t remove this member.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "My Family" }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>FAMILY MEMBERS</Text>
        <Text style={styles.title}>Who you care for</Text>
        <Text style={styles.subtitle}>Add each person once. Their medicines and history stay separate.</Text>


        <View style={styles.groupCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupEyebrow}>FAMILY GROUP</Text>
            {renameId === "family-group" ? (
              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Family group name"
                placeholderTextColor={colors.muted}
                style={styles.groupRenameInput}
                autoFocus
                testID="family-group-rename-input"
              />
            ) : (
              <Text style={styles.groupName}>{activeFamilyGroup?.name ?? "My Family"}</Text>
            )}
          </View>
          {renameId === "family-group" ? (
            <View style={styles.rowActions}>
              <PressableScale scaleTo={0.88} hitSlop={14}
                onPress={submitRename}
                disabled={busy}
                style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
                testID="family-group-save"
              >
                <Ionicons name="checkmark" size={16} color={colors.brandPrimary} />
              </PressableScale>
              <PressableScale scaleTo={0.88} hitSlop={14}
                onPress={() => { setRenameId(null); setRenameValue(""); }}
                style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
                testID="family-group-cancel"
              >
                <Ionicons name="close" size={16} color={colors.onSurfaceSecondary} />
              </PressableScale>
            </View>
          ) : (
            <PressableScale scaleTo={0.88} hitSlop={14}
              onPress={() => {
                if (!activeFamilyGroup) return;
                setRenameId("family-group");
                setRenameValue(activeFamilyGroup.name);
              }}
              style={({ pressed }) => [styles.mini, pressed && styles.pressed]}
              testID="family-group-rename"
            >
              <Ionicons name="pencil" size={16} color={colors.onSurfaceSecondary} />
            </PressableScale>
          )}
        </View>


        <View style={styles.list}>
          {members.map((member) => {
            const editing = renameId === member.id;
            return (
              <SwipeDeleteRow testID={`care-member-swipe-${member.id}`} key={member.id} open={openRow === member.id} disabled={busy || editing || member.is_primary || activeFamilyGroup?.owner_user_id !== user?.id} label="Remove" onOpen={() => setOpenRow(member.id)} onClose={() => setOpenRow(current => current === member.id ? null : current)} onRequestDelete={() => { setOpenRow(null); setError(null); setPendingRemove(member.id); }}>
              <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: member.color }]}>
                  <Text style={styles.avatarLetter}>{member.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {editing ? (
                    <TextInput
                      value={renameValue}
                      onChangeText={setRenameValue}
                      style={styles.renameInput}
                      autoFocus
                      testID={`family-rename-${member.id}`}
                    />
                  ) : (
                    <Text style={styles.name}>{member.name}</Text>
                  )}
                  <Text style={styles.role}>{member.is_primary ? "Primary member" : member.role === "care_taker" ? "Caretaker" : "Member"}</Text>
                </View>
                {editing ? (
                  <View style={styles.rowActions}>
                    <PressableScale scaleTo={0.88} hitSlop={14} onPress={submitRename} style={({ pressed }) => [styles.mini, pressed && styles.pressed]} testID={`family-save-${member.id}`}>
                      <Ionicons name="checkmark" size={16} color={colors.brandPrimary} />
                    </PressableScale>
                    <PressableScale scaleTo={0.88} hitSlop={14} onPress={() => { setRenameId(null); setRenameValue(""); }} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                      <Ionicons name="close" size={16} color={colors.onSurfaceSecondary} />
                    </PressableScale>
                  </View>
                ) : (
                  <View style={styles.rowActions}>
                    <PressableScale scaleTo={0.88} hitSlop={14} onPress={() => setActiveMember(member.id)} style={({ pressed }) => [styles.mini, pressed && styles.pressed]} testID={`family-activate-${member.id}`}>
                      <Ionicons name="person-circle-outline" size={16} color={colors.brandPrimary} />
                    </PressableScale>
                    <PressableScale scaleTo={0.88} hitSlop={14} onPress={() => { setRenameId(member.id); setRenameValue(member.name); }} style={({ pressed }) => [styles.mini, pressed && styles.pressed]} testID={`family-edit-${member.id}`}>
                      <Ionicons name="pencil" size={16} color={colors.onSurfaceSecondary} />
                    </PressableScale>
                    {!member.is_primary && activeFamilyGroup?.owner_user_id === user?.id ? (
                      <PressableScale scaleTo={0.88} hitSlop={14} disabled={busy} onPress={() => { setError(null); setPendingRemove(member.id); }} style={({ pressed }) => [styles.mini, pressed && styles.pressed]} testID={`family-remove-${member.id}`}>
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </PressableScale>
                    ) : null}
                  </View>
                )}
              </View>
              </SwipeDeleteRow>
            );
          })}
        </View>

        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Add a family member</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Full name"
            placeholderTextColor={colors.muted}
            style={styles.input}
            testID="family-add-input"
          />
          <PrimaryButton label="Add member" icon="person-add" onPress={submitAdd} disabled={busy} testID="family-add-submit" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
      <BottomSheet visible={pendingRemove !== null} title="Remove family member?" onClose={() => { if (!busy) setPendingRemove(null); }}>
        <DeleteConfirmation message="Remove this care profile and its health records from this family? Login accounts and other families stay unchanged." label="Remove member" busy={busy} error={error} onCancel={() => setPendingRemove(null)} onConfirm={() => { if (pendingRemove) void remove(pendingRemove); }} />
      </BottomSheet>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    content: { padding: 20, gap: 16 },
    eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
    title: { color: colors.onSurface, fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 4 },
    list: { gap: 8 },
    groupCard: {
      minHeight: 72,
      borderRadius: 18,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.brandTertiary,
    },
    groupEyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
    groupName: { color: colors.onSurface, fontSize: 17, fontWeight: "800", marginTop: 3 },
    groupRenameInput: {
      minHeight: 40,
      color: colors.onSurface,
      fontSize: 16,
      fontWeight: "800",
      borderBottomWidth: 1,
      borderBottomColor: colors.brandSecondary,
      paddingVertical: 2,
      marginTop: 1,
    },
    row: {
      minHeight: 78,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    avatarLetter: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
    name: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    role: { color: colors.muted, fontSize: 12, marginTop: 2 },
    rowActions: { flexDirection: "row", gap: 4 },
    mini: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceTertiary,
    },
    renameInput: {
      color: colors.onSurface,
      fontSize: 15,
      fontWeight: "800",
      borderBottomWidth: 1,
      borderBottomColor: colors.brandSecondary,
      paddingVertical: 3,
    },
    addCard: {
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      padding: 18,
      gap: 12,
      marginTop: 6,
    },
    addTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
    input: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.surfaceTertiary,
      paddingHorizontal: 14,
      color: colors.onSurface,
      fontSize: 15,
    },
    error: { color: colors.error, fontSize: 12 },
    pressed: { opacity: 0.8 },
  }),
);
