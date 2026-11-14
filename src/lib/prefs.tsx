'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export type ThemePref = 'system' | 'light' | 'dark';
export const THEMES: ThemePref[] = ['system', 'light', 'dark'];
export const ACCENTS = ['blue', 'purple', 'green', 'pink', 'orange'] as const;
export type Accent = (typeof ACCENTS)[number];

// What each accent looks like on a light and on a dark theme (globals.css uses the same colours).
export const ACCENT_COLORS: Record<Accent, { light: string; dark: string }> = {
  blue: { light: '#0071e3', dark: '#8b97ff' },
  purple: { light: '#7048e8', dark: '#b39dff' },
  green: { light: '#1f9d55', dark: '#62d394' },
  pink: { light: '#d6336c', dark: '#f58ec1' },
  orange: { light: '#d9480f', dark: '#ffa94d' },
};

export interface Prefs {
  theme: ThemePref;
  accent: Accent;
  startTab: string; // 'home' or a module id
  tileOrder: string[]; // module ids, in the order shown on Home
  tileHidden: string[]; // module ids hidden from Home
}

export const DEFAULT_PREFS: Prefs = { theme: 'system', accent: 'blue', startTab: 'home', tileOrder: [], tileHidden: [] };
// Settings can never be hidden, or there would be no way back to these switches.
export const ALWAYS_SHOWN = ['settings'];

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 50) : []);

// Whatever comes back from storage is checked, so a bad value can never break the app.
export function cleanPrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    theme: THEMES.includes(r.theme as ThemePref) ? (r.theme as ThemePref) : DEFAULT_PREFS.theme,
    accent: (ACCENTS as readonly string[]).includes(r.accent as string) ? (r.accent as Accent) : 'blue',
    startTab: typeof r.startTab === 'string' && r.startTab.length < 40 ? r.startTab : 'home',
    tileOrder: strings(r.tileOrder),
    tileHidden: strings(r.tileHidden).filter((id) => !ALWAYS_SHOWN.includes(id)),
  };
}

// Modules in the saved order; anything new (not in the saved order) goes at the end.
export function sortTiles<T extends { id: string }>(modules: T[], order: string[]): T[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const first = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  return [...first, ...modules.filter((m) => !order.includes(m.id))];
}

export function visibleTiles<T extends { id: string }>(modules: T[], prefs: Prefs): T[] {
  return sortTiles(modules, prefs.tileOrder).filter((m) => ALWAYS_SHOWN.includes(m.id) || !prefs.tileHidden.includes(m.id));
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

// Puts the look on the page. "hl_theme" keeps holding the resolved theme, so the page still paints
// correctly before any code runs, exactly as before.
export function applyAppearance(p: Pick<Prefs, 'theme' | 'accent'>) {
  const root = document.documentElement;
  const t = resolveTheme(p.theme);
  root.setAttribute('data-theme', t);
  if (p.accent === 'blue') root.removeAttribute('data-accent');
  else root.setAttribute('data-accent', p.accent);
  try {
    localStorage.setItem('hl_theme', t);
    localStorage.setItem('hl_theme_pref', p.theme);
    localStorage.setItem('hl_accent', p.accent);
  } catch {
    /* private mode: it just won't be remembered */
  }
  window.dispatchEvent(new Event('hl-theme-change'));
}

// What this device looked like before accounts remembered it.
function deviceLook(): Prefs {
  try {
    const pref = localStorage.getItem('hl_theme_pref') as ThemePref | null;
    const accent = localStorage.getItem('hl_accent');
    const old = localStorage.getItem('hl_theme');
    return cleanPrefs({ theme: pref && THEMES.includes(pref) ? pref : old === 'light' || old === 'dark' ? old : 'system', accent });
  } catch {
    return DEFAULT_PREFS;
  }
}

const cacheKey = (uid: string) => `hl_prefs_${uid}`;
function readCache(uid: string): Prefs | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? cleanPrefs(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

type Sync = 'idle' | 'saving' | 'saved' | 'local';
interface PrefsState {
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  resetHome: () => void;
  settled: boolean; // we know what the person chose, so the start tab can be opened
  sync: Sync;
}
const Ctx = createContext<PrefsState | null>(null);

export function usePrefs(): PrefsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs must be used inside <PrefsProvider>');
  return v;
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [settled, setSettled] = useState(false);
  const [sync, setSync] = useState<Sync>('idle');
  const prefsRef = useRef(prefs);
  const uidRef = useRef<string | null>(uid);
  uidRef.current = uid;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adopt = useCallback((p: Prefs) => {
    prefsRef.current = p;
    setPrefsState(p);
    applyAppearance(p);
  }, []);

  // Not signed in yet (the sign-in screen): look the way this device last looked.
  useEffect(() => {
    if (!uid) {
      setSettled(false);
      applyAppearance(deviceLook());
    }
  }, [uid]);

  // Signed in: show what this device remembers straight away, then fetch the account's copy.
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const cached = readCache(uid);
    adopt(cached ?? deviceLook());
    setSettled(!!cached);
    if (!isSupabaseConfigured) {
      setSettled(true);
      return;
    }
    Promise.resolve(supabase.from('user_settings').select('data').maybeSingle()).then(
      ({ data, error }) => {
        if (!alive) return;
        const remote = data && data.data && Object.keys(data.data).length ? cleanPrefs(data.data) : null;
        if (remote) {
          adopt(remote);
          try {
            localStorage.setItem(cacheKey(uid), JSON.stringify(remote));
          } catch {
            /* ignore */
          }
          setSync('saved');
        } else setSync(error ? 'local' : 'idle');
        setSettled(true);
      },
      () => {
        if (!alive) return;
        setSync('local');
        setSettled(true);
      }
    );
    return () => {
      alive = false;
    };
  }, [uid, adopt]);

  // "System" follows the computer: when it flips between light and dark, so does the app.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const on = () => {
      if (prefsRef.current.theme === 'system') applyAppearance(prefsRef.current);
    };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const push = useCallback(() => {
    const id = uidRef.current;
    if (!id || !isSupabaseConfigured) return;
    setSync('saving');
    Promise.resolve(supabase.from('user_settings').upsert({ user_id: id, data: prefsRef.current, updated_at: new Date().toISOString() })).then(
      ({ error }) => setSync(error ? 'local' : 'saved'),
      () => setSync('local')
    );
  }, []);

  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => {
      const next = cleanPrefs({ ...prefsRef.current, ...patch });
      prefsRef.current = next;
      setPrefsState(next);
      if (patch.theme !== undefined || patch.accent !== undefined) applyAppearance(next);
      const id = uidRef.current;
      if (id) {
        try {
          localStorage.setItem(cacheKey(id), JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(push, 700); // one save after a burst of changes
    },
    [push]
  );

  const resetHome = useCallback(() => setPrefs({ startTab: 'home', tileOrder: [], tileHidden: [] }), [setPrefs]);

  const value = useMemo(() => ({ prefs, setPrefs, resetHome, settled, sync }), [prefs, setPrefs, resetHome, settled, sync]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}