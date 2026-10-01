export const AUTH_TOKEN_KEY = "dawaisathi:authToken";
export const LEGACY_WEB_AUTH_TOKEN_KEY = AUTH_TOKEN_KEY;
export const NATIVE_AUTH_TOKEN_KEY = "dawaisathi_authToken";

export function getPhysicalSecureStorageKey(key: string, platform: "native" | "web"): string {
  if (platform === "web") return key;
  return key === AUTH_TOKEN_KEY ? NATIVE_AUTH_TOKEN_KEY : key;
}
