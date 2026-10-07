import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { AuthScreen } from "@/src/components/auth-screen";
import { ErrorState, LoadingState, PrimaryButton } from "@/src/components/dawai-ui";
import { useData } from "@/src/data-context";
import { displayFamilyCode } from "@/src/family-code";
import { useTheme } from "@/src/theme";

export default function JoinFamilyRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { status, error, retry } = useAuth();
  if (status === "loading") return <LoadingState label="Restoring session" />;
  if (status === "error") return <ErrorState title="Could not restore your session" message={error ?? "Try signing in again."} onRetry={retry} />;
  if (status !== "signedIn") return <AuthScreen initialInvitationCode={code ?? ""} />;
  return <SignedInJoin code={code ?? ""} />;
}
function SignedInJoin({ code }: { code: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refresh, setActiveFamilyGroup } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const join = async () => {
    setBusy(true); setError(null);
    try {
      const result = await api.acceptFamilyCode(code);
      await refresh(); setActiveFamilyGroup(result.family_group_id); router.replace("/");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not join this family."); }
    finally { setBusy(false); }
  };
  return <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, backgroundColor: colors.surface, gap: 20 }}>
    <Text style={{ fontSize: 28, fontWeight: "800", color: colors.onSurface }}>Join this family</Text>
    <Text style={{ fontSize: 15, color: colors.muted }}>Only join a family whose members you trust. Joining gives you access to its shared health records.</Text>
    <View style={{ padding: 20, borderRadius: 20, backgroundColor: colors.brandTertiary }}><Text selectable style={{ fontSize: 22, fontWeight: "800", color: colors.onSurface }}>{displayFamilyCode(code)}</Text></View>
    {error && <Text style={{ color: colors.error }}>{error}</Text>}
    <PrimaryButton label={busy ? "Joining…" : "Join family"} onPress={join} disabled={busy || !code} />
    <PrimaryButton label="Cancel" variant="secondary" onPress={() => router.replace("/")} disabled={busy} />
  </ScrollView>;
}
