import { Priority } from './routine';

export type ScheduleStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'completed_early'
  | 'partially_completed'
  | 'missed'
  | 'delayed'
  | 'skipped';

export type SourceType = 'routine' | 'one_time' | 'recovery';

export interface ScheduleBlock {
  id: string;
  title: string;
  plannedStart: string;
  plannedEnd: string;
  status: ScheduleStatus;
  priority: Priority;
  recoverIfMissed: boolean;
  sourceType: SourceType;
  /** Minutes saved vs planned duration — set when status is completed_early */
  savedMinutes?: number;
}
