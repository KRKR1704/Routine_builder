export type DebtStatus = 'pending' | 'partial' | 'cleared';
export type RecoveryBlockStatus = 'scheduled' | 'completed' | 'skipped';
export type RecoveryMode = 'light' | 'balanced' | 'aggressive';

export interface RecoveryDebt {
  id: string;
  category: string;
  minutesOwed: number;
  minutesRecovered: number;
  status: DebtStatus;
}

export interface RecoveryBlock {
  id: string;
  debtId: string;
  title: string;
  sourceDebt: string;
  plannedStart: string;
  plannedEnd: string;
  durationMinutes: number;
  status: RecoveryBlockStatus;
  day: string;
}
