/**
 * API configuration.
 *
 * For local development with Expo Go on a physical device:
 *   Replace "localhost" with your machine's LAN IP (e.g. 192.168.1.100).
 *
 * For production, set this to your deployed Fly.io / Render / Railway URL.
 */

// Change to your machine's LAN IP when running on a physical device
const DEV_HOST = "172.16.8.43";

// Swap this for your localtunnel / ngrok URL when testing on a physical device
// e.g. "https://clean-fish-42.loca.lt/api/v1"
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://tusk-envelope-straggler.ngrok-free.dev/api/v1";
