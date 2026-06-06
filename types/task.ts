import { Priority } from './routine';
export type { Priority };

export type TimingType = 'fixed' | 'flexible';

export interface OneTimeTask {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  deadlineTime?: string;
  timingType: TimingType;
  fixedStartTime?: string;
  priority: Priority;
  canSplit: boolean;
  notes: string;
}
