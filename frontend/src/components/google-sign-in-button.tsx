import { useState } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Image } from "expo-image";
import { Pressable, Text } from "react-native";

import { makeStyles } from "@/src/theme";

export type GoogleButtonProps = {
  onCredential: (token: string) => Promise<void>;
  onError: (message: string) => void;
  disabled?: boolean;
};

export function GoogleSignInButton({ onCredential, onError, disabled }: GoogleButtonProps) {
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      onError("Google sign-in requires the DawaiSathi development app. Email sign-in is available in Expo Go.");
      return;
    }
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      onError("Google sign-in is not configured yet. Please use email.");
      return;
    }
    setBusy(true);
    try {
      const { GoogleSignin, isSuccessResponse } = await import("@react-native-google-signin/google-signin");
      GoogleSignin.configure({ webClientId, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        if (!response.data.idToken) throw new Error("Google did not return an identity token.");
        await onCredential(response.data.idToken);
      }
    } catch {
      onError("Google sign-in could not complete. Check your connection and Google account configuration, then try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable testID="google-provider-sign-in" accessibilityRole="button" disabled={busy || disabled} onPress={() => void signIn()} style={styles.button}>
      <Image source={require("../../assets/images/google-mark.svg")} style={styles.mark} />
      <Text style={styles.label}>{busy ? "Connecting…" : "Continue with Google"}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  button: { minHeight: 58, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, padding: 14, borderRadius: 16, backgroundColor: colors.onBrandPrimary, borderWidth: 1, borderColor: colors.border },
  mark: { width: 25, height: 25 },
  label: { color: colors.onSurface, fontSize: 17, fontWeight: "700" },
}));
