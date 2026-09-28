import Constants from "expo-constants";

import type {
  AttentionItem,
  Checkup,
  CheckupInput,
  DoseLog,
  EyeDropProtocol,
  EyeDropProtocolInput,
  Medicine,
  MedicineInput,
  Member,
  NotificationPreference,
  ProtocolStepLog,
  TodayDose,
  TodayProtocol,
} from "./types";

type ExpoConfig = { extra?: { backendUrl?: string } };
const config = Constants.expoConfig as ExpoConfig | null;
const configuredUrl =
  config?.extra?.backendUrl ??
  process.env.EXPO_BACKEND_URL ??
  process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_BASE_URL = `${configuredUrl?.replace(/\/$/, "") ?? ""}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? "We couldn't complete that request.");
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : (null as unknown as T)) as T;
}

const query = (params: Record<string, string | number | null | undefined>) => {
  const search = Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return search ? `?${search}` : "";
};

export const api = {
  members: () => request<Member[]>("/members"),
  createMember: (name: string, role = "member") =>
    request<Member>("/members", { method: "POST", body: JSON.stringify({ name, role }) }),
  updateMember: (id: string, patch: { name?: string; role?: string }) =>
    request<Member>(`/members/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  removeMember: (id: string) =>
    request<{ ok: boolean }>(`/members/${id}`, { method: "DELETE" }),

  medicines: (memberId?: string | null, activeOnly = true) =>
    request<Medicine[]>(
      `/medicines${query({ member_id: memberId ?? null, active_only: activeOnly ? "true" : "false" })}`,
    ),
  createMedicine: (input: MedicineInput) =>
    request<Medicine>("/medicines", { method: "POST", body: JSON.stringify(input) }),
  updateMedicine: (id: string, input: Partial<MedicineInput> & { active?: boolean }) =>
    request<Medicine>(`/medicines/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  archiveMedicine: (id: string) =>
    request<{ ok: boolean }>(`/medicines/${id}`, { method: "DELETE" }),
  restoreMedicine: (id: string) =>
    request<Medicine>(`/medicines/${id}/restore`, { method: "POST" }),
  refillMedicine: (id: string, quantity: number) =>
    request<Medicine>(`/medicines/${id}/refill${query({ quantity })}`, { method: "POST" }),

  today: (memberId?: string | null) =>
    request<{ date: string; doses: TodayDose[]; protocols: TodayProtocol[] }>(
      `/today${query({ member_id: memberId ?? null })}`,
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
  history: (filters: { memberId?: string | null; medicineId?: string | null; date?: string | null; limit?: number } = {}) =>
    request<DoseLog[]>(
      `/doses/history${query({
        limit: filters.limit ?? 200,
        member_id: filters.memberId ?? null,
        medicine_id: filters.medicineId ?? null,
        date: filters.date ?? null,
      })}`,
    ),

  protocols: (memberId?: string | null, activeOnly = true) =>
    request<EyeDropProtocol[]>(
      `/eye-drop-protocols${query({
        member_id: memberId ?? null,
        active_only: activeOnly ? "true" : "false",
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
  } = {}) =>
    request<ProtocolStepLog[]>(
      `/eye-drop-protocols/history${query({
        limit: filters.limit ?? 200,
        member_id: filters.memberId ?? null,
        protocol_id: filters.protocolId ?? null,
        date: filters.date ?? null,
      })}`,
    ),

  checkups: (memberId?: string | null) =>
    request<Checkup[]>(`/checkups${query({ member_id: memberId ?? null })}`),
  createCheckup: (input: CheckupInput) =>
    request<Checkup>("/checkups", { method: "POST", body: JSON.stringify(input) }),
  updateCheckup: (id: string, input: Partial<CheckupInput>) =>
    request<Checkup>(`/checkups/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  removeCheckup: (id: string) =>
    request<{ ok: boolean }>(`/checkups/${id}`, { method: "DELETE" }),

  upcomingCheckup: (memberId?: string | null) =>
    request<Checkup | null>(`/upcoming-checkup${query({ member_id: memberId ?? null })}`),

  attention: () => request<{ items: AttentionItem[] }>("/attention"),

  notificationPreferences: () => request<NotificationPreference>("/notifications/preferences"),
  saveNotificationPreferences: (preferences: NotificationPreference) =>
    request<NotificationPreference>("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
    }),
};
