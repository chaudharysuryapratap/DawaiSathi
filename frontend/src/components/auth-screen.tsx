import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/src/components/focus-input";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthWelcome } from "@/src/components/auth-welcome";
import { PrimaryButton } from "@/src/components/dawai-ui";
import { useAuth } from "@/src/auth-context";
import { useTheme } from "@/src/theme";
import { getErrorMessage } from "@/src/utils/error-message";

export function AuthScreen({ initialInvitationCode = "" }: { initialInvitationCode?: string } = {}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<"welcome" | "google" | "email">(initialInvitationCode ? "email" : "welcome");
  const { error: authError, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialInvitationCode ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(initialInvitationCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRegister = mode === "register";

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isRegister) {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          bootstrap_token: token.trim(),
          invitation_token: token.trim(),
        });
      } else {
        await login(email.trim(), password);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not complete sign-in."));
    } finally {
      setBusy(false);
    }
  };

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.welcomeGradientTop },
    body: { flex: 1 },
    content: { flexGrow: 1, padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 20, width: "100%", maxWidth: 548, alignSelf: "center" },
    back: { minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8 },
    hero: { alignItems: "center", gap: 16 },
    badge: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.welcomeBadge, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 13 },
    badgeName: { color: colors.onSurface, fontSize: 19, fontWeight: "700" },
    headline: { color: colors.onSurface, fontSize: 36, lineHeight: 41, fontWeight: "800", textAlign: "center", letterSpacing: -1 },
    illustration: { width: 180, aspectRatio: 320 / 230 },
    form: { padding: 22, borderRadius: 24, gap: 18, backgroundColor: colors.welcomeBadge, borderColor: colors.border, borderWidth: 1 },
    title: { color: colors.onSurface, fontSize: 27, fontWeight: "800", textAlign: "center" },
    subtitle: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 22, textAlign: "center" },
    field: { gap: 7 },
    label: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
    input: {
      minHeight: 54,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.onBrandPrimary,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.onSurface,
      fontSize: 15,
    },
    message: { color: colors.error, fontSize: 13 },
    switch: { minHeight: 44, justifyContent: "center", alignItems: "center" },
    switchText: { color: colors.brandPrimary, fontWeight: "800" },
    footer: { color: colors.onSurfaceTertiary, fontSize: 13, textAlign: "center" },
  });

  if (screen !== "email") {
    return <AuthWelcome google={screen === "google"} onGoogle={() => setScreen("google")} onEmail={() => setScreen("email")} onBack={() => setScreen("welcome")} />;
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar style="dark" />
      <LinearGradient colors={[colors.welcomeGradientTop, colors.welcomeGradientMiddle, colors.welcomeGradientBottom]} locations={[0, 0.57, 1]} style={styles.body}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => setScreen("welcome")} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.brandPrimary} />
          <Text style={styles.switchText}>Back to welcome</Text>
        </Pressable>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="pill" size={25} color={colors.onSurface} />
            <Text style={styles.badgeName}>DawaiSathi</Text>
          </View>
          <Text accessibilityRole="header" style={styles.headline}>{"Family medicine,\nnever missed."}</Text>
          <Image source={require("../../assets/images/family-care.svg")} style={styles.illustration} contentFit="contain" accessibilityLabel="A family with a medicine calendar" />
        </View>
        <View style={styles.form}>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={styles.title}>{isRegister ? "Create your account" : "Welcome back"}</Text>
          <Text style={styles.subtitle}>
            {isRegister
              ? "Enter your details and the invitation provided by your family owner."
              : "Sign in to securely access your family's care information."}
          </Text>
        </View>
        {isRegister ? (
          <View style={styles.field}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              testID="auth-name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="Name"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="auth-email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="auth-password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoComplete={isRegister ? "new-password" : "current-password"}
            secureTextEntry
            placeholder={isRegister ? "At least 12 characters" : "Password"}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        {isRegister ? (
          <View style={styles.field}>
            <Text style={styles.label}>Family code, invitation or setup code</Text>
            <TextInput
              testID="auth-invitation-token"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              placeholder="Enter family code, invitation or setup code"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>
        ) : null}
        {error || authError ? (
          <Text accessibilityLiveRegion="assertive" style={styles.message}>
            {error ?? authError}
          </Text>
        ) : null}
        <PrimaryButton
          testID="auth-submit"
          label={busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
          onPress={() => void submit()}
          disabled={busy || !email.trim() || !password || (isRegister && (!name.trim() || !token.trim()))}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          testID="auth-mode-toggle"
          onPress={() => {
            setMode(isRegister ? "login" : "register");
            setError(null);
          }}
          style={styles.switch}
        >
          <Text style={styles.switchText}>
            {isRegister ? "Already have an account? Sign in" : "New to DawaiSathi? Create account"}
          </Text>
        </Pressable>
        </View>
        <Text style={styles.footer}>A little care. Every day.</Text>
      </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
