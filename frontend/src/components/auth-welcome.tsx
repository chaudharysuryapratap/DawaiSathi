import PressableScale from "@/src/components/ui/PressableScale";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { ScrollView, Text, View } from "react-native";
import { TextInput } from "@/src/components/focus-input";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { ApiRequestError } from "@/src/api";
import { getErrorMessage } from "@/src/utils/error-message";
import { GoogleSignInButton } from "./google-sign-in-button";
import { PrimaryButton } from "./dawai-ui";

type Props = {
  google: boolean;
  onGoogle: () => void;
  onEmail: () => void;
  onBack: () => void;
};

export function AuthWelcome({ google, onGoogle, onEmail, onBack }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { googleLogin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [credential, setCredential] = useState<string | null>(null);
  const [linkRequired, setLinkRequired] = useState(false);
  const completeGoogle = async (idToken: string) => {
    setBusy(true);
    setError(null);
    try {
      await googleLogin({ id_token: idToken, password: password || undefined, invitation_token: token.trim() || undefined, bootstrap_token: token.trim() || undefined });
    } catch (loginError) {
      if (loginError instanceof ApiRequestError && loginError.status === 409) {
        setCredential(idToken);
        setLinkRequired(true);
      }
      setError(getErrorMessage(loginError, "Google sign-in could not complete."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID={google ? "auth-google-screen" : "auth-welcome-screen"}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={[colors.welcomeGradientTop, colors.welcomeGradientMiddle, colors.welcomeGradientBottom]}
        locations={[0, 0.57, 1]}
        style={styles.body}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.content}>
            {google ? (
              <PressableScale accessibilityRole="button" accessibilityLabel="Back to welcome" onPress={onBack} style={styles.back}>
                <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
                <Text style={styles.link}>Back</Text>
              </PressableScale>
            ) : null}
            <View style={styles.badge}>
              <MaterialCommunityIcons name="pill" size={25} color={colors.onSurface} />
              <Text style={styles.badgeName}>DawaiSathi</Text>
            </View>
            <Text accessibilityRole="header" style={styles.headline}>
              {google ? "Care starts with\nyour family." : "Family medicine,\nnever missed."}
            </Text>
            <Text style={styles.description}>
              Track doses, share prescriptions, and keep the whole family on schedule with simple daily reminders.
            </Text>
            <Image
              source={require("../../assets/images/family-care.svg")}
              style={styles.illustration}
              contentFit="contain"
              accessibilityLabel="A family with a medicine calendar"
            />
            <View style={styles.actions}>
              <Text accessibilityRole="header" style={styles.welcome}>{google ? "Sign up with Google" : "Welcome"}</Text>
              <Text style={styles.description}>
                {google
                  ? "One account to keep your family's care together."
                  : "Sign in to pick up your family's schedule right where you left off."}
              </Text>
              {google ? (
                <>
                  <Text style={styles.availability}>Joining a new family? Enter your invitation below. Existing members can continue directly.</Text>
                  <TextInput accessibilityLabel="Invitation or first-account setup code" value={token} onChangeText={setToken} editable={!busy} autoCapitalize="none" placeholder="Invitation or setup code (new accounts)" placeholderTextColor={colors.muted} style={styles.input} />
                  {linkRequired ? (
                    <>
                      <TextInput accessibilityLabel="Existing DawaiSathi password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry placeholder="Your existing DawaiSathi password" placeholderTextColor={colors.muted} style={styles.input} />
                      <PrimaryButton label={busy ? "Connecting…" : "Connect Google account"} disabled={busy || !password || !credential} onPress={() => { if (credential) void completeGoogle(credential); }} />
                    </>
                  ) : null}
                  <GoogleSignInButton onCredential={completeGoogle} onError={setError} disabled={busy} />
                  {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
                </>
              ) : (
              <PressableScale
                accessibilityRole="button"
                testID="auth-google-button"
                onPress={onGoogle}
                style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
              >
                <Image source={require("../../assets/images/google-mark.svg")} style={styles.googleMark} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </PressableScale>
              )}
              <PressableScale disabled={busy} accessibilityRole="button" testID="auth-email-button" onPress={onEmail} style={styles.emailButton}>
                <MaterialCommunityIcons name="email-outline" size={21} color={colors.brandPrimary} />
                <Text style={styles.link}>Continue with email</Text>
              </PressableScale>
            </View>
            <Text style={styles.footer}>A little care. Every day.</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.welcomeGradientTop },
  body: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 36 },
  content: { width: "100%", maxWidth: 500, alignSelf: "center", alignItems: "center" },
  back: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", minHeight: 44, gap: 8, marginBottom: 12 },
  badge: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.welcomeBadge, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 13, marginBottom: 26 },
  badgeName: { color: colors.onSurface, fontSize: 19, fontWeight: "700" },
  headline: { color: colors.onSurface, fontSize: 36, lineHeight: 41, fontWeight: "800", textAlign: "center", letterSpacing: -1, marginBottom: 18 },
  description: { color: colors.onSurfaceSecondary, fontSize: 16, lineHeight: 23, textAlign: "center" },
  illustration: { width: "84%", maxWidth: 310, aspectRatio: 320 / 230, marginTop: 20, marginBottom: 28 },
  actions: { width: "100%", alignItems: "center", gap: 12 },
  welcome: { color: colors.onSurface, fontSize: 27, fontWeight: "800" },
  googleButton: { minHeight: 58, width: "100%", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: colors.onBrandPrimary, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  googleMark: { width: 25, height: 25 },
  googleText: { color: colors.onSurface, fontSize: 17, fontWeight: "700", flexShrink: 1, textAlign: "center" },
  pressed: { opacity: 0.75 },
  emailButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, padding: 8 },
  link: { color: colors.brandPrimary, fontSize: 15, fontWeight: "700" },
  availability: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  input: { width: "100%", minHeight: 54, borderRadius: 16, padding: 14, backgroundColor: colors.onBrandPrimary, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  error: { color: colors.error, fontSize: 14, lineHeight: 21, textAlign: "center" },
  footer: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 20 },
}));
