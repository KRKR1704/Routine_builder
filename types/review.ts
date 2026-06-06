export interface MissedBlockReason {
  blockId: string;
  blockTitle: string;
  reason: string;
}

export interface DailyReview {
  date: string;
  completionRate: number;
  completedCount: number;
  missedCount: number;
  delayedCount: number;
  debtAddedMinutes: number;
  debtClearedMinutes: number;
  sleepSummary: string;
  missedBlocks: MissedBlockReason[];
}
