import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { PrimaryButton } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

export function FamilyGroupSelector() {
  const { colors } = useTheme();
  const styles = useStyles();
  const {
    familyGroups,
    activeFamilyGroup,
    activeFamilyGroupId,
    setActiveFamilyGroup,
    createFamilyGroup,
    renameFamilyGroup,
    members,
    activeMember,
    setActiveMember,
  } = useData();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const label = activeFamilyGroup?.name ?? "Create family group";

  return (
    <>
      <Pressable
        testID="family-group-selector"
        accessibilityLabel={`Active family group ${label}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
      >
        <View style={styles.dot} />
        <Text style={styles.selectorLabel} numberOfLines={1}>{label}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.onSurfaceSecondary} />
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
              <View key={group.id} style={styles.row}>
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
                ) : (
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
                )}
              </View>
            );
          })}
        </ScrollView>


        <Text style={styles.sectionLabel}>PEOPLE IN THIS GROUP</Text>
        <View style={styles.memberList}>
          {members.map((member) => {
            const selected = member.id === activeMember?.id;
            return (
              <Pressable
                key={member.id}
                testID={`family-member-${member.id}`}
                onPress={() => {
                  setActiveMember(member.id);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}
              >
                <View style={[styles.avatar, { backgroundColor: member.color }]}>
                  <Text style={styles.avatarLetter}>{member.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{member.name}</Text>
                  <Text style={styles.detail}>{member.is_primary ? "Primary member" : member.role || "Member"}</Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={21} color={colors.brandPrimary} /> : null}
              </Pressable>
            );
          })}
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
      minHeight: 46,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.brandTertiary,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brandPrimary },
    selectorLabel: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700", maxWidth: 220 },
    list: { gap: 8 },
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
    sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 2 },
    memberList: { gap: 8 },
    memberRow: {
      minHeight: 58,
      borderRadius: 16,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surfaceSecondary,
    },
    avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    avatarLetter: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
    createCard: {
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
      padding: 14,
      gap: 10,
      marginTop: 4,
    },
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
