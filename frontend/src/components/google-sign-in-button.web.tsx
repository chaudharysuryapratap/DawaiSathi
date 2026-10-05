import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import type { GoogleButtonProps } from "./google-sign-in-button";
import { useTheme } from "@/src/theme";

type GoogleIdentity = {
  initialize: (options: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean }) => void;
  renderButton: (element: HTMLElement, options: { theme: string; size: string; shape: string; text: string; width: number }) => void;
};
type GoogleWindow = Window & { google?: { accounts: { id: GoogleIdentity } } };
let scriptLoading: Promise<void> | undefined;

function loadGoogle() {
  if ((window as GoogleWindow).google?.accounts.id) return Promise.resolve();
  if (!scriptLoading) {
    scriptLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google sign-in could not load. Check your connection."));
      document.head.appendChild(script);
    }).catch((error) => { scriptLoading = undefined; throw error; });
  }
  return scriptLoading;
}

export function GoogleSignInButton(props: GoogleButtonProps) {
  const { colors } = useTheme();
  const element = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const [loading, setLoading] = useState(true);
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    void loadGoogle().then(() => {
      if (cancelled || !element.current) return;
      const identity = (window as GoogleWindow).google?.accounts.id;
      if (!identity) throw new Error("Google sign-in is unavailable.");
      identity.initialize({ client_id: clientId, auto_select: false, callback: (response) => {
        if (!cancelled && !latest.current.disabled) {
          void latest.current.onCredential(response.credential).catch(() => latest.current.onError("Google sign-in could not complete. Try again."));
        }
      } });
      identity.renderButton(element.current, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: Math.min(320, element.current.clientWidth || 320) });
      setLoading(false);
    }).catch((error: Error) => { if (!cancelled) { setLoading(false); latest.current.onError(error.message); } });
    return () => { cancelled = true; };
  }, [clientId]);
  if (!clientId) return <Text style={{ color: colors.onSurfaceSecondary, textAlign: "center" }}>Google sign-in is not configured yet. Please use email.</Text>;
  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      {loading ? <Text style={{ color: colors.onSurfaceSecondary }}>Loading Google sign-in…</Text> : null}
      <div ref={element} style={{ width: "100%", display: "flex", justifyContent: "center", pointerEvents: props.disabled ? "none" : "auto", opacity: props.disabled ? 0.6 : 1 }} />
    </View>
  );
}
