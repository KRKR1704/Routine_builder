/**
 * Transforms raw backend responses (snake_case, integer IDs) into the
 * frontend's camelCase shape (string IDs).
 *
 * This is the single boundary layer — all components import from types/,
 * all API calls use utils/api.ts, and only this file bridges the two.
 */

import type {
  RawDebtSummary,
  RawOneTimeTask,
  RawPowerNap,
  RawRecoveryBlock,
  RawReviewSummary,
  RawRoutineBlock,
  RawRoutineDebt,
  RawScheduleBlock,
  RawSleepLog,
  RawUserPreferences,
} from "./api";

import type { Priority, RoutineBlock } from "../types/routine";
import type { DailyReview, MissedBlockReason } from "../types/review";
import type { ScheduleBlock, ScheduleStatus, SourceType } from "../types/schedule";
import type { PowerNap, SleepLog, NapImpactLevel } from "../types/sleep";
import type { RecoveryDebt, RecoveryBlock, RecoveryBlockStatus } from "../types/recovery";

// ── Routine blocks ────────────────────────────────────────────────────────────

export function toRoutineBlock(raw: RawRoutineBlock): RoutineBlock {
  return {
    id: String(raw.id),
    title: raw.title,
    startTime: raw.start_time,
    endTime: raw.end_time,
    priority: raw.priority as Priority,
    isFixed: raw.is_fixed,
    canShift: raw.can_shift,
    canCompress: raw.can_compress,
    canSkip: raw.can_skip,
    recoverIfMissed: raw.recover_if_missed,
    reminderOffsetMinutes: raw.reminder_offset_minutes,
  };
}

export function toRoutineBlocks(raws: RawRoutineBlock[]): RoutineBlock[] {
  return raws.map(toRoutineBlock);
}

// ── Schedule blocks ───────────────────────────────────────────────────────────

export function toScheduleBlock(raw: RawScheduleBlock): ScheduleBlock {
  return {
    id: String(raw.id),
    title: raw.title,
    plannedStart: raw.planned_start,
    plannedEnd: raw.planned_end,
    status: raw.status as ScheduleStatus,
    priority: raw.priority as Priority,
    recoverIfMissed: raw.recover_if_missed,
    sourceType: raw.source_type as SourceType,
  };
}

export function toScheduleBlocks(raws: RawScheduleBlock[]): ScheduleBlock[] {
  return raws.map(toScheduleBlock);
}

// ── One-time tasks ────────────────────────────────────────────────────────────

export interface FrontendTask {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  timingType: string;
  priority: Priority;
  notes: string | null;
  isCompleted: boolean;
}

export function toTask(raw: RawOneTimeTask): FrontendTask {
  return {
    id: String(raw.id),
    title: raw.title,
    date: raw.date,
    durationMinutes: raw.duration_minutes,
    timingType: raw.timing_type,
    priority: raw.priority as Priority,
    notes: raw.notes,
    isCompleted: raw.is_completed,
  };
}

export function toTasks(raws: RawOneTimeTask[]): FrontendTask[] {
  return raws.map(toTask);
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

export function toSleepLog(raw: RawSleepLog): SleepLog {
  return {
    plannedSleepTime: raw.planned_sleep_time,
    plannedWakeTime: raw.planned_wake_time,
    actualSleepTime: raw.actual_sleep_time ?? undefined,
    actualWakeTime: raw.actual_wake_time ?? undefined,
    sleepDurationMinutes: raw.sleep_duration_minutes ?? undefined,
    wakeDelayMinutes: raw.wake_delay_minutes ?? undefined,
  };
}

export function toPowerNap(raw: RawPowerNap): PowerNap {
  return {
    id: String(raw.id),
    startTime: raw.start_time,
    endTime: raw.end_time ?? undefined,
    durationMinutes: raw.duration_minutes ?? undefined,
    note: raw.note ?? undefined,
    impactLevel: raw.impact_level as NapImpactLevel,
  };
}

export function toPowerNaps(raws: RawPowerNap[]): PowerNap[] {
  return raws.map(toPowerNap);
}

// ── Debt ──────────────────────────────────────────────────────────────────────

export function toRecoveryDebt(raw: RawRoutineDebt): RecoveryDebt {
  return {
    id: String(raw.id),
    category: raw.category,
    minutesOwed: raw.minutes_owed,
    minutesRecovered: raw.minutes_recovered,
    status: raw.status as RecoveryDebt["status"],
  };
}

export interface FrontendDebtSummary {
  totalMinutesOwed: number;
  totalMinutesRecovered: number;
  netMinutes: number;
  byCategory: Record<string, number>;
  debts: RecoveryDebt[];
}

export function toDebtSummary(raw: RawDebtSummary): FrontendDebtSummary {
  return {
    totalMinutesOwed: raw.total_minutes_owed,
    totalMinutesRecovered: raw.total_minutes_recovered,
    netMinutes: raw.net_minutes,
    byCategory: raw.by_category,
    debts: raw.debts.map(toRecoveryDebt),
  };
}

// ── Recovery blocks ───────────────────────────────────────────────────────────

export function toRecoveryBlock(raw: RawRecoveryBlock): RecoveryBlock {
  // plannedStart and plannedEnd are ISO datetime strings, e.g. "2026-05-27T14:00:00"
  const start = raw.planned_start;
  const end = raw.planned_end;
  const day = start.split("T")[0];

  // Duration in minutes
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const durationMinutes = Math.round((endMs - startMs) / 60000);

  return {
    id: String(raw.id),
    debtId: String(raw.debt_id),
    title: `Recovery Block`,
    sourceDebt: String(raw.debt_id),
    plannedStart: start,
    plannedEnd: end,
    durationMinutes,
    status: raw.status as RecoveryBlockStatus,
    day,
  };
}

export function toRecoveryBlocks(raws: RawRecoveryBlock[]): RecoveryBlock[] {
  return raws.map(toRecoveryBlock);
}

// ── User preferences ──────────────────────────────────────────────────────────

export interface FrontendPreferences {
  plannedWakeTime: string;
  plannedSleepTime: string;
  minSleepMinutes: number;
  notificationPreference: string;
  recoveryModeDefault: string;
  bufferMinutes: number;
  maxRecoveryMinutesPerDay: number;
}

export function toPreferences(raw: RawUserPreferences): FrontendPreferences {
  return {
    plannedWakeTime: raw.planned_wake_time,
    plannedSleepTime: raw.planned_sleep_time,
    minSleepMinutes: raw.min_sleep_minutes,
    notificationPreference: raw.notification_preference,
    recoveryModeDefault: raw.recovery_mode_default,
    bufferMinutes: raw.buffer_minutes,
    maxRecoveryMinutesPerDay: raw.max_recovery_minutes_per_day,
  };
}

// ── Daily Review ──────────────────────────────────────────────────────────────

export function toReview(raw: RawReviewSummary): DailyReview {
  const sleepSummary = raw.sleep_summary
    ? (() => {
        const s = raw.sleep_summary as Record<string, string | number | null>;
        const actualSleep = s.actual_sleep as string | null;
        const actualWake = s.actual_wake as string | null;
        const wakeDelay = s.wake_delay_minutes as number | null;
        let text = "";
        if (actualSleep) text += `Slept ${actualSleep}`;
        if (actualWake) text += `${actualSleep ? " → " : ""}Woke ${actualWake}`;
        if (wakeDelay && wakeDelay > 0)
          text += `. Wake delay: ${Math.floor(wakeDelay / 60)}h ${wakeDelay % 60}m`;
        return text || "No sleep data";
      })()
    : "No sleep data";

  const missedBlocks: MissedBlockReason[] = (raw.missed_blocks ?? []).map(
    (b) => ({
      blockId: String(b.id),
      blockTitle: b.title,
      reason: b.reason ?? "",
    })
  );

  return {
    date: raw.date,
    completionRate: Math.round(raw.completion_rate * 100),
    completedCount: raw.completed_count,
    missedCount: raw.missed_count,
    delayedCount: raw.delayed_count,
    debtAddedMinutes: raw.debt_added_minutes,
    debtClearedMinutes: raw.debt_cleared_minutes,
    sleepSummary,
    missedBlocks,
  };
}

export function fromPreferences(
  prefs: Partial<FrontendPreferences>
): Partial<RawUserPreferences> {
  const out: Partial<RawUserPreferences> = {};
  if (prefs.plannedWakeTime !== undefined)
    out.planned_wake_time = prefs.plannedWakeTime;
  if (prefs.plannedSleepTime !== undefined)
    out.planned_sleep_time = prefs.plannedSleepTime;
  if (prefs.minSleepMinutes !== undefined)
    out.min_sleep_minutes = prefs.minSleepMinutes;
  if (prefs.notificationPreference !== undefined)
    out.notification_preference = prefs.notificationPreference;
  if (prefs.recoveryModeDefault !== undefined)
    out.recovery_mode_default = prefs.recoveryModeDefault;
  if (prefs.bufferMinutes !== undefined)
    out.buffer_minutes = prefs.bufferMinutes;
  if (prefs.maxRecoveryMinutesPerDay !== undefined)
    out.max_recovery_minutes_per_day = prefs.maxRecoveryMinutesPerDay;
  return out;
}
