/**
 * Typed API client for the Routine Recovery backend.
 *
 * Every request automatically attaches the X-API-Key header when an API key
 * is available.  Call `setApiKey(key)` once after the demo-user handshake.
 *
 * All responses are returned as-is (raw backend shape — snake_case).
 * Use `utils/transforms.ts` to convert to the camelCase frontend types.
 */

import { API_BASE_URL } from "../constants/config";

// ── Internal key store ────────────────────────────────────────────────────────

let _apiKey: string | null = null;

export function setApiKey(key: string) {
  _apiKey = key;
}

export function getApiKey(): string | null {
  return _apiKey;
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Bypass ngrok's browser-warning interstitial page on free tier
    "ngrok-skip-browser-warning": "true",
    ...(options.headers as Record<string, string>),
  };

  if (_apiKey) {
    headers["X-API-Key"] = _apiKey;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(response.status, text || response.statusText, path);
  }

  // 204 No Content — nothing to parse
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly path: string
  ) {
    super(`API ${status} on ${path}: ${detail}`);
    this.name = "ApiError";
  }
}

// ── Convenience helpers ────────────────────────────────────────────────────────

const get = <T>(path: string) => request<T>(path, { method: "GET" });

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });

const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

// ── Raw backend types (snake_case) ────────────────────────────────────────────
// These mirror the Pydantic Read schemas from the backend.

export interface RawUser {
  id: number;
  email: string;
  name: string;
  api_key: string;
  created_at: string;
}

export interface RawUserPreferences {
  id: number;
  user_id: number;
  planned_wake_time: string;
  planned_sleep_time: string;
  min_sleep_minutes: number;
  notification_preference: string;
  recovery_mode_default: string;
  buffer_minutes: number;
  max_recovery_minutes_per_day: number;
}

export interface RawRoutineBlock {
  id: number;
  user_id: number;
  title: string;
  start_time: string;
  end_time: string;
  priority: string;
  is_fixed: boolean;
  can_shift: boolean;
  can_compress: boolean;
  min_duration_minutes: number | null;
  can_skip: boolean;
  recover_if_missed: boolean;
  reminder_offset_minutes: number;
  sort_order: number;
}

export interface RawOneTimeTask {
  id: number;
  user_id: number;
  title: string;
  date: string;
  duration_minutes: number;
  timing_type: string;
  priority: string;
  notes: string | null;
  is_completed: boolean;
}

export interface RawScheduleBlock {
  id: number;
  schedule_id: number;
  title: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  priority: string;
  recover_if_missed: boolean;
  source_type: string;
  missed_reason: string | null;
}

export interface RawScheduleResponse {
  schedule: {
    id: number;
    user_id: number;
    date: string;
    completion_rate: number;
    status: string;
  };
  blocks: RawScheduleBlock[];
  conflicts: unknown[];
}

export interface RawBlockStatusResponse {
  block: RawScheduleBlock;
  time_saved_minutes: number | null;
  debt_created: { debt_id: number; category: string; minutes_owed: number } | null;
  message: string;
}

export interface RawSleepLog {
  id: number;
  user_id: number;
  date: string;
  planned_sleep_time: string;
  planned_wake_time: string;
  actual_sleep_time: string | null;
  actual_wake_time: string | null;
  sleep_duration_minutes: number | null;
  wake_delay_minutes: number | null;
}

export interface RawPowerNap {
  id: number;
  user_id: number;
  date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  note: string | null;
  impact_level: string;
}

export interface RawRoutineDebt {
  id: number;
  user_id: number;
  category: string;
  minutes_owed: number;
  minutes_recovered: number;
  status: string;
  created_at: string;
  target_cleared_by: string | null;
}

export interface RawDebtSummary {
  total_minutes_owed: number;
  total_minutes_recovered: number;
  net_minutes: number;
  by_category: Record<string, number>;
  debts: RawRoutineDebt[];
}

export interface RawRecoveryBlock {
  id: number;
  user_id: number;
  debt_id: number;
  schedule_id: number | null;
  planned_start: string;
  planned_end: string;
  status: string;
  minutes_recovered: number;
}

export interface RawRecoveryPlanResponse {
  blocks: RawRecoveryBlock[];
  unresolved_debt: RawRoutineDebt[];
  warning: string | null;
}

export interface RawMissedBlockDetail {
  id: number;
  title: string;
  planned_start: string;
  planned_end: string;
  reason: string | null;
  recover_if_missed: boolean;
}

export interface RawReviewSummary {
  id: number;
  user_id: number;
  date: string;
  completion_rate: number;
  completed_count: number;
  missed_count: number;
  delayed_count: number;
  skipped_count: number;
  debt_added_minutes: number;
  debt_cleared_minutes: number;
  sleep_summary: Record<string, unknown> | null;
  missed_blocks: RawMissedBlockDetail[] | null;
  reviewed_at: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (name: string, email: string, password: string) =>
      post<RawUser>("/auth/register", { name, email, password }),
    login: (email: string, password: string) =>
      post<RawUser>("/auth/login", { email, password }),
  },

  users: {
    demo: () => post<RawUser>("/users/demo"),
    get: (userId: number) => get<RawUser>(`/users/${userId}`),
    getPreferences: (userId: number) =>
      get<RawUserPreferences>(`/users/${userId}/preferences`),
    updatePreferences: (userId: number, data: Partial<RawUserPreferences>) =>
      put<RawUserPreferences>(`/users/${userId}/preferences`, data),
  },

  routine: {
    list: (userId: number) =>
      get<RawRoutineBlock[]>(`/users/${userId}/routine/blocks`),
    create: (userId: number, data: Partial<RawRoutineBlock>) =>
      post<RawRoutineBlock>(`/users/${userId}/routine/blocks`, data),
    update: (blockId: number, data: Partial<RawRoutineBlock>) =>
      put<RawRoutineBlock>(`/routine/blocks/${blockId}`, data),
    delete: (blockId: number) => del<void>(`/routine/blocks/${blockId}`),
  },

  tasks: {
    list: (userId: number, date?: string) =>
      get<RawOneTimeTask[]>(
        `/users/${userId}/tasks${date ? `?date=${date}` : ""}`
      ),
    create: (userId: number, data: Partial<RawOneTimeTask>) =>
      post<RawOneTimeTask>(`/users/${userId}/tasks`, data),
    update: (taskId: number, data: Partial<RawOneTimeTask>) =>
      put<RawOneTimeTask>(`/tasks/${taskId}`, data),
    delete: (taskId: number) => del<void>(`/tasks/${taskId}`),
  },

  schedule: {
    today: (userId: number) =>
      get<RawScheduleResponse>(`/users/${userId}/schedule/today`),
    get: (userId: number, date: string) =>
      get<RawScheduleResponse>(`/users/${userId}/schedule?date=${date}`),
    generate: (userId: number, date: string, forceRegenerate = false) =>
      post<RawScheduleResponse>(`/users/${userId}/schedule/generate`, {
        date,
        force_regenerate: forceRegenerate,
      }),
    updateBlockStatus: (
      blockId: number,
      data: {
        status: string;
        actual_start?: string;
        actual_end?: string;
        missed_reason?: string;
        time_saved_minutes?: number;
        actual_duration_minutes?: number;
        completed_fraction?: number;
        no_recovery_needed?: boolean;
      }
    ) => post<RawBlockStatusResponse>(`/schedule/blocks/${blockId}/status`, data),
  },

  sleep: {
    start: (userId: number, data: { actual_sleep_time: string; date?: string }) =>
      post<RawSleepLog>(`/users/${userId}/sleep/start`, data),
    wake: (userId: number, data: { actual_wake_time: string; date?: string }) =>
      post<Record<string, unknown>>(`/users/${userId}/sleep/wake`, data),
    get: (userId: number, date?: string) =>
      get<RawSleepLog>(
        `/users/${userId}/sleep${date ? `?date=${date}` : ""}`
      ),
    napStart: (userId: number, data: { start_time: string; date?: string; note?: string }) =>
      post<RawPowerNap>(`/users/${userId}/naps/start`, data),
    napEnd: (napId: number, data: { end_time: string }) =>
      post<RawPowerNap>(`/naps/${napId}/end`, data),
    listNaps: (userId: number, date?: string) =>
      get<RawPowerNap[]>(
        `/users/${userId}/naps${date ? `?date=${date}` : ""}`
      ),
  },

  debt: {
    summary: (userId: number) => get<RawDebtSummary>(`/users/${userId}/debt`),
    applyRecovery: (debtId: number, minutes: number) =>
      post<RawRoutineDebt>(`/debt/${debtId}/apply-recovery`, {
        minutes_recovered: minutes,
      }),
  },

  recovery: {
    list: (userId: number) =>
      get<RawRecoveryPlanResponse>(`/users/${userId}/recovery`),
    generate: (userId: number, mode: "light" | "balanced" | "aggressive") =>
      post<RawRecoveryPlanResponse>(`/users/${userId}/recovery/generate`, {
        mode,
      }),
    updateBlockStatus: (blockId: number, status: string) =>
      post<RawRecoveryBlock>(`/recovery/blocks/${blockId}/status`, { status }),
  },

  review: {
    get: (userId: number, date?: string) =>
      get<RawReviewSummary>(
        `/users/${userId}/review${date ? `?date=${date}` : ""}`
      ),
    generate: (userId: number, date?: string) =>
      post<RawReviewSummary>(
        `/users/${userId}/review/daily${date ? `?date=${date}` : ""}`
      ),
  },
};
