import { API_BASE_URL, authHeaders } from "./api";

export type PrescriptionMedicine = {
  name: string;
  dosage: string;
  timing: string;
  instructions: string;
};
export type PrescriptionPage = {
  id?: string;
  name: string;
  content_type: string;
  base64?: string;
  preview_url?: string;
  url?: string;
  page_count: number;
};
export type Prescription = {
  revision?: number;
  id?: string;
  family_group_id: string;
  member_id: string;
  prescription_date: string;
  doctor: string;
  notes: string;
  medicines: PrescriptionMedicine[];
  pages: PrescriptionPage[];
  archived: boolean;
};
async function request<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "Could not save the prescription. Check your details and try again.",
    );
  return result;
}
export const prescriptions = {
  list: (family: string) =>
    request<Prescription[]>(
      `/prescriptions?family_group_id=${encodeURIComponent(family)}`,
    ),
  save: (value: Prescription) =>
    request<Prescription>(
      `/prescriptions${value.id ? `/${value.id}` : ""}`,
      value.id ? "PUT" : "POST",
      value,
    ),
  remove: (id: string) => request(`/prescriptions/${id}`, "DELETE"),
  preview: (value: PrescriptionPage) =>
    request<{ preview_url: string; page_count: number }>(
      "/prescription-preview",
      "POST",
      value,
    ),
};
