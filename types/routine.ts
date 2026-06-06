export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface RoutineBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  priority: Priority;
  isFixed: boolean;
  canShift: boolean;
  canCompress: boolean;
  canSkip: boolean;
  recoverIfMissed: boolean;
  reminderOffsetMinutes: number;
}
