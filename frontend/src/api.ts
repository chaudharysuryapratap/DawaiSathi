import Constants from "expo-constants";
import { Platform } from "react-native";

import type {
  AttentionItem,
  Account,
  Checkup,
  FamilyGroup,
  CheckupInput,
  DoseLog,
  EyeDropProtocol,
  EyeDropProtocolInput,
  Medicine,
  MedicineInput,
  Member,
  MissedDoseEvent,
  NotificationPreference,
  ProtocolStepLog,
  TodayDose,
  TodayProtocol,
} from "./types";
import { sanitizeErrorMessage } from "./utils/error-message";

type ExpoConfig = { extra?: { backendUrl?: string; backendUrlWeb?: string } };
const config = Constants.expoConfig as ExpoConfig | null;
const configuredUrl =
  Platform.OS === "web"
    ? process.env.EXPO_PUBLIC_BACKEND_URL_WEB ??
      config?.extra?.backendUrlWeb ??
      "http://127.0.0.1:8000"
    : config?.extra?.backendUrl ??
      process.env.EXPO_BACKEND_URL ??
      process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_BASE_URL = `${configuredUrl?.replace(/\/$/, "") ?? ""}/api`;
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");
let accessToken: string | null = null;

export function resolveMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function formatErrorDetail(value: unknown): string | null {
  if (typeof value === "string") return sanitizeErrorMessage(value) || null;
  if (Array.isArray(value)) {
    const messages = value.map(formatErrorDetail).filter((message): message is string => !!message);
    return messages.length ? messages.join("; ") : null;
  }
  if (!value || typeof value !== "object") return null;

  const detail = value as Record<string, unknown>;
  if (typeof detail.msg === "string") {
    const location = Array.isArray(detail.loc)
      ? detail.loc
          .filter(
            (part): part is string | number =>
              (typeof part === "string" || typeof part === "number") && part !== "body",
          )
          .map(String)
          .join(" ")
      : "";
    const message = sanitizeErrorMessage(detail.msg) || null;
    return message ? (location ? `${location}: ${message}` : message) : null;
  }
  return (
    formatErrorDetail(detail.message) ??
    formatErrorDetail(detail.detail) ??
    formatErrorDetail(detail.error)
  );
}

function apiErrorMessage(body: unknown): string | null {
  if (typeof body === "string") return sanitizeErrorMessage(body) || null;
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;
  return (
    formatErrorDetail(payload.detail) ??
    formatErrorDetail(payload.message) ??
    formatErrorDetail(payload.error)
  );
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Could not reach the DawaiSathi server. Check that it is running and try again.");
  }
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new Error("Could not read the response from the DawaiSathi server. Try again.");
  }
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const message =
      apiErrorMessage(body) ?? `The server could not complete the request (HTTP ${response.status}).`;
    throw new ApiRequestError(message, response.status);
  }
  if (!text) return null as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("The server returned an unreadable response. Try again.");
  }
}

const query = (params: Record<string, string | number | null | undefined>) => {
  const search = Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return search ? `?${search}` : "";
};

export const api = {
  register: (input: { name: string; email: string; password: string; bootstrap_token?: string; invitation_token?: string }) =>
    request<{ access_token: string; user: Account }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string; user: Account }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  currentAccount: () => request<Account>("/auth/me"),
  createFamilyInvitation: (familyGroupId: string, email: string) =>
    request<{ email: string; family_group_id: string; token: string; expires_at: string }>(
      `/family-groups/${encodeURIComponent(familyGroupId)}/invites`,
      { method: "POST", body: JSON.stringify({ email }) },
    ),
  acceptFamilyInvitation: (token: string) =>
    request<{ ok: boolean; family_group_id: string }>("/family-invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  leaveFamilyGroup: (familyGroupId: string) =>
    request<{ ok: boolean }>(
      `/family-groups/${encodeURIComponent(familyGroupId)}/membership`,
      { method: "DELETE" },
    ),
  familyGroups: () => request<FamilyGroup[]>("/family-groups"),
  createFamilyGroup: (name: string) =>
    request<FamilyGroup>("/family-groups", { method: "POST", body: JSON.stringify({ name }) }),
  renameFamilyGroup: (id: string, name: string) =>
    request<FamilyGroup>(`/family-groups/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),

  members: (familyGroupId?: string | null) =>
    request<Member[]>(`/members${query({ family_group_id: familyGroupId ?? null })}`),
  createMember: (name: string, role = "member", familyGroupId?: string | null) =>
    request<Member>("/members", {
      method: "POST",
      body: JSON.stringify({ name, role, family_group_id: familyGroupId ?? null }),
    }),
  updateMember: (id: string, patch: { name?: string; role?: string }) =>
    request<Member>(`/members/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  removeMember: (id: string) =>
    request<{ ok: boolean }>(`/members/${id}`, { method: "DELETE" }),

  medicines: (memberId?: string | null, activeOnly = true, familyGroupId?: string | null) =>
    request<Medicine[]>(
      `/medicines${query({
        member_id: memberId ?? null,
        active_only: activeOnly ? "true" : "false",
        family_group_id: familyGroupId ?? null,
      })}`,
    ),
  createMedicine: (input: MedicineInput) =>
    request<Medicine>("/medicines", { method: "POST", body: JSON.stringify(input) }),
  updateMedicine: (id: string, input: Partial<MedicineInput> & { active?: boolean }) =>
    request<Medicine>(`/medicines/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  uploadMedicineImage: (contentType: string, imageBase64: string) =>
    request<{ image_url: string }>("/medicine-images", {
      method: "POST",
      body: JSON.stringify({ content_type: contentType, image_base64: imageBase64 }),
    }),
  archiveMedicine: (id: string) =>
    request<{ ok: boolean }>(`/medicines/${id}`, { method: "DELETE" }),
  restoreMedicine: (id: string) =>
    request<Medicine>(`/medicines/${id}/restore`, { method: "POST" }),
  refillMedicine: (id: string, quantity: number) =>
    request<Medicine>(`/medicines/${id}/refill${query({ quantity })}`, { method: "POST" }),

  today: (memberId?: string | null, familyGroupId?: string | null) =>
    request<{ date: string; doses: TodayDose[]; protocols: TodayProtocol[]; missed_doses: MissedDoseEvent[] }>(
      `/today${query({ member_id: memberId ?? null, family_group_id: familyGroupId ?? null })}`,
    ),
  missedDoseHistory: (memberId?: string | null, familyGroupId?: string | null) =>
    request<MissedDoseEvent[]>(
      `/missed-doses/history${query({
        member_id: memberId ?? null,
        family_group_id: familyGroupId ?? null,
        limit: 500,
      })}`,
    ),
  logDose: (id: string, time: string) =>
    request<DoseLog>(`/medicines/${id}/dose`, {
      method: "POST",
      body: JSON.stringify({ time }),
    }),
  undoDose: (id: string, time: string, date?: string) =>
    request<{ ok: boolean }>(
      `/medicines/${id}/dose${query({ time, date: date ?? null })}`,
      { method: "DELETE" },
    ),
  history: (filters: { memberId?: string | null; medicineId?: string | null; date?: string | null; limit?: number; familyGroupId?: string | null } = {}) =>
    request<DoseLog[]>(
      `/doses/history${query({
        limit: filters.limit ?? 200,
        member_id: filters.memberId ?? null,
        medicine_id: filters.medicineId ?? null,
        date: filters.date ?? null,
        family_group_id: filters.familyGroupId ?? null,
      })}`,
    ),

  protocols: (memberId?: string | null, activeOnly = true, familyGroupId?: string | null) =>
    request<EyeDropProtocol[]>(
      `/eye-drop-protocols${query({
        member_id: memberId ?? null,
        active_only: activeOnly ? "true" : "false",
        family_group_id: familyGroupId ?? null,
      })}`,
    ),
  createProtocol: (input: EyeDropProtocolInput) =>
    request<EyeDropProtocol>("/eye-drop-protocols", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProtocol: (id: string, input: Partial<EyeDropProtocolInput> & { active?: boolean }) =>
    request<EyeDropProtocol>(`/eye-drop-protocols/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  archiveProtocol: (id: string) =>
    request<{ ok: boolean }>(`/eye-drop-protocols/${id}`, { method: "DELETE" }),
  logProtocolStep: (id: string, order: number) =>
    request<ProtocolStepLog>(`/eye-drop-protocols/${id}/step/${order}/log`, {
      method: "POST",
    }),
  undoProtocolStep: (id: string, order: number, date?: string) =>
    request<{ ok: boolean }>(
      `/eye-drop-protocols/${id}/step/${order}/log${query({ date: date ?? null })}`,
      { method: "DELETE" },
    ),
  protocolHistory: (filters: {
    memberId?: string | null;
    protocolId?: string | null;
    date?: string | null;
    limit?: number;
    familyGroupId?: string | null;
  } = {}) =>
    request<ProtocolStepLog[]>(
      `/eye-drop-protocols/history${query({
        limit: filters.limit ?? 200,
        member_id: filters.memberId ?? null,
        protocol_id: filters.protocolId ?? null,
        date: filters.date ?? null,
        family_group_id: filters.familyGroupId ?? null,
      })}`,
    ),

  checkups: (memberId?: string | null, familyGroupId?: string | null) =>
    request<Checkup[]>(
      `/checkups${query({ member_id: memberId ?? null, family_group_id: familyGroupId ?? null })}`,
    ),
  createCheckup: (input: CheckupInput) =>
    request<Checkup>("/checkups", { method: "POST", body: JSON.stringify(input) }),
  updateCheckup: (id: string, input: Partial<CheckupInput>) =>
    request<Checkup>(`/checkups/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  removeCheckup: (id: string) =>
    request<{ ok: boolean }>(`/checkups/${id}`, { method: "DELETE" }),

  upcomingCheckup: (memberId?: string | null, familyGroupId?: string | null) =>
    request<Checkup | null>(
      `/upcoming-checkup${query({ member_id: memberId ?? null, family_group_id: familyGroupId ?? null })}`,
    ),

  attention: (familyGroupId?: string | null) =>
    request<{ items: AttentionItem[] }>(`/attention${query({ family_group_id: familyGroupId ?? null })}`),

  notificationPreferences: () => request<NotificationPreference>("/notifications/preferences"),
  saveNotificationPreferences: (preferences: NotificationPreference) =>
    request<NotificationPreference>("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
    }),
};
