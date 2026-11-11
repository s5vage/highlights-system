'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { clearGraphCache } from '@/modules/graph/graphData';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  recovery: boolean; // true while someone is choosing a new password from an email link
  isAdmin: boolean;
  signOut: () => Promise<void>;
  finishRecovery: () => void;
}

const Ctx = createContext<AuthState | null>(null);

// A password-reset email link opens the app with "type=recovery" in the address. Supabase removes that
// from the address a moment later, so it is noted right away, when this file first loads.
const OPENED_FROM_RESET_LINK = typeof window !== 'undefined' && /(^|[#&?])type=recovery(&|$)/.test(window.location.hash + window.location.search);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recovery, setRecovery] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const lastUid = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (OPENED_FROM_RESET_LINK) setRecovery(true);
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      lastUid.current = data.session?.user.id ?? null;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      const uid = next?.user.id ?? null;
      // A different person on the same browser must never see the last person's data.
      if (event === 'SIGNED_OUT' || (lastUid.current && uid && uid !== lastUid.current)) {
        clearGraphCache();
        setIsAdmin(false);
      }
      lastUid.current = uid;
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Once per sign-in: note that this person opened the app today (no content, just the day),
  // and find out whether they can see the usage page.
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    const day = new Date().toISOString().slice(0, 10);
    Promise.resolve(supabase.from('app_events').upsert({ user_id: uid, event: 'open', day }, { onConflict: 'user_id,event,day', ignoreDuplicates: true })).catch(() => {});
    Promise.resolve(supabase.rpc('am_i_admin'))
      .then(({ data }) => setIsAdmin(data === true))
      .catch(() => {});
  }, [uid]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);
  const finishRecovery = useCallback(() => setRecovery(false), []);

  const value = useMemo<AuthState>(
    () => ({ session, user: session?.user ?? null, loading, recovery, isAdmin, signOut, finishRecovery }),
    [session, loading, recovery, isAdmin, signOut, finishRecovery]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}