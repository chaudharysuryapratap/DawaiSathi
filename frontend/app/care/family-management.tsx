import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "@/src/auth-context";
import { api } from "@/src/api";
import { useData } from "@/src/data-context";
import { TextInput } from "@/src/components/focus-input";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { PrimaryButton } from "@/src/components/dawai-ui";
import { FamilyQrScanner } from "@/src/components/family-qr-scanner";
import { FamilyGroupSelector } from "@/src/components/family-group-selector";
import { FamilyInviteSheet } from "@/src/components/family-invite-sheet";
import { DeleteConfirmation } from "@/src/components/delete-confirmation";
import {
  DeletedMember,
  familyManagement as fm,
  Invite,
  JoinPreview,
  Profile,
} from "@/src/family-management";
import { useTheme } from "@/src/theme";

type Page =
  | "home"
  | "switch"
  | "create"
  | "created"
  | "join"
  | "code"
  | "scan"
  | "join-confirm"
  | "members"
  | "member-form"
  | "invites"
  | "invite"
  | "deleted";
export default function FamilyManagementScreen() {
  const { colors } = useTheme(),
    { user } = useAuth(),
    data = useData(),
    router = useRouter();
  const params = useLocalSearchParams<{ inviteCode?: string }>();
  const { width, fontScale } = useWindowDimensions();
  const roomyText = fontScale > 1.2 || width < 350;
  const group = data.activeFamilyGroup,
    groupId = group?.id ?? "",
    owner = group?.owner_user_id === user?.id;
  const [page, setPage] = useState<Page>(params.inviteCode ? "code" : "home");
  const [ownerName, setOwnerName] = useState("Family owner"),
    [name, setName] = useState(""),
    [code, setCode] = useState(params.inviteCode ?? "");
  const [showInvite, setShowInvite] = useState(false);
  const [preview, setPreview] = useState<JoinPreview | null>(null),
    [invites, setInvites] = useState<Invite[]>([]);
  const [profile, setProfile] = useState<Profile>({
      name: "",
      relationship: "",
      role: "member",
      email: null,
    }),
    [memberId, setMemberId] = useState<string | undefined>();
  const [deletedGroups, setDeletedGroups] = useState<
      Awaited<ReturnType<typeof api.deletedFamilyGroups>>
    >([]),
    [deletedMembers, setDeletedMembers] = useState<DeletedMember[]>([]);
  const [confirm, setConfirm] = useState<
      "delete" | "leave" | "rename" | "remove" | null
    >(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    let current = true;
    api
      .deletedFamilyGroups()
      .then((groups) => {
        if (current) setDeletedGroups(groups);
      })
      .catch(() => {});
    if (groupId)
      fm.summary(groupId)
        .then((value) => {
          if (current) setOwnerName(value.owner_name);
        })
        .catch(() => {});
    if (groupId && owner)
      fm.invites(groupId)
        .then((value) => {
          if (current) setInvites(value);
        })
        .catch(() => {});
    return () => {
      current = false;
    };
  }, [groupId, owner]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const open = (next: Page) => {
    setError("");
    setMessage("");
    setPage(next);
  };
  const title = (text: string) => (
    <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "800" }}>
      {text}
    </Text>
  );
  const copy = (text: string) => (
    <Text
      style={{
        color: colors.muted,
        fontSize: page === "home" ? 12 : 14,
        lineHeight: page === "home" ? 18 : 21,
      }}
    >
      {text}
    </Text>
  );
  const card = {
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.surfaceTertiary,
    gap: 10,
  } as const;
  const memberCount = `${data.members.length} ${data.members.length === 1 ? "member" : "members"}`;
  const pendingCount = invites.filter(
    (value) => value.status === "Pending",
  ).length;
  const outlinedCard = {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 12,
  } as const;
  const sectionHeader = (label: string, detail: string) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 16,
        marginBottom: 3,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => open("home")}
        style={{ minWidth: 32, minHeight: 44, justifyContent: "center" }}
      >
        <Ionicons name="chevron-back" size={30} color={colors.onSurface} />
      </Pressable>
      <View style={{ flex: 1, gap: 7 }}>
        <Text
          style={{ color: colors.onSurface, fontSize: 25, fontWeight: "800" }}
        >
          {label}
        </Text>
        {copy(detail)}
      </View>
    </View>
  );
  const recordHeading = (
    label: string,
    detail: string,
    icon: keyof typeof Ionicons.glyphMap,
    tint: string,
    ink: string,
    status?: string,
  ) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={25} color={ink} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text
          style={{ color: colors.onSurface, fontSize: 16, fontWeight: "800" }}
        >
          {label}
        </Text>
        {copy(detail)}
      </View>
      {status && (
        <View style={{ backgroundColor: tint, padding: 6, borderRadius: 8 }}>
          <Text style={{ color: ink, fontSize: 12, fontWeight: "700" }}>
            {status}
          </Text>
        </View>
      )}
    </View>
  );
  const panelButton = (
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress: () => void,
    danger = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
        borderRadius: 13,
        paddingHorizontal: 4,
        paddingVertical: 10,
        backgroundColor: danger ? "#ffeaeb" : colors.brandTertiary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      }}
    >
      <Ionicons
        name={icon}
        size={16}
        color={danger ? colors.error : colors.brandPrimary}
      />
      <Text
        numberOfLines={roomyText ? undefined : 1}
        adjustsFontSizeToFit={!roomyText}
        minimumFontScale={0.85}
        style={{
          color: danger ? colors.error : colors.brandPrimary,
          fontSize: roomyText ? 14 : 10,
          fontWeight: "700",
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const managementRow = (
    label: string,
    detail: string,
    icon: keyof typeof Ionicons.glyphMap,
    tint: string,
    ink: string,
    onPress: () => void,
    count?: string,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: colors.divider,
        borderRadius: 16,
        padding: 10,
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={25} color={ink} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text
          style={{ color: colors.onSurface, fontSize: 16, fontWeight: "800" }}
        >
          {label}
        </Text>
        {copy(detail)}
      </View>
      {count && !roomyText && (
        <Text style={{ fontSize: 12, color: colors.muted }}>{count}</Text>
      )}
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
  const action = (
    label: string,
    detail: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress: () => void,
    tint = colors.brandTertiary,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={busy}
      style={[card, { flexDirection: "row", alignItems: "center", gap: 14 }]}
    >
      <View style={{ padding: 12, backgroundColor: tint, borderRadius: 14 }}>
        <Ionicons name={icon} size={24} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text
          style={{ color: colors.onSurface, fontWeight: "800", fontSize: 16 }}
        >
          {label}
        </Text>
        {!!detail && copy(detail)}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
  const button = (
    label: string,
    onPress: () => void,
    variant: "primary" | "secondary" | "danger" = "primary",
  ) => (
    <PrimaryButton
      label={label}
      onPress={onPress}
      variant={variant}
      disabled={busy}
    />
  );
  const field = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    isEmail = false,
  ) => (
    <View style={{ gap: 8 }}>
      <Text
        style={{ color: colors.onSurface, fontSize: 14, fontWeight: "700" }}
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={isEmail ? "none" : "sentences"}
        keyboardType={isEmail ? "email-address" : "default"}
        style={{
          borderWidth: 1,
          borderColor: colors.divider,
          borderRadius: 14,
          padding: 14,
          minHeight: 50,
          color: colors.onSurface,
          fontSize: 16,
        }}
      />
    </View>
  );
  const prepareInvite = () => setShowInvite(true);
  const validate = (value = code) =>
    void run(async () => {
      setCode(value.trim());
      setPreview(await fm.preview(value.trim()));
      open("join-confirm");
    });
  const deleted = () =>
    void run(async () => {
      const [groups, members] = await Promise.all([
        api.deletedFamilyGroups(),
        groupId && owner ? fm.deletedMembers(groupId) : Promise.resolve([]),
      ]);
      setDeletedGroups(groups);
      setDeletedMembers(members);
      open("deleted");
    });
  const back = () =>
    open(
      page === "member-form"
        ? "members"
        : ["code", "scan", "join-confirm"].includes(page)
          ? "join"
          : "home",
    );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Stack.Screen
        options={{
          title: "Family management",
          headerShown: !["home", "members", "invites", "deleted"].includes(
            page,
          ),
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Go back"
              style={{ padding: 10 }}
              onPress={() => (page === "home" ? router.back() : back())}
            >
              <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingTop: page === "members" ? 32 : 16,
          paddingBottom: 36,
          gap: page === "home" ? 12 : 16,
        }}
      >
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: colors.error }}>
            {error}
            {page === "code" || page === "join-confirm"
              ? " Ask the family owner for a new code."
              : ""}
          </Text>
        )}
        {!!message && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.brandPrimary }}
          >
            {message}
          </Text>
        )}
        {page === "home" && (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: 3,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => router.back()}
                style={{
                  minWidth: 32,
                  minHeight: 44,
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="chevron-back"
                  size={30}
                  color={colors.onSurface}
                />
              </Pressable>
              <View style={{ flex: 1, gap: 7 }}>
                <Text
                  style={{
                    color: colors.onSurface,
                    fontSize: 25,
                    fontWeight: "800",
                  }}
                >
                  Family Management
                </Text>
                {copy("Manage your families, members and invitations.")}
              </View>
            </View>
            {group ? (
              <LinearGradient
                colors={["#ecfaf6", "#effaf7"]}
                style={{ padding: 14, borderRadius: 20, gap: 12 }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.muted,
                  }}
                >
                  Current family
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: colors.brandTertiary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="people"
                      size={43}
                      color={colors.brandPrimary}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    {title(group.name)}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      <Ionicons
                        name="people-outline"
                        size={17}
                        color={colors.muted}
                      />
                      {copy(memberCount)}
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="crown-outline"
                        size={17}
                        color={colors.muted}
                      />
                      <Text
                        style={{ flex: 1, color: colors.muted, fontSize: 14 }}
                      >
                        Owner: {ownerName}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View family members"
                    onPress={() => open("members")}
                    style={{ padding: 6 }}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={22}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>
                <View
                  style={{
                    flexDirection: roomyText ? "column" : "row",
                    gap: 7,
                  }}
                >
                  {panelButton("Switch family", "swap-horizontal", () =>
                    open("switch"),
                  )}
                  {owner &&
                    panelButton("Rename family", "pencil-outline", () => {
                      setName(group.name);
                      setConfirm("rename");
                    })}
                  {owner &&
                    panelButton(
                      "Delete family",
                      "trash-outline",
                      () => setConfirm("delete"),
                      true,
                    )}
                </View>
              </LinearGradient>
            ) : (
              copy("Choose or create a family to get started.")
            )}
            <View style={{ marginTop: 7 }}>{title("Family access")}</View>
            <FamilyGroupSelector accessOnly />
            {group && (
              <>
                {managementRow(
                  "Family members",
                  "View and manage family members",
                  "people",
                  "#e4f8f3",
                  colors.brandPrimary,
                  () => open("members"),
                  memberCount,
                )}
                {owner &&
                  managementRow(
                    "Invitations",
                    "Pending, accepted and expired invitations",
                    "mail-outline",
                    "#f3eaff",
                    "#9229ee",
                    () =>
                      void run(async () => {
                        setInvites(await fm.invites(groupId));
                        open("invites");
                      }),
                    pendingCount ? `${pendingCount} pending` : undefined,
                  )}
              </>
            )}
            {(owner || deletedGroups.length > 0) &&
              managementRow(
                "Recently deleted",
                "Restore deleted members or families",
                "trash-outline",
                "#fff2e6",
                "#ba620b",
                deleted,
              )}
            {group &&
              managementRow(
                "Leave family",
                owner
                  ? "Owners must transfer ownership before leaving."
                  : "Leave this family and remove your access",
                "exit-outline",
                "#ffe9eb",
                colors.error,
                () =>
                  owner
                    ? setError(
                        "You are the owner. Ownership transfer is not available yet; you cannot leave this family.",
                      )
                    : setConfirm("leave"),
              )}
          </>
        )}
        {page === "switch" && (
          <>
            {title("Switch family")}
            {copy("Choose the family you want to access.")}
            {data.familyGroups.map((family) => (
              <Pressable
                key={family.id}
                accessibilityRole="button"
                accessibilityState={{ selected: groupId === family.id }}
                onPress={() => {
                  data.setActiveFamilyGroup(family.id);
                  open("home");
                }}
                style={[
                  card,
                  {
                    borderWidth: 1,
                    borderColor:
                      groupId === family.id
                        ? colors.brandPrimary
                        : "transparent",
                  },
                ]}
              >
                {title(family.name)}
                {copy(`${family.member_count} members`)}
              </Pressable>
            ))}
          </>
        )}
        {page === "create" && (
          <>
            {title("Create a new family")}
            {copy(
              "Use a separate family space for another household or group.",
            )}
            {field("Family name", name, setName)}
            <View style={card}>
              {title("You will be the owner")}
              {copy("As the creator, you will be the owner of this family.")}
            </View>
            {button(
              "Create family",
              () =>
                void run(async () => {
                  if (!name.trim()) throw new Error("Enter a family name.");
                  await data.createFamilyGroup(name.trim());
                  open("created");
                }),
            )}
          </>
        )}
        {page === "created" && (
          <>
            <View
              style={{ alignItems: "center", gap: 16, paddingVertical: 30 }}
            >
              <Ionicons
                name="people-circle"
                size={100}
                color={colors.brandPrimary}
              />
              {title("Family created")}
              {copy(`You are now the owner of ${name}.`)}
            </View>
            {title("Next step")}
            {copy("Invite your family members to get started.")}
            {button("Invite family members", () => prepareInvite())}
            {button("Maybe later", () => open("home"), "secondary")}
          </>
        )}
        {page === "join" && (
          <>
            {title("Join a family")}
            {copy("Join an existing family using a QR code or invite code.")}
            {action(
              "Scan QR code",
              "Scan a code shared by the family owner.",
              "qr-code-outline",
              () => open("scan"),
            )}
            {action(
              "Enter invite code",
              "Type the code shared by the family owner.",
              "key-outline",
              () => open("code"),
              "#e1f2ff",
            )}
          </>
        )}
        {page === "scan" && (
          <>
            {title("Scan family QR code")}
            {copy("Ask the family owner to show their invitation QR code.")}
            <FamilyQrScanner
              onScan={(value) => validate(value)}
              onCancel={() => open("join")}
            />
            {error && button("Try again", () => open("code"), "secondary")}
          </>
        )}
        {page === "code" && (
          <>
            {title("Enter family invite code")}
            {copy("Type the code shared by the family owner.")}
            {field("Invite code", code, setCode)}
            {button("Continue", () => validate())}
          </>
        )}
        {page === "join-confirm" && preview && (
          <>
            {title(`Join ${preview.name}?`)}
            <View style={card}>
              {copy(`Owner: ${preview.owner_name}`)}
              {copy(`Members: ${preview.member_count}`)}
              {copy(
                `Invitation expires: ${new Date(preview.expires_at).toLocaleString()}`,
              )}
            </View>
            <View style={[card, { backgroundColor: "#eaf5ff" }]}>
              {copy(
                "After joining, the family may share medicines, checkups, prescriptions, and care history with you according to your role.",
              )}
            </View>
            {button(
              "Join family",
              () =>
                void run(async () => {
                  const joined = await fm.accept(code);
                  await data.refresh();
                  data.setActiveFamilyGroup(joined.family_group_id);
                  open("home");
                  setMessage("Family joined");
                }),
            )}
            {button("Cancel", () => open("join"), "secondary")}
          </>
        )}
        {page === "members" && (
          <>
            {sectionHeader("Family members", "View and manage family members")}
            <View style={{ marginTop: 6, marginBottom: 6 }}>
              {copy(memberCount)}
            </View>
            {data.members.map((member) => (
              <View key={member.id}>
                {managementRow(
                  member.name,
                  `${member.relationship || (member.role === "care_taker" ? "Caretaker" : "Member")}${member.email ? ` · ${member.email}` : ""}`,
                  "people",
                  "#e4f8f3",
                  colors.brandPrimary,
                  () => {
                    setMemberId(member.id);
                    setProfile({
                      name: member.name,
                      role: ["member", "care_taker"].includes(member.role)
                        ? member.role
                        : "member",
                      relationship: member.relationship ?? "",
                      email: member.email ?? null,
                    });
                    open("member-form");
                  },
                )}
              </View>
            ))}
            <View style={{ marginTop: 10, gap: 12 }}>
              {owner && button("Invite family member", () => prepareInvite())}
              {owner &&
                button(
                  "Add family member",
                  () => {
                    setMemberId(undefined);
                    setProfile({
                      name: "",
                      role: "member",
                      relationship: "",
                      email: null,
                    });
                    open("member-form");
                  },
                  "secondary",
                )}
            </View>
          </>
        )}
        {page === "member-form" && (
          <>
            {title(memberId ? "Edit family member" : "Add family member")}
            {field("Full name", profile.name, (value) =>
              setProfile({ ...profile, name: value }),
            )}
            {field("Relationship (optional)", profile.relationship, (value) =>
              setProfile({ ...profile, relationship: value }),
            )}
            {title("Role")}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(["member", "care_taker"] as const).map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setProfile({ ...profile, role })}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor:
                      profile.role === role
                        ? colors.brandPrimary
                        : colors.divider,
                  }}
                >
                  <Text style={{ color: colors.onSurface }}>
                    {role === "care_taker" ? "Caretaker" : "Member"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {copy(
              "These roles describe the person's care relationship. Only owners can manage family membership and invitations.",
            )}
            {field(
              "Email address (optional)",
              profile.email ?? "",
              (value) => setProfile({ ...profile, email: value || null }),
              true,
            )}
            {owner ? (
              <>
                {button(
                  memberId ? "Save changes" : "Add member",
                  () =>
                    void run(async () => {
                      await fm.saveMember(groupId, profile, memberId);
                      await data.refresh();
                      open("members");
                      setMessage(memberId ? "Member updated" : "Member added");
                    }),
                )}
                {memberId && (
                  <>
                    {button(
                      "Invite to join app",
                      () => prepareInvite(),
                      "secondary",
                    )}
                    {!data.members.find((m) => m.id === memberId)?.is_primary &&
                      button(
                        "Remove member",
                        () => setConfirm("remove"),
                        "danger",
                      )}
                  </>
                )}
              </>
            ) : (
              copy("Only the family owner can edit members.")
            )}
          </>
        )}
        {page === "invites" && (
          <>
            {sectionHeader(
              "Invitations",
              "Pending, accepted and expired invitations",
            )}
            {button("Invite family member", () => prepareInvite())}
            {!invites.length && (
              <View style={outlinedCard}>
                {recordHeading(
                  "No invitations yet",
                  "Invite someone you trust to join this family.",
                  "mail-outline",
                  "#f3eaff",
                  "#9229ee",
                )}
              </View>
            )}
            {invites.map((item) => (
              <View key={item.id} style={outlinedCard}>
                {recordHeading(
                  item.email ?? "Shared invitation",
                  `Expires ${new Date(item.expires_at).toLocaleDateString()}`,
                  "mail-outline",
                  "#f3eaff",
                  "#9229ee",
                  item.status,
                )}
                {item.status !== "Accepted" && (
                  <>
                    {button(
                      item.status === "Pending"
                        ? "Replace and resend"
                        : "Create new invitation",
                      () =>
                        void run(async () => {
                          if (item.status === "Pending")
                            await fm.cancel(groupId, item.id);
                          setShowInvite(true);
                        }),
                      "secondary",
                    )}
                    {item.status === "Pending" &&
                      button(
                        "Cancel invite",
                        () =>
                          void run(async () => {
                            await fm.cancel(groupId, item.id);
                            setInvites(await fm.invites(groupId));
                          }),
                        "danger",
                      )}
                  </>
                )}
              </View>
            ))}
          </>
        )}
        {page === "deleted" && (
          <>
            {sectionHeader(
              "Recently deleted",
              "Restore deleted members or families",
            )}
            {copy(
              "Restore families and member profiles within 30 days. Restoring a profile does not restore account access; send a new invitation.",
            )}
            {title("Families")}
            {!deletedGroups.length && (
              <View style={outlinedCard}>
                {recordHeading(
                  "No deleted families",
                  "Families available for recovery will appear here.",
                  "trash-outline",
                  "#fff2e6",
                  "#ba620b",
                )}
              </View>
            )}
            {deletedGroups.map((item) => (
              <View key={item.id} style={outlinedCard}>
                {recordHeading(
                  item.name,
                  `Recover by ${new Date(item.recover_until).toLocaleDateString()}`,
                  "people",
                  "#fff2e6",
                  "#ba620b",
                )}
                {button(
                  "Restore family",
                  () =>
                    void run(async () => {
                      await data.restoreFamilyGroup(item.id);
                      setDeletedGroups((list) =>
                        list.filter((g) => g.id !== item.id),
                      );
                      setMessage("Family restored");
                    }),
                  "secondary",
                )}
              </View>
            ))}
            {title("Member profiles")}
            {!deletedMembers.length && (
              <View style={outlinedCard}>
                {recordHeading(
                  "No deleted members",
                  "Members available for recovery will appear here.",
                  "person-outline",
                  "#fff2e6",
                  "#ba620b",
                )}
              </View>
            )}
            {deletedMembers.map((item) => (
              <View key={item.member_id} style={outlinedCard}>
                {recordHeading(
                  item.profile.name,
                  `Recover by ${new Date(item.recover_until).toLocaleDateString()}`,
                  "person-outline",
                  "#fff2e6",
                  "#ba620b",
                )}
                {button(
                  "Restore member",
                  () =>
                    void run(async () => {
                      await fm.restoreMember(groupId, item.member_id);
                      await data.refresh();
                      setDeletedMembers((list) =>
                        list.filter((m) => m.member_id !== item.member_id),
                      );
                    }),
                  "secondary",
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <FamilyInviteSheet
        group={showInvite ? (group ?? null) : null}
        onClose={() => {
          setShowInvite(false);
          if (owner && groupId) void fm.invites(groupId).then(setInvites);
        }}
      />
      <BottomSheet
        appearance="family"
        visible={confirm !== null}
        onClose={() => {
          if (!busy) setConfirm(null);
        }}
        onDismissAll={() => {
          if (!busy) setConfirm(null);
        }}
        title={
          confirm === "rename"
            ? "Rename family"
            : confirm === "delete"
              ? "Delete family?"
              : confirm === "remove"
                ? `Remove ${profile.name}?`
                : "Leave this family?"
        }
      >
        {confirm === "rename" ? (
          <>
            {field("Family name", name, setName)}
            {button(
              "Save changes",
              () =>
                void run(async () => {
                  await data.renameFamilyGroup(groupId, name.trim());
                  setConfirm(null);
                }),
            )}
            {button("Cancel", () => setConfirm(null), "secondary")}
          </>
        ) : (
          <DeleteConfirmation
            message={
              confirm === "delete"
                ? `Delete “${group?.name}”? Everyone will lose access to this family's profiles and health records. Login accounts and other families stay unchanged. You can restore this family and its members from Deleted families within 30 days.`
                : confirm === "remove"
                  ? `Remove ${profile.name} from this family? Their care records will stay here as shared records. Profiles in other families and login accounts will stay unchanged.`
                  : `Leave “${group?.name}”? You will lose access to its health records. The family and its other members will stay unchanged.`
            }
            label={
              confirm === "delete"
                ? "Delete family"
                : confirm === "remove"
                  ? "Remove profile"
                  : "Leave family"
            }
            busy={busy}
            error={error || null}
            onCancel={() => {
              setConfirm(null);
              setError("");
            }}
            onConfirm={() =>
              void run(async () => {
                if (confirm === "delete") {
                  await data.deleteFamilyGroup(groupId);
                  setDeletedGroups(await api.deletedFamilyGroups());
                } else if (confirm === "remove") {
                  await data.removeMember(memberId!);
                  open("members");
                } else await data.leaveFamilyGroup(groupId);
                setConfirm(null);
              })
            }
          />
        )}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}
