// Register an Expo push token with the SGS Land backend.
//
// Usage (from a hook in `_layout.tsx`):
//
//   const { permissionDenied, token } = await ensurePushRegistration();
//
// The function is safe to call repeatedly — it will short-circuit when the
// user has already opted out, when running in Expo Go (where push tokens are
// not supported on Android SDK 53+), or when no project id is available.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  getCachedPushPreference,
  getCachedPushToken,
  getDeviceId,
  getTokenRegisteredAt,
  setCachedPushPreference,
  setCachedPushToken,
} from '../storage/device';

// Re-post the device row at least every 24h even when the token hasn't
// changed. Guards against the cached token drifting from the backend (row
// cleared by DeviceNotRegistered cleanup, manual DB cleanup, etc.) and
// silently leaving the device unregistered.
const REGISTRATION_REFRESH_MS = 24 * 60 * 60 * 1000;
import { pushApi } from '../api/push';

export interface RegistrationResult {
  ok: boolean;
  token: string | null;
  reason?: 'no-device' | 'permission-denied' | 'opted-out' | 'no-project-id' | 'transport-error';
}

let inFlight: Promise<RegistrationResult> | null = null;

interface ExpoExtra {
  eas?: { projectId?: string };
}
interface ExpoConstantsLike {
  expoConfig?: { extra?: ExpoExtra; version?: string | null } | null;
  easConfig?: { projectId?: string };
}

function getProjectId(): string | undefined {
  const c = Constants as unknown as ExpoConstantsLike;
  return c.expoConfig?.extra?.eas?.projectId ?? c.easConfig?.projectId;
}

function getAppVersion(): string | null {
  const c = Constants as unknown as ExpoConstantsLike;
  return c.expoConfig?.version ?? null;
}

async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('matches', {
      name: 'Bất động sản mới',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {
    /* best-effort */
  }
}

export async function ensurePushRegistration(opts?: {
  forcePromptIfUndecided?: boolean;
}): Promise<RegistrationResult> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<RegistrationResult> => {
    try {
      // Push tokens require a real device; emulators will silently no-op.
      if (!Device.isDevice) {
        return { ok: false, token: null, reason: 'no-device' };
      }

      const cachedPref = await getCachedPushPreference();
      if (cachedPref === false) {
        return { ok: false, token: null, reason: 'opted-out' };
      }

      await configureAndroidChannel();

      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      const canAsk = existing.canAskAgain !== false;
      if (status !== 'granted' && (opts?.forcePromptIfUndecided || cachedPref === true) && canAsk) {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        return { ok: false, token: null, reason: 'permission-denied' };
      }

      const projectId = getProjectId();
      let tokenResp: Notifications.ExpoPushToken;
      try {
        tokenResp = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
      } catch (err: any) {
        // Common cause: missing projectId in dev (Expo Go on SDK 53+).
        if (!projectId) return { ok: false, token: null, reason: 'no-project-id' };
        throw err;
      }

      const token = tokenResp.data;
      const deviceId = await getDeviceId();

      // Send to backend if the token changed, we never registered, OR the
      // last successful registration is older than the refresh window. The
      // server upsert is idempotent so re-posting the same token is cheap
      // and self-heals any drift between local cache and the DB row.
      const cachedToken = await getCachedPushToken();
      const registeredAt = await getTokenRegisteredAt();
      const stale = !registeredAt || Date.now() - registeredAt > REGISTRATION_REFRESH_MS;
      if (token && (token !== cachedToken || stale)) {
        try {
          await pushApi.registerDevice({
            deviceId,
            expoPushToken: token,
            platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
            appVersion: getAppVersion(),
          });
          await setCachedPushToken(token);
        } catch {
          return { ok: false, token, reason: 'transport-error' };
        }
      }

      // Once we've successfully registered, lock in the cached preference
      // (defaults to enabled).
      if (cachedPref === null) await setCachedPushPreference(true);
      return { ok: true, token };
    } catch {
      return { ok: false, token: null, reason: 'transport-error' };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
