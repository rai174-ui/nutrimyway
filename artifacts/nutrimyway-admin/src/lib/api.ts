const BASE = import.meta.env.VITE_API_BASE || "/api";

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
export interface CenterWithStatus { id: string; name: string; is_active: boolean; valid_until: string | null; }
export interface CenterSettings { auto_checkout_min: number; photo_retention_days: number; checkin_cap: number; renewal_days: number; }
export interface TrialSettings { trial_3day_checkin_cap: number; trial_3day_renewal_days: number; }
export interface BroadcastSettings {
  center_id: string;
  retention_days: number;
}
export interface BroadcastSchedule {
  id: number;
  center_id: string;
  message: string;
  schedule_time: string;
  is_active: boolean;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface Broadcast {
  id: number;
  center_id: string;
  message: string;
  sent_at: string;
  sent_by: "scheduled" | "manual";
}

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
  const res = await fetch(`${BASE}${path}`, {
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

export interface OpenFlavour {
  flavour: string;
  ingredient_name: string;
  ingredient_id: number;
}

export interface MenuItem {
  id: number;
  center_id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  is_available: boolean;
  flavours: string;
  available_days: string;
  trial_eligible: boolean;
  created_at: string;
  bom: BomComponent[];
}

export interface VisitMenuSelection {
  id: number;
  checkin_id: number;
  menu_item_id: number;
  menu_item_name: string;
  is_mandatory: boolean;
  created_at: string;
}

export interface BomComponent {
  id: number;
  ingredient: string;
  ingredient_id: number | null;
  quantity: number;
  unit: string;
  kcal: number | null;
}

export interface BatchConsumptionLog {
  id: number;
  batch_id: number;
  quantity: number;
  notes: string | null;
  recorded_at: string;
}

export interface HealthRecord {
  id: number;
  member_id: number;
  center_id: string;
  recorded_at: string;
  weight_kg: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  visceral_fat: number | null;
  bmr: number | null;
  metabolic_age: number | null;
  muscle_mass_kg: number | null;
  resting_hr: number | null;
  notes: string | null;
}

export interface Dashboard {
  member_count: number;
  menu_item_count: number;
  today_calories: number;
  today_active_members: number;
  expiring_soon_count: number;
  monthly_checkins: { day: string; count: number }[];
}

export interface MemberLookup {
  id: number;
  name: string;
  mobile: string | null;
  email: string | null;
  membership_no: string | null;
  height_cm: number | null;
  date_of_joining: string | null;
}

export type MemberType = "trial_1day" | "trial_3day" | "regular" | "virtual";

export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  trial_1day: "Trial (1-day)",
  trial_3day: "Trial (3-day)",
  regular: "Regular",
  virtual: "Virtual",
};

export const CHECKIN_CAP = 32;

export interface CenterMember {
  id: number;
  name: string;
  date_of_joining: string | null;
  height_cm: number | null;
  mobile: string | null;
  email: string | null;
  membership_no: string | null;
  dob: string | null;
  age_at_joining: number | null;
  valid_until: string | null;
  daily_kcal: number | null;
  is_active: boolean;
  member_type: MemberType;
  cycle_started_at: string | null;
  checkins_used: number;
  checkin_id: number | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  already_consumed_today: boolean;
  effective_checkin_cap: number;
  effective_renewal_days: number;
}

export interface MemberRenewal {
  id: number;
  member_id: number;
  center_id: string;
  payment_method: "cash" | "online";
  amount: number;
  previous_valid_until: string | null;
  new_valid_until: string;
  recorded_by: string | null;
  created_at: string;
}

export interface MemberRenewalReportRow extends MemberRenewal {
  member_name: string;
  member_mobile: string | null;
  membership_no: string | null;
}

export interface SelfLogEntry {
  id: number;
  member_id: number;
  member_name: string;
  food_item: string;
  meal_slot: string;
  quantity_g: number | null;
  calories_kcal: number | null;
  logged_at: string;
  photo_url: string | null;
}

export interface ConsumptionLog {
  selected_flavour?: string | null;
  id: number;
  member_id: number;
  member_name: string;
  logged_at: string;
  meal_slot: string;
  food_item: string;
  quantity_g: number | null;
  calories_kcal: number | null;
  menu_item_id: number | null;
  menu_item_name: string | null;
  checkin_id: number | null;
}

export interface ConsumptionReport {
  from: string;
  to: string;
  by_component: { ingredient: string; unit: string; total_quantity: number; member_count: number; log_count: number }[];
  logs: ConsumptionLog[];
}

export function saveAuth(token: string, centerId: string, centerName: string, needsTermsAcceptance = false) {
  localStorage.setItem("nmw_admin_token", token);
  localStorage.setItem("nmw_admin_center_id", centerId);
  localStorage.setItem("nmw_admin_center_name", centerName);
  localStorage.setItem("nmw_admin_needs_terms", needsTermsAcceptance ? "true" : "false");
}

export function clearAuth() {
  localStorage.removeItem("nmw_admin_token");
  localStorage.removeItem("nmw_admin_center_id");
  localStorage.removeItem("nmw_admin_center_name");
  localStorage.removeItem("nmw_admin_needs_terms");
}

export function needsTermsAcceptance(): boolean {
  return localStorage.getItem("nmw_admin_needs_terms") === "true";
}

export function markTermsAccepted() {
  localStorage.setItem("nmw_admin_needs_terms", "false");
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

export interface CenterFlavour {
  id: number;
  center_id: string;
  name: string;
  available_days: string;
  created_at: string;
}

export interface Ingredient {
  id: number;
  name: string;
  pack_size: number;
  pack_unit: string;
  material_code: string | null;
  description: string | null;
  flavour: string | null;
  serving_qty: number;
  kcal_per_serving: number | null;
  trial_eligible: boolean;
  created_at: string;
}

export type BatchStatus = "new" | "open" | "consumed";

export interface IngredientBatch {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  pack_size: number;
  pack_unit: string;
  received_qty: number | null;
  received_unit: string | null;
  center_id: string;
  batch_number: string;
  status: BatchStatus;
  opened_at: string | null;
  consumed_at: string | null;
  created_at: string;
  consumed_qty: number;
  assigned_member_id?: number | null;
  assigned_member_name?: string | null;
}

export interface BatchAdjustment {
  id: number;
  batch_id: number;
  qty_change: number;
  note: string | null;
  adjusted_at: string;
}

export interface IngredientRequirement {
  ingredient_id: number;
  ingredient_name: string;
  pack_unit: string;
  min_serving_qty: number;
}

export interface FlavoursToday {
  day: string;
  flavours: CenterFlavour[];
}

export interface DepletingBatch {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  pack_size: number;
  pack_unit: string;
  received_qty: number | null;
  received_unit: string | null;
  batch_number: string;
  opened_at: string | null;
  capacity: number;
  consumed_qty: number;
  balance: number;
  balance_pct: number;
}
