import * as Linking from "expo-linking";
import { Platform } from "react-native";

export function normalizedFamilyCode(code: string) { return code.replace(/[\s-]/g, "").toUpperCase(); }
export function isFamilyCode(code: string) { return /^[0-9A-F]{16}$/.test(normalizedFamilyCode(code)); }
export function displayFamilyCode(code: string) { return normalizedFamilyCode(code).match(/.{1,4}/g)?.join("-") ?? code; }
export function familyJoinUrl(code: string) {
  const appUrl = process.env.EXPO_PUBLIC_APP_URL;
  if (appUrl) return `${appUrl.replace(/\/$/, "")}/join-family?code=${encodeURIComponent(code)}`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const base = new URL(window.location.origin);
    // A local preview QR must use the same LAN address as the phone, not localhost.
    if (["localhost", "127.0.0.1"].includes(base.hostname) && process.env.EXPO_PUBLIC_BACKEND_URL) {
      base.hostname = new URL(process.env.EXPO_PUBLIC_BACKEND_URL).hostname;
    }
    return `${base.origin}/join-family?code=${encodeURIComponent(code)}`;
  }
  return Linking.createURL("join-family", { queryParams: { code } });
}
