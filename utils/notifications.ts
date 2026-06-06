/**
 * Local notification scheduling for Routine Recovery.
 *
 * Schedules 10-min-before reminders for every *pending* schedule block.
 * Called each time the daily schedule is (re)loaded in today.tsx.
 *
 * Push tokens / server-side delivery are a Phase 9 follow-up once
 * FCM credentials are wired in. This file handles client-side local
 * notifications which work out-of-the-box in Expo Go.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { RawScheduleBlock } from './api';

// ── Foreground notification behaviour ─────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // Required in newer Expo SDK versions
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Android notification channel ──────────────────────────────────────────────

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('routine-reminders', {
    name: 'Routine Reminders',
    description: 'Reminders before each scheduled block starts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#12D27B',
  });
}

// ── Permission request ────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Scheduling ────────────────────────────────────────────────────────────────

/**
 * Cancel all pending notifications, then re-schedule a reminder for every
 * *pending* block that hasn't started yet.
 *
 * @param blocks        Raw schedule blocks from the backend.
 * @param reminderMins  Minutes before block start to fire the notification (default 10).
 */
export async function scheduleBlockNotifications(
  blocks: RawScheduleBlock[],
  reminderMins = 10,
): Promise<void> {
  // Wipe stale notifications from a previous schedule generation
  await Notifications.cancelAllScheduledNotificationsAsync();

  const granted = await requestNotificationPermissions();
  if (!granted) return; // User hasn't given permission — silently skip

  const now = new Date();

  for (const block of blocks) {
    if (block.status !== 'pending') continue;

    const startTime = new Date(block.planned_start);
    const notifyAt = new Date(startTime.getTime() - reminderMins * 60_000);

    // Skip if the notification time is already in the past
    if (notifyAt <= now) continue;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ Starting in ${reminderMins} min`,
          body: block.title,
          data: { blockId: String(block.id) },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notifyAt,
        },
      });
    } catch {
      // Non-fatal — skip this block and continue
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
