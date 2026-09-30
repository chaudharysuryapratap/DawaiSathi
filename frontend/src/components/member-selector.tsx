import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { PrimaryButton } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { makeStyles, useTheme } from "@/src/theme";

export function MemberSelector() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { members, activeMember, setActiveMember, addMember, updateMember, removeMember } = useData();
  const [showPicker, setShowPicker] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const label = activeMember?.name ?? "Select member";
  const dotColor = activeMember?.color ?? colors.brandPrimary;

  const submitNew = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const member = await addMember(newName.trim());
      setNewName("");
      setActiveMember(member.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t add member");
    } finally {
      setBusy(false);
    }
  };

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
    setBusy(true);
    setError(null);
    try {
      await removeMember(id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t remove member");
    } finally {
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
          setShowPicker(false);
          setRenameId(null);
          setError(null);
        }}
        title="Who is this for?"
        description="Switch between people you care for."
        testID="member-picker-sheet"
      >
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {members.map((member) => {
            const active = member.id === activeMember?.id;
            const editing = renameId === member.id;
            return (
              <View key={member.id} style={styles.row}>
                <Pressable
                  testID={`member-${member.id}`}
                  onPress={() => {
                    setActiveMember(member.id);
                    setShowPicker(false);
                  }}
                  style={({ pressed }) => [styles.rowInner, pressed && styles.pressed]}
                >
                  <View style={[styles.avatar, { backgroundColor: member.color }]}>
                    <Text style={styles.avatarLetter}>{member.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
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
                  {active ? <Ionicons name="checkmark" size={20} color={colors.brandPrimary} /> : null}
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
                  ) : (
                    <>
                      <Pressable onPress={() => { setRenameId(member.id); setRenameValue(member.name); }} testID={`member-edit-${member.id}`} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                        <Ionicons name="pencil" size={15} color={colors.onSurfaceSecondary} />
                      </Pressable>
                      {!member.is_primary ? (
                        <Pressable disabled={busy} onPress={() => remove(member.id)} testID={`member-remove-${member.id}`} style={({ pressed }) => [styles.mini, pressed && styles.pressed]}>
                          <Ionicons name="trash-outline" size={15} color={colors.error} />
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.addRow}>
          <TextInput
            testID="member-add-input"
            value={newName}
            onChangeText={setNewName}
            placeholder="Add family member"
            placeholderTextColor={colors.muted}
            style={styles.addInput}
          />
          <PrimaryButton label="Add" icon="add" onPress={submitNew} testID="member-add-submit" />
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
    list: { gap: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowInner: {
      flex: 1,
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 14,
      paddingHorizontal: 12,
    },
    avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    avatarLetter: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
    name: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
    role: { color: colors.muted, fontSize: 12, marginTop: 1 },
    rowActions: { flexDirection: "row", gap: 4 },
    mini: {
      width: 34,
      height: 34,
      borderRadius: 17,
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
    addRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
    addInput: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: colors.surfaceTertiary,
      paddingHorizontal: 14,
      color: colors.onSurface,
      fontSize: 14,
    },
    error: { color: colors.error, fontSize: 12 },
    pressed: { opacity: 0.75 },
  }),
);
