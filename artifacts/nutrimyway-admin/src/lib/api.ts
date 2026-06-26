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

export function apiDelete(path: string): Promise<void> {
  return apiFetch<void>(path, { method: "DELETE" });
}

export interface Center { id: string; name: string; }

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

export interface ConsumptionReport {
  from: string;
  to: string;
  by_component: { ingredient: string; unit: string; total_quantity_g: number; member_count: number; log_count: number }[];
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
