export interface SleepLog {
  plannedSleepTime: string;
  plannedWakeTime: string;
  actualSleepTime?: string;
  actualWakeTime?: string;
  sleepDurationMinutes?: number;
  wakeDelayMinutes?: number;
}

export type NapImpactLevel = 'none' | 'minor' | 'schedule_adjustment_suggested';

export interface PowerNap {
  id: string;
  /** HH:MM */
  startTime: string;
  /** HH:MM — undefined while nap is in progress */
  endTime?: string;
  durationMinutes?: number;
  note?: string;
  impactLevel: NapImpactLevel;
}
