/**
 * Buyer auth context (Task #52).
 *
 * Wraps the app so any screen can:
 *   • Read `user` to know if someone is signed in.
 *   • Call `signIn(token, user)` after a successful OTP verify.
 *   • Call `signOut()` to clear the JWT + cached user.
 *
 * On mount we hydrate from cache, then in the background refresh against
 * /api/buyer/auth/me (validates token still good; updates display name) and
 * trigger a favorites sync. The 401 listener wired through `apiRequest`
 * tears the session down automatically if the token expires server-side
 * mid-session.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearBuyerToken,
  getCachedBuyerUser,
  setBuyerToken,
  setCachedBuyerUser,
  type BuyerUserCache,
} from '../storage/auth';
import { onApiUnauthorized } from '../api/client';
import { buyerAuthApi, type BuyerUser } from '../api/buyerAuth';
import { syncFavorites, clearLocalFavorites } from '../storage/favorites';
import { syncSavedSearches } from '../storage/savedSearches';

interface AuthContextValue {
  user: BuyerUser | null;
  loading: boolean;
  signIn: (token: string, user: BuyerUser) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<BuyerUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from cache + validate against /me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getCachedBuyerUser();
      if (!cancelled && cached) setUser(cached);
      try {
        const me = await buyerAuthApi.me();
        if (cancelled) return;
        setUser(me.user);
        await setCachedBuyerUser({
          id: me.user.id,
          phone: me.user.phone,
          displayName: me.user.displayName ?? null,
        });
        // Opportunistic favorites + saved-search sync once token is good.
        syncFavorites().catch(() => {});
        syncSavedSearches().catch(() => {});
      } catch {
        // 401 → onApiUnauthorized handler below clears state. Other errors
        // (network) → keep cached user so the UI stays usable offline.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for cross-cutting 401s from the fetch wrapper.
  useEffect(() => {
    return onApiUnauthorized(() => {
      // Token rejected by server → treat as a forced sign-out so we never
      // leave another buyer's favorites on disk for the next sign-in.
      clearLocalFavorites().catch(() => {});
      setUser(null);
    });
  }, []);

  const signIn = useCallback(async (token: string, nextUser: BuyerUser) => {
    await setBuyerToken(token);
    const cache: BuyerUserCache = {
      id: nextUser.id,
      phone: nextUser.phone,
      displayName: nextUser.displayName ?? null,
    };
    await setCachedBuyerUser(cache);
    setUser(nextUser);
    // Merge any anonymous local favorites + device-scoped saved searches
    // into the buyer's account so they appear on every device.
    syncFavorites().catch(() => {});
    syncSavedSearches().catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
    try {
      await buyerAuthApi.logout();
    } catch {
      /* best-effort — token discard happens regardless */
    }
    await clearBuyerToken();
    // Clear local personal caches so the next buyer who signs in on this
    // device cannot inherit (or accidentally upload) the previous account's
    // data via the next syncFavorites() merge.
    await clearLocalFavorites();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await buyerAuthApi.me();
      setUser(me.user);
      await setCachedBuyerUser({
        id: me.user.id,
        phone: me.user.phone,
        displayName: me.user.displayName ?? null,
      });
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signOut, refresh }),
    [user, loading, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
