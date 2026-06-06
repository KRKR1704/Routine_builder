export function formatTime(hhmm: string): string {
  const parts = hhmm.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function getDurationMinutes(startHHMM: string, endHHMM: string): number {
  const sParts = startHHMM.split(':');
  const eParts = endHHMM.split(':');
  const sh = parseInt(sParts[0] ?? '0', 10);
  const sm = parseInt(sParts[1] ?? '0', 10);
  const eh = parseInt(eParts[0] ?? '0', 10);
  const em = parseInt(eParts[1] ?? '0', 10);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getTodayString(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getTimeRangeLabel(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ── Schedule block helpers ────────────────────────────────────────────────────

import type { ScheduleBlock, ScheduleStatus } from '../types/schedule';

export function getProgressPct(blocks: ScheduleBlock[]): number {
  const relevant = blocks.filter((b) => b.priority !== 'low');
  if (relevant.length === 0) return 0;
  const done = relevant.filter(
    (b) =>
      b.status === 'completed' ||
      b.status === 'completed_early' ||
      b.status === 'partially_completed',
  ).length;
  return Math.round((done / relevant.length) * 100);
}

export function countByStatus(blocks: ScheduleBlock[], status: ScheduleStatus): number {
  return blocks.filter((b) => b.status === status).length;
}
