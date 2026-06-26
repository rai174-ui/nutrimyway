const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("nmw_admin_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Request failed (${res.status})`;
    try { msg = (JSON.parse(text) as { error: string }).error ?? msg; } catch { /* */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "PATCH", body: body != null ? JSON.stringify(body) : undefined });
}

export function apiDelete(path: string): Promise<void> {
  return apiFetch<void>(path, { method: "DELETE" });
}

export function bomPutPath(menuItemId: number, bomId: number): string {
  return `/admin/menu-items/${menuItemId}/bom/${bomId}`;
}

export function bomDeletePath(menuItemId: number, bomId: number): string {
  return `/admin/menu-items/${menuItemId}/bom/${bomId}`;
}

export interface Center { id: string; name: string; }
export interface CenterWithStatus { id: string; name: string; is_active: boolean; }

export function saveSuperAuth(token: string) {
  localStorage.setItem("nmw_super_token", token);
}
export function getSuperToken(): string | null {
  return localStorage.getItem("nmw_super_token");
}
export function clearSuperAuth() {
  localStorage.removeItem("nmw_super_token");
}
export function isSuperAuthenticated(): boolean {
  return !!getSuperToken();
}

export function superAuthHeaders(): Record<string, string> {
  const t = getSuperToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function superFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...superAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Request failed (${res.status})`;
    try { msg = (JSON.parse(text) as { error: string }).error ?? msg; } catch { /* */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface MenuItem {
  id: number;
  center_id: string;
  name: string;
  description: string | null;
  created_at: string;
  bom: BomComponent[];
}

export interface BomComponent {
  id: number;
  ingredient: string;
  quantity: number;
  unit: string;
}

export interface Dashboard {
  member_count: number;
  menu_item_count: number;
  today_calories: number;
  today_active_members: number;
}

export interface MemberLookup {
  id: number;
  name: string;
  mobile: string | null;
  email: string | null;
  height_cm: number | null;
  date_of_joining: string | null;
}

export interface CenterMember {
  id: number;
  name: string;
  date_of_joining: string | null;
  height_cm: number | null;
  mobile: string | null;
  email: string | null;
  checkin_id: number | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
}

export interface ConsumptionReport {
  from: string;
  to: string;
  by_component: { ingredient: string; unit: string; total_quantity: number; member_count: number; log_count: number }[];
  logs: { id: number; member_id: number; member_name: string; logged_at: string; meal_slot: string; food_item: string; quantity_g: number; calories_kcal: number }[];
}

export function saveAuth(token: string, centerId: string, centerName: string) {
  localStorage.setItem("nmw_admin_token", token);
  localStorage.setItem("nmw_admin_center_id", centerId);
  localStorage.setItem("nmw_admin_center_name", centerName);
}

export function clearAuth() {
  localStorage.removeItem("nmw_admin_token");
  localStorage.removeItem("nmw_admin_center_id");
  localStorage.removeItem("nmw_admin_center_name");
}

export function getAdminCenter(): { id: string; name: string } | null {
  const id = localStorage.getItem("nmw_admin_center_id");
  const name = localStorage.getItem("nmw_admin_center_name");
  if (!id || !name) return null;
  return { id, name };
}

export function isAuthenticated(): boolean {
  return !!getToken() && !!getAdminCenter();
}
