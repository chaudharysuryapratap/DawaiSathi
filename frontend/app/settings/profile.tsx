import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenShell } from "@/src/components/dawai-ui";
import { SettingsButton, SettingsGroup, SettingsRow, settingsStyles as styles } from "@/src/components/settings-ui";
import { SettingsSuccess } from "@/src/components/settings-success";
import { useAuth } from "@/src/auth-context";
import { api } from "@/src/api";
import * as haptics from "@/src/utils/haptics";
import PressableScale from "@/src/components/ui/PressableScale";
import { RoundBackButton } from "@/src/components/round-back-button";
export default function ProfileScreen() {
    const router = useRouter();
    const { user, updateProfile } = useAuth();
    const [page, setPage] = useState<"profile" | "name" | "login" | "password">("profile");
    const [name, setName] = useState(user?.name ?? "");
    const [email, setEmail] = useState(user?.email ?? "");
    const [current, setCurrent] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const open = (next: typeof page) => { setPage(next); setSaved(false); setError(""); setCurrent(""); setPassword(""); setConfirm(""); setShow(false); };
    const save = async () => {
        if (busy)
            return;
        setError("");
        if (page === "password" && (password.length < 8 || password !== confirm)) {
            setError(password.length < 8 ? "Use at least 8 characters." : "The new passwords do not match.");
            return;
        }
        setBusy(true);
        try {
            if (page === "password")
                await api.changePassword(current, password);
            else
                await updateProfile(page === "name" ? { name: name.trim() } : { email: email.trim() });
            setSaved(true);
            setCurrent("");
            setPassword("");
            setConfirm("");
            haptics.success();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Could not save. Try again.");
            haptics.error();
        }
        finally {
            setBusy(false);
        }
    };
    const goBack = () => {
        if (page !== "profile") { open("profile"); return; }
        if (router.canGoBack()) router.back();
        else router.replace("/settings");
    };
    return <ScreenShell><View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 }}><RoundBackButton onPress={goBack} disabled={busy}/><Text style={[styles.title, { flex: 1 }]}>{page === "profile" ? "Profile" : page === "name" ? "Name" : page === "login" ? "Change login ID" : "Change password"}</Text></View>
    {page === "profile" ? <SettingsGroup><SettingsRow icon="person-outline" label="Name" helper={user?.name} onPress={() => open("name")}/><SettingsRow icon="at-outline" label="Login ID" helper={user?.email} onPress={() => open("login")}/><SettingsRow icon="lock-closed-outline" label="Password" helper="Change your password" onPress={() => open("password")}/></SettingsGroup> : saved ? <View style={{ gap: 20 }}><SettingsSuccess text={page === "password" ? "Password saved" : page === "login" ? "Login ID saved" : "Name saved"}/>{page === "login" && <><Text selectable style={[styles.title, { textAlign: "center" }]}>{user?.email}</Text><Text style={styles.helper}>Use this ID next time you log in.</Text></>}<SettingsButton label="Done" onPress={() => open("profile")}/></View> : <View style={{ gap: 14 }}>
      {page === "password" ? <>
        <Text style={styles.helper}>At least 8 characters</Text>
        {[["Current password", current, setCurrent], ["New password", password, setPassword], ["Confirm new password", confirm, setConfirm]].map(([label, value, setter]) => <View key={String(label)} style={{ gap: 6 }}><Text style={styles.label}>{String(label)}</Text><TextInput accessibilityLabel={String(label)} style={styles.input} value={String(value)} onChangeText={setter as (text: string) => void} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} editable={!busy}/></View>)}
        <PressableScale accessibilityLabel={show ? "Hide passwords" : "Show passwords"} disabled={busy} onPress={() => setShow(!show)} style={{ minHeight: 44, alignSelf: "flex-start", padding: 10 }}><Text style={[styles.label, { color: "#0F6E56" }]}>{show ? "Hide" : "Show"}</Text></PressableScale>
      </> : <><Text style={styles.label}>{page === "name" ? "Name" : "Login ID (email address)"}</Text><TextInput style={styles.input} accessibilityLabel={page === "name" ? "Name" : "Login ID"} value={page === "name" ? name : email} onChangeText={page === "name" ? setName : setEmail} autoCapitalize={page === "name" ? "words" : "none"} keyboardType={page === "login" ? "email-address" : "default"} editable={!busy}/></>}
      {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}<SettingsButton label={busy ? "Saving…" : page === "password" ? "Save password" : "Save"} disabled={busy} onPress={() => { void save(); }}/>
    </View>}
  </ScreenShell>;
}
