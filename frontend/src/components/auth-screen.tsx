import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/src/components/dawai-ui";
import { useAuth } from "@/src/auth-context";
import { useTheme } from "@/src/theme";
import { getErrorMessage } from "@/src/utils/error-message";

export function AuthScreen() {
  const { colors } = useTheme();
  const { error: authError, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
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
    root: { flex: 1, backgroundColor: colors.surface },
    content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 18 },
    title: { color: colors.onSurface, fontSize: 30, fontWeight: "800" },
    subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
    field: { gap: 7 },
    label: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
    input: {
      minHeight: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 14,
      color: colors.onSurface,
      fontSize: 15,
    },
    message: { color: colors.error, fontSize: 13 },
    switch: { minHeight: 44, justifyContent: "center", alignItems: "center" },
    switchText: { color: colors.brandPrimary, fontWeight: "800" },
  });

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <Text style={styles.title}>{isRegister ? "Create your account" : "Welcome to DawaiSathi"}</Text>
          <Text style={styles.subtitle}>
            {isRegister
              ? "Use the one-time owner token for the first account, or an invitation token to join a family."
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
            <Text style={styles.label}>Bootstrap or invitation token</Text>
            <TextInput
              testID="auth-invitation-token"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              placeholder="Provided by the local administrator or family owner"
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
          testID="auth-mode-toggle"
          onPress={() => {
            setMode(isRegister ? "login" : "register");
            setError(null);
          }}
          style={styles.switch}
        >
          <Text style={styles.switchText}>
            {isRegister ? "Already have an account? Sign in" : "Have a bootstrap or invitation token? Create account"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
