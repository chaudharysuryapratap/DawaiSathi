import PressableScale from "@/src/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { TextInput } from "@/src/components/focus-input";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { PrimaryButton } from "@/src/components/dawai-ui";
import { CheckupDatePicker } from "@/src/components/checkup-date-picker";
import { PrescriptionCamera } from "@/src/components/prescription-camera";
import { authHeaders, resolveMediaUrl } from "@/src/api";
import { useData } from "@/src/data-context";
import { useTheme } from "@/src/theme";
import {
  Prescription,
  PrescriptionMedicine,
  PrescriptionPage,
  prescriptions,
} from "@/src/prescriptions";

type Screen =
  | "camera"
  | "list" | "details" | "form" | "medicines" | "pages" | "unavailable" | "photo";
function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function Preview({
  page,
  large = false,
}: {
  page: PrescriptionPage;
  large?: boolean;
}) {
  const [uri, setUri] = useState(page.preview_url);
  useEffect(() => {
    if (Platform.OS !== "web" || !page.preview_url?.startsWith("/")) return;
    let active = true,
      objectUrl = "";
    fetch(resolveMediaUrl(page.preview_url), { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUri(objectUrl);
      })
      .catch(() => {
        if (active) setUri(undefined);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [page.preview_url]);
  return (
    <Image
      source={
        uri
          ? {
              uri: uri.startsWith("/") ? resolveMediaUrl(uri) : uri,
              headers: authHeaders(),
            }
          : undefined
      }
      contentFit="contain"
      style={{
        width: large ? "100%" : 64,
        height: large ? 230 : 84,
        backgroundColor: "#eaf2f1",
        borderRadius: 12,
      }}
      accessibilityLabel={`Preview of ${page.name}`}
    />
  );
}

export default function PrescriptionScreen() {
  const { colors } = useTheme();
  const { members, activeFamilyGroupId, activeMemberId } = useData();
  const router = useRouter(),
    params = useLocalSearchParams<{ mode?: string }>();
  const [records, setRecords] = useState<Prescription[]>([]),
    [screen, setScreen] = useState<Screen>("list");
  const [options, setOptions] = useState(false),
    [archived, setArchived] = useState(false);
  const [draft, setDraft] = useState<Prescription | null>(null),
    [photo, setPhoto] = useState<PrescriptionPage | null>(null);
  const [confirm, setConfirm] = useState<
    "archive" | "delete" | PrescriptionMedicine | null
  >(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const entryStarted = useRef(false);
  const fresh = (): Prescription => ({
    family_group_id: activeFamilyGroupId ?? "",
    member_id: activeMemberId ?? members[0]?.id ?? "",
    prescription_date: localDate(new Date()),
    doctor: "",
    notes: "",
    medicines: [],
    pages: [],
    archived: false,
  });
  const load = useCallback(async () => {
    if (!activeFamilyGroupId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRecords(await prescriptions.list(activeFamilyGroupId));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeFamilyGroupId]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  const update = (value: Partial<Prescription>) =>
    setDraft((current) => (current ? { ...current, ...value } : current));
  const perform = async (action: () => Promise<void>) => {
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
  async function pageFrom(
    uri: string,
    name: string,
    contentType: string,
  ): Promise<PrescriptionPage> {
    let encoded: string;
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      if (blob.size > 10 * 1024 * 1024)
        throw new Error("Choose a file smaller than 10 MB.");
      encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("We could not read this file"));
        reader.readAsDataURL(blob);
      });
    } else {
      const file = new File(uri);
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose a file smaller than 10 MB.");
      encoded = await file.base64();
    }
    const page = {
      name,
      content_type: contentType,
      base64: encoded,
      page_count: 1,
    };
    return { ...page, ...(await prescriptions.preview(page)) };
  }
  async function pick(camera: boolean, start = false) {
    setOptions(false);
    const target = start ? fresh() : (draft ?? fresh());
    if (camera) { setDraft(target); setScreen("camera"); return; }
    await perform(async () => {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        const asset = result.assets[0],
          page = await pageFrom(
            asset.uri,
            asset.name,
            asset.mimeType ??
              (asset.name.toLowerCase().endsWith(".pdf")
                ? "application/pdf"
                : "image/jpeg"),
          );
        setDraft({ ...target, pages: [...target.pages, page] });
        setScreen("pages");
    });
  }
  useEffect(() => {
    if (!entryStarted.current && activeFamilyGroupId && params.mode) {
      entryStarted.current = true;
      void pick(params.mode === "scan", true);
    }
    // Route shortcuts run once after the selected family is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFamilyGroupId, params.mode]);
  async function save(next: Screen = "list") {
    if (!draft) return;
    if (!draft.member_id) {
      setError("Choose who this prescription is for.");
      return;
    }
    if (draft.medicines.some((m) => !m.name.trim())) {
      setError("Enter each medicine's name, or remove the empty medicine.");
      return;
    }
    await perform(async () => {
      const saved = await prescriptions.save(draft);
      setDraft(saved);
      setMessage(draft.id ? "Prescription updated" : "Prescription saved");
      await load();
      setScreen(next);
    });
  }
  async function exportPage(page: PrescriptionPage, share: boolean) {
    if (!page.url) return;
    await perform(async () => {
      if (Platform.OS === "web") {
        const response = await fetch(resolveMediaUrl(page.url!), {
          headers: authHeaders(),
        });
        if (!response.ok) throw new Error("Could not download this page.");
        const blob = await response.blob(),
          file = new window.File([blob], page.name, {
            type: page.content_type,
          });
        if (share && navigator.canShare?.({ files: [file] }))
          await navigator.share({ files: [file] });
        else {
          const url = URL.createObjectURL(blob),
            link = document.createElement("a");
          link.href = url;
          link.download = page.name;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } else {
        const destination = new File(
          Paths.cache,
          `${Date.now()}-${page.id}.${page.content_type === "application/pdf" ? "pdf" : "jpg"}`,
        );
        const file = await File.downloadFileAsync(
          resolveMediaUrl(page.url!),
          destination,
          { headers: authHeaders() },
        );
        if (!(await Sharing.isAvailableAsync()))
          throw new Error("File sharing is unavailable on this device.");
        await Sharing.shareAsync(file.uri, {
          mimeType: page.content_type,
          dialogTitle: share
            ? "Share prescription"
            : "Save prescription to files",
        });
      }
    });
  }
  const heading = (text: string) => (
    <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "800" }}>
      {text}
    </Text>
  );
  const copy = (text: string) => (
    <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>
      {text}
    </Text>
  );
  const card = {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  } as const;
  const field = (
    label: string,
    value: string,
    onChangeText: (v: string) => void,
    multiline = false,
  ) => (
    <View style={{ gap: 8 }}>
      <Text
        style={{ color: colors.onSurface, fontWeight: "700", fontSize: 15 }}
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.divider,
          padding: 14,
          color: colors.onSurface,
          fontSize: 16,
          minHeight: multiline ? 90 : 50,
        }}
      />
    </View>
  );
  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "Family member";
  const visible = records.filter((p) => p.archived === archived),
    pageCount = draft?.pages.reduce((sum, p) => sum + p.page_count, 0) ?? 0;
  const title =
    screen === "list"
      ? "Prescriptions"
      : screen === "details"
        ? "Prescription details"
        : screen === "medicines"
          ? "Review medicines"
          : screen === "pages"
            ? "Review photos and files"
            : screen === "photo"
              ? "Review photo"
              : "Review prescription";
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Stack.Screen
        options={{
          title: screen === "camera" ? "Scan prescription" : title,
          headerLeft:
            screen !== "list"
              ? () => (
                  <PressableScale scaleTo={0.88} hitSlop={14}
                    accessibilityLabel="Go back"
                    onPress={() => {
                      setError("");
                      if (draft?.id && screen !== "details") {
                        setDraft(records.find(record => record.id === draft.id) ?? draft);
                        setScreen("details");
                      } else setScreen("list");
                    }}
                    style={{ padding: 12 }}
                  >
                    <Ionicons
                      name="arrow-back"
                      size={24}
                      color={colors.onSurface}
                    />
                  </PressableScale>
                )
              : undefined,
        }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={screen === "camera"
          ? { flexGrow: 1, padding: 8, gap: 16, paddingBottom: 8 }
          : { padding: 20, gap: 16, paddingBottom: 32 }}
      >
      {screen === "camera" && <PrescriptionCamera onPhoto={async uri => { const page = await pageFrom(uri, "Prescription photo.jpg", "image/jpeg"); setPhoto(page); setScreen("photo"); }} onUpload={() => void pick(false)} />}
        {!!error && (
          <View style={card}>
            {heading(
              error.includes("read")
                ? "We could not read this file"
                : "Something needs attention",
            )}
            {copy(error)}
            <PrimaryButton
              label="Try another file"
              variant="secondary"
              onPress={() => void pick(false)}
            />
            <PrimaryButton
              label="Add manually"
              variant="secondary"
              onPress={() => {
                setDraft(draft ?? fresh());
                setScreen("form");
                setError("");
              }}
            />
          </View>
        )}
        {!!message && screen === "list" && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.brandPrimary }}
          >
            {message}
          </Text>
        )}
        {screen === "list" && (
          <>
            {heading("Prescriptions")}
            {copy("View and manage your saved prescriptions.")}
            <PrimaryButton
              label="Add prescription"
              icon="add"
              onPress={() => setOptions(true)}
              disabled={busy}
            />
            {heading(
              archived ? "Archived prescriptions" : "Saved prescriptions",
            )}
            {loading ? (
              copy("Loading prescriptions…")
            ) : !visible.length ? (
              <View
                style={{ alignItems: "center", gap: 14, paddingVertical: 32 }}
              >
                <View
                  style={{
                    backgroundColor: colors.brandTertiary,
                    borderRadius: 60,
                    padding: 28,
                  }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={58}
                    color={colors.brandPrimary}
                  />
                </View>
                {heading(
                  archived
                    ? "No archived prescriptions"
                    : "No prescriptions saved",
                )}
                {copy("Scan or upload a prescription to keep it here.")}
              </View>
            ) : (
              visible.map((record) => (
                <Pressable
                  accessibilityRole="button"
                  key={record.id}
                  onPress={() => {
                    setDraft(record);
                    setScreen("details");
                    setMessage("");
                  }}
                  style={[
                    card,
                    { flexDirection: "row", alignItems: "center", gap: 14 },
                  ]}
                >
                  {record.pages[0] ? (
                    <Preview page={record.pages[0]} />
                  ) : (
                    <Ionicons
                      name="document-text-outline"
                      size={42}
                      color={colors.brandPrimary}
                    />
                  )}
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text
                      style={{
                        color: colors.onSurface,
                        fontSize: 16,
                        fontWeight: "800",
                      }}
                    >
                      Prescription
                      {record.doctor ? ` from ${record.doctor}` : ""}
                    </Text>
                    {copy(
                      new Date(
                        `${record.prescription_date}T12:00:00`,
                      ).toLocaleDateString(),
                    )}
                    {copy(`For ${memberName(record.member_id)}`)}
                    <Text style={{ color: colors.brandPrimary }}>
                      {record.medicines.length} medicines
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={colors.muted}
                  />
                </Pressable>
              ))
            )}
            <PrimaryButton
              variant="secondary"
              label={
                archived ? "Saved prescriptions" : "Archived prescriptions"
              }
              onPress={() => setArchived(!archived)}
            />
          </>
        )}
        {draft && screen === "details" && (
          <>
            {draft.pages.map((page) => (
              <View key={page.id} style={{ gap: 8 }}>
                <Preview page={page} large />
                {copy(`${page.name} · ${page.page_count} pages`)}
              </View>
            ))}
            {heading(
              `Prescription${draft.doctor ? ` from ${draft.doctor}` : ""}`,
            )}
            {copy(
              new Date(
                `${draft.prescription_date}T12:00:00`,
              ).toLocaleDateString(),
            )}
            {copy(
              `For ${memberName(draft.member_id)} · ${pageCount} pages · ${draft.medicines.length} medicines`,
            )}
            <PrimaryButton
              label="Review medicines"
              onPress={() => setScreen("medicines")}
            />
            <PrimaryButton
              label="Edit details"
              variant="secondary"
              onPress={() => setScreen("form")}
            />
            {!!draft.notes && (
              <View style={card}>
                {heading("Notes")}
                {copy(draft.notes)}
              </View>
            )}
            <PrimaryButton
              label="Add another page"
              icon="add"
              variant="secondary"
              onPress={() => void pick(false)}
              disabled={busy}
            />
            {draft.pages.map((page) => (
              <View key={`export-${page.id}`} style={card}>
                {copy(page.name)}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      label="Download"
                      variant="secondary"
                      onPress={() => void exportPage(page, false)}
                      disabled={busy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      label="Share"
                      variant="secondary"
                      onPress={() => void exportPage(page, true)}
                      disabled={busy}
                    />
                  </View>
                </View>
              </View>
            ))}
            <PrimaryButton
              label={draft.archived ? "Restore prescription" : "Archive"}
              variant="secondary"
              onPress={() =>
                draft.archived
                  ? void perform(async () => {
                      await prescriptions.save({ ...draft, archived: false });
                      await load();
                      setScreen("list");
                    })
                  : setConfirm("archive")
              }
              disabled={busy}
            />
            <PrimaryButton
              label="Delete"
              variant="danger"
              onPress={() => setConfirm("delete")}
              disabled={busy}
            />
          </>
        )}
        {draft && screen === "photo" && photo && (
          <>
            <Preview page={photo} large />
            {heading("Place the prescription inside the frame")}
            {copy("Make sure the writing is clear and well lit.")}
            <PrimaryButton
              label="Use this photo"
              onPress={() => {
                update({ pages: [...draft.pages, photo] });
                setPhoto(null);
                setScreen("pages");
              }}
            />
            <PrimaryButton
              label="Take again"
              variant="secondary"
              onPress={() => void pick(true)}
              disabled={busy}
            />
          </>
        )}
        {draft && screen === "pages" && (
          <>
            {draft.pages.map((page, index) => (
              <View key={page.id ?? index} style={card}>
                <Preview page={page} large />
                {copy(`${page.name} · ${page.page_count} pages`)}
                <PrimaryButton
                  label="Remove page or file"
                  variant="secondary"
                  onPress={() =>
                    update({ pages: draft.pages.filter((_, i) => i !== index) })
                  }
                />
              </View>
            ))}
            <PrimaryButton
              label="Add another page"
              variant="secondary"
              onPress={() => void pick(false)}
              disabled={busy}
            />
            <PrimaryButton
              label="Take another photo"
              variant="secondary"
              onPress={() => void pick(true)}
              disabled={busy}
            />
            {copy(`${pageCount} pages selected`)}
            <PrimaryButton
              label={draft.id ? "Save page changes" : "Continue to review"}
              onPress={() =>
                draft.id ? void save("details") : setScreen("unavailable")
              }
              disabled={busy || !draft.pages.length}
            />
          </>
        )}
        {draft && screen === "unavailable" && (
          <>
            {draft.pages[0] && <Preview page={draft.pages[0]} large />}
            {heading("Automatic reading is unavailable")}
            {copy(
              "You can review the prescription and enter the medicine details manually.",
            )}
            <PrimaryButton
              label="Review manually"
              onPress={() => setScreen("form")}
            />
          </>
        )}
        {draft && (screen === "form" || screen === "medicines") && (
          <>
            {screen === "form" && (
              <>
                {draft.pages[0] && <Preview page={draft.pages[0]} large />}
                {heading("Check the prescription details")}
                {copy("Prescription date")}
                <CheckupDatePicker
                  value={new Date(`${draft.prescription_date}T12:00:00`)}
                  onSelect={(value) =>
                    update({ prescription_date: localDate(value) })
                  }
                />
                {field("Doctor or clinic name", draft.doctor, (doctor) =>
                  update({ doctor }),
                )}
              </>
            )}
            {heading(
              screen === "medicines" ? "Review medicines" : "Add medicines",
            )}
            {copy(
              "Check every medicine name, dosage and timing. Saving a prescription does not add medicines to your cabinet.",
            )}
            {draft.medicines.map((medicine, index) => (
              <View key={index} style={card}>
                {(
                  [
                    ["Medicine name", "name"],
                    ["Dosage", "dosage"],
                    ["When to take", "timing"],
                    ["Instructions", "instructions"],
                  ] as const
                ).map(([label, key]) => (
                  <View key={key}>
                    {field(label, medicine[key], (value) =>
                      update({
                        medicines: draft.medicines.map((m, i) =>
                          i === index ? { ...m, [key]: value } : m,
                        ),
                      }),
                    )}
                  </View>
                ))}
                <PrimaryButton
                  label="Remove medicine"
                  variant="secondary"
                  onPress={() =>
                    update({
                      medicines: draft.medicines.filter((_, i) => i !== index),
                    })
                  }
                />
                {screen === "medicines" && (
                  <PrimaryButton
                    label="Add to Medicines"
                    onPress={() => setConfirm(medicine)}
                    disabled={!medicine.name.trim() || busy}
                  />
                )}
              </View>
            ))}
            <PrimaryButton
              label="Add medicine"
              icon="add"
              variant="secondary"
              onPress={() => router.push({ pathname: "/add-medicine", params: { prescriptionMember: draft.member_id } })}
            />
          </>
        )}
      </ScrollView>
      {draft && (screen === "form" || screen === "medicines") && (
        <View
          style={{
            padding: 16,
            gap: 8,
            borderTopWidth: 1,
            borderColor: colors.divider,
          }}
        >
          <PrimaryButton
            label={
              busy
                ? "Saving…"
                : screen === "medicines"
                  ? "Save medicine changes"
                  : draft.id
                    ? "Save changes"
                    : draft.pages.length
                      ? "Save prescription only"
                      : "Save prescription"
            }
            onPress={() => void save(draft.id ? "details" : "list")}
            disabled={busy}
          />
          {screen === "form" && !draft.id && draft.pages.length > 0 && (
            <PrimaryButton
              label="Review and add medicines"
              variant="secondary"
              onPress={() => void save("medicines")}
              disabled={busy}
            />
          )}
        </View>
      )}
      <BottomSheet
        visible={options}
        onClose={() => setOptions(false)}
        title="Add prescription"
      >
        {(
          [
            [
              "Scan with camera",
              "Take a photo of a prescription",
              "camera-outline",
              "#eaf8fb",
            ],
            [
              "Upload photo or PDF",
              "Choose a prescription from the phone",
              "cloud-upload-outline",
              "#f4efff",
            ],
            [
              "Add manually",
              "Enter prescription details yourself",
              "create-outline",
              "#edf8f2",
            ],
          ] as const
        ).map(([label, subtitle, icon, background], index) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            onPress={() =>
              index === 2
                ? (setDraft(fresh()), setOptions(false), setScreen("form"))
                : void pick(index === 0, true)
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 18,
              borderRadius: 20,
              gap: 14,
              backgroundColor: background,
            }}
          >
            <Ionicons name={icon} size={28} color={colors.brandPrimary} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text
                style={{
                  color: colors.onSurface,
                  fontSize: 17,
                  fontWeight: "800",
                }}
              >
                {label}
              </Text>
              {copy(subtitle)}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </BottomSheet>
      <BottomSheet
        visible={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm && typeof confirm === "object"
            ? "Add this medicine to your medicines?"
            : confirm === "archive"
              ? "Archive this prescription?"
              : "Delete this prescription?"
        }
      >
        {copy(
          confirm && typeof confirm === "object"
            ? "Please check the name, dosage, and timing first. Choose an exact schedule on the next screen before saving."
            : confirm === "archive"
              ? "It will be removed from your active prescription list but can be restored later."
              : "This will permanently remove the prescription and its uploaded pages.",
        )}
        <PrimaryButton
          label={
            confirm && typeof confirm === "object"
              ? "Add medicine"
              : confirm === "archive"
                ? "Archive"
                : "Delete prescription"
          }
          variant={confirm === "delete" ? "danger" : "primary"}
          disabled={busy}
          onPress={() => {
            if (!draft || !confirm) return;
            if (typeof confirm === "object") {
              const medicine = confirm;
              setConfirm(null);
              router.push({
                pathname: "/add-medicine",
                params: {
                  prescriptionName: medicine.name,
                  prescriptionDosage: medicine.dosage,
                  prescriptionInstructions: `${medicine.instructions}${medicine.timing ? `\nPrescription timing: ${medicine.timing}` : ""}`,
                  prescriptionMember: draft.member_id,
                },
              });
              return;
            }
            void perform(async () => {
              if (confirm === "delete") await prescriptions.remove(draft.id!);
              else await prescriptions.save({ ...draft, archived: true });
              setConfirm(null);
              await load();
              setScreen("list");
              setMessage(
                confirm === "delete"
                  ? "Prescription deleted"
                  : "Prescription archived",
              );
            });
          }}
        />
        <PrimaryButton
          label={
            confirm && typeof confirm === "object"
              ? "Go back and check"
              : "Cancel"
          }
          variant="secondary"
          onPress={() => setConfirm(null)}
        />
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}
