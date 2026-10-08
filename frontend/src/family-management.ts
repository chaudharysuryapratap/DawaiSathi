import { API_BASE_URL, authHeaders } from "./api";
export type Invite = {
  id: string;
  email: string | null;
  member_id?: string;
  code?: string;
  expires_at: string;
  status?: string;
};
export type JoinPreview = {
  family_group_id: string;
  name: string;
  owner_name: string;
  member_count: number;
  expires_at: string;
};
export type Profile = {
  name: string;
  role: string;
  relationship: string;
  email: string | null;
};
export type DeletedMember = {
  member_id: string;
  profile: Profile;
  recover_until: string;
};
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/family-management${path}`, {
    method,
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Check your details and try again.",
    );
  return data;
}
export const familyManagement = {
  summary: (id: string) => request<{ owner_name: string }>(`/${id}/summary`),
  invites: (id: string) => request<Invite[]>(`/${id}/invites`),
  invite: (id: string, email: string | null = null, member_id?: string) =>
    request<Invite>(`/${id}/invites`, "POST", {
      email: email || null,
      member_id,
    }),
  cancel: (group: string, invite: string) =>
    request(`/${group}/invites/${invite}`, "DELETE"),
  preview: (code: string) =>
    request<JoinPreview>("/invite/preview", "POST", { code }),
  accept: (code: string) =>
    request<{ family_group_id: string }>("/invite/accept", "POST", { code }),
  saveMember: (group: string, value: Profile, id?: string) =>
    request(
      `/${group}/members${id ? `/${id}` : ""}`,
      id ? "PUT" : "POST",
      value,
    ),
  removeMember: (group: string, id: string) =>
    request(`/${group}/members/${id}`, "DELETE"),
  deletedMembers: (group: string) =>
    request<DeletedMember[]>(`/${group}/deleted-members`),
  restoreMember: (group: string, id: string) =>
    request(`/${group}/members/${id}/restore`, "POST"),
};
