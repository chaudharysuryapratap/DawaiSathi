import Constants from "expo-constants";

import type { DoseLog, Medicine, MedicineInput, TodayDose } from "./types";

type ExpoConfig = { extra?: { backendUrl?: string } };
const config = Constants.expoConfig as ExpoConfig | null;
const configuredUrl = config?.extra?.backendUrl ?? process.env.EXPO_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
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
  return response.json() as Promise<T>;
}

export const api = {
  medicines: () => request<Medicine[]>("/medicines"),
  today: () => request<{ date: string; doses: TodayDose[] }>("/today"),
  history: () => request<DoseLog[]>("/doses/history?limit=100"),
  createMedicine: (input: MedicineInput) =>
    request<Medicine>("/medicines", { method: "POST", body: JSON.stringify(input) }),
  updateMedicine: (id: string, input: Partial<MedicineInput>) =>
    request<Medicine>(`/medicines/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  archiveMedicine: (id: string) =>
    request<{ ok: boolean }>(`/medicines/${id}`, { method: "DELETE" }),
  logDose: (id: string, time: string) =>
    request<DoseLog>(`/medicines/${id}/dose`, {
      method: "POST",
      body: JSON.stringify({ time }),
    }),
};