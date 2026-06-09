/**
 * Local notification scheduling for Routine Recovery.
 *
 * Schedules 10-min-before reminders for every *pending* schedule block.
 * Called each time the daily schedule is (re)loaded in today.tsx.
 *
 * NOTE: Push notifications (FCM/APNs) require a development build from SDK 53+.
 * This file handles local notifications only, which work in Expo Go.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { RawScheduleBlock } from './api';

// ── Notification handler (call once inside a React component, not at module level) ─

export function initNotificationHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // expo-notifications may be unavailable in some Expo Go environments — non-fatal
  }
}

// ── Android notification channel ──────────────────────────────────────────────

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('routine-reminders', {
      name: 'Routine Reminders',
      description: 'Reminders before each scheduled block starts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#12D27B',
    });
  } catch {
    // Channel setup may fail in Expo Go — non-fatal
  }
}

// ── Permission request ────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    await ensureAndroidChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ── Scheduling ────────────────────────────────────────────────────────────────

/**
 * Cancel all pending notifications, then re-schedule a reminder for every
 * *pending* block that hasn't started yet.
 */
export async function scheduleBlockNotifications(
  blocks: RawScheduleBlock[],
  reminderMins = 10,
): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const now = new Date();

    for (const block of blocks) {
      if (block.status !== 'pending') continue;

      const startTime = new Date(block.planned_start);
      const notifyAt = new Date(startTime.getTime() - reminderMins * 60_000);

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
  } catch {
    // Non-fatal — notifications unavailable in this environment
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Non-fatal
  }
}
