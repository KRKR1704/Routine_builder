/**
 * API configuration.
 *
 * Production:  https://routine-recovery-api.fly.dev/api/v1  (Fly.io)
 * Local dev:   set EXPO_PUBLIC_API_URL in a .env.local file, e.g.
 *              EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api/v1
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://routine-recovery-api.fly.dev/api/v1";
