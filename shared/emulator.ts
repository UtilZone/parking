/**
 * Firebase Emulator Setup — Local Development Only
 *
 * HOW TO USE:
 * 1. Start emulators:  firebase emulators:start
 * 2. In apps/attendant/src/config/firebase.ts, uncomment the emulator block
 *    and set LOCAL_IP to your machine's LAN IP (not localhost when on a real device).
 *
 * Find your LAN IP:
 *   Windows: ipconfig  →  look for IPv4 Address under your Wi-Fi adapter
 *   Mac/Linux: ifconfig | grep 'inet '  OR  ip addr show
 *
 * Common ports (matches firebase.json emulators config):
 *   Auth:      9099
 *   Firestore: 8080
 *   Functions: 5001
 *   Storage:   9199
 *   Hosting:   5000
 *   UI:        4000  (open http://localhost:4000 to view emulator dashboard)
 *
 * Seed data:
 *   After starting emulators, import seed data with:
 *   firebase emulators:start --import ./emulator-data
 *
 * Export emulator state for reuse:
 *   firebase emulators:export ./emulator-data
 */

export const EMULATOR_CONFIG = {
  AUTH_PORT:      9099,
  FIRESTORE_PORT: 8080,
  FUNCTIONS_PORT: 5001,
  STORAGE_PORT:   9199,
};
