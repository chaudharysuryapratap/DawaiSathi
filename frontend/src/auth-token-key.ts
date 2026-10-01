export const AUTH_TOKEN_KEY = "dawaisathi_authToken";
export const LEGACY_WEB_AUTH_TOKEN_KEY = "dawaisathi:authToken";

export function getAuthTokenStorageKey(platform: string): string {
  // Expo rejects the old native key before accessing SecureStore; keep it only for existing web sessions.
  return platform === "web" ? LEGACY_WEB_AUTH_TOKEN_KEY : AUTH_TOKEN_KEY;
}
