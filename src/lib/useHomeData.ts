'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export interface HL {
  id: string;
  text: string;
  tags: string[] | null;
  color: string | null;
  url: string | null;
  created_at: string;
}
export interface NoteLite {
  id: string;
  title: string;
  search_text: string | null;
  updated_at: string;
  is_journal: boolean;
  journal_date: string | null;
}
export interface BookLite {
  id: string;
  title: string;
  author: string | null;
  cover_path: string | null;
  page_count: number | null;
  last_page: number | null;
  last_opened_at: string | null;
  created_at: string;
}
export interface HomeData {
  counts: { highlights: number; books: number; notes: number };
  week: { highlights: number; notes: number };
  highlights: HL[];
  notes: NoteLite[];
  books: BookLite[];
  recentlyRead: boolean; // true: books opened lately; false: just the newest ones
  covers: Record<string, string>;
  review: HL | null; // one older highlight, a different one each day
  reviewPool: number;
}

const DAY = 864e5;

export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Res<T> = { data: T | null; count: number | null; error: unknown };
const run = <T,>(q: unknown) => Promise.resolve(q as PromiseLike<Res<T>>).then(
  (r) => r,
  () => ({ data: null, count: null, error: true }) as Res<T>
);

const HL_COLS = 'id,text,tags,color,url,created_at';
const BOOK_COLS = 'id,title,author,cover_path,page_count,last_page,last_opened_at,created_at';

// The same highlight all day, a different one tomorrow. "Show another" steps to the next.
async function pickReview(uid: string, offset: number): Promise<{ item: HL | null; pool: number }> {
  const before = new Date(Date.now() - 7 * DAY).toISOString();
  const { count } = await run<unknown>(supabase.from('highlights').select('id', { count: 'exact', head: true }).lt('created_at', before));
  const pool = count ?? 0;
  if (!pool) return { item: null, pool: 0 };
  const idx = (hash(`${uid}:${localDay()}`) + offset) % pool;
  const { data } = await run<HL[]>(supabase.from('highlights').select(HL_COLS).lt('created_at', before).order('created_at').order('id').range(idx, idx));
  return { item: data && data[0] ? data[0] : null, pool };
}

async function load(uid: string): Promise<HomeData> {
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const head = { count: 'exact' as const, head: true };
  const [hlCount, bookCount, noteCount, weekHl, weekNotes, hls, notes, books] = await Promise.all([
    run<unknown>(supabase.from('highlights').select('id', head)),
    run<unknown>(supabase.from('books').select('id', head)),
    run<unknown>(supabase.from('notes').select('id', head).eq('is_journal', false)),
    run<unknown>(supabase.from('highlights').select('id', head).gte('created_at', weekAgo)),
    run<unknown>(supabase.from('notes').select('id', head).eq('is_journal', false).gte('updated_at', weekAgo)),
    run<HL[]>(supabase.from('highlights').select(HL_COLS).order('created_at', { ascending: false }).limit(5)),
    run<NoteLite[]>(supabase.from('notes').select('id,title,search_text,updated_at,is_journal,journal_date').order('updated_at', { ascending: false }).limit(5)),
    run<BookLite[]>(supabase.from('books').select(BOOK_COLS).order('last_opened_at', { ascending: false, nullsFirst: false }).limit(12)),
  ]);

  // Everything failed (offline, signed out): say so, rather than showing "No books yet".
  if (hlCount.error && bookCount.error && noteCount.error && hls.error && notes.error && books.error) throw new Error('offline');

  const twoWeeksAgo = Date.now() - 14 * DAY;
  let shelf = (books.data ?? []).filter((b) => b.last_opened_at && Date.parse(b.last_opened_at) > twoWeeksAgo).slice(0, 6);
  let recentlyRead = shelf.length > 0;
  if (!recentlyRead && (bookCount.count ?? 0) > 0) {
    const newest = await run<BookLite[]>(supabase.from('books').select(BOOK_COLS).order('created_at', { ascending: false }).limit(6));
    shelf = newest.data ?? [];
  }

  const covers: Record<string, string> = {};
  const paths = shelf.map((b) => b.cover_path).filter((p): p is string => !!p);
  if (paths.length) {
    const { data } = await Promise.resolve(supabase.storage.from('books').createSignedUrls(paths, 3600)).catch(() => ({ data: null }));
    (data ?? []).forEach((s) => s.path && s.signedUrl && (covers[s.path] = s.signedUrl));
  }
  const review = await pickReview(uid, 0);

  return {
    counts: { highlights: hlCount.count ?? 0, books: bookCount.count ?? 0, notes: noteCount.count ?? 0 },
    week: { highlights: weekHl.count ?? 0, notes: weekNotes.count ?? 0 },
    highlights: hls.data ?? [],
    notes: notes.data ?? [],
    books: shelf,
    recentlyRead,
    covers,
    review: review.item,
    reviewPool: review.pool,
  };
}

const cache = new Map<string, HomeData>(); // so switching back to Home shows something instantly

export function useHomeData() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [data, setData] = useState<HomeData | null>(uid ? cache.get(uid) ?? null : null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    setData(cache.get(uid) ?? null);
    setStep(0);
    load(uid).then(
      (d) => {
        cache.set(uid, d);
        if (alive) setData(d);
      },
      () => alive && setFailed(true)
    );
    return () => {
      alive = false;
    };
  }, [uid]);

  const another = useCallback(async () => {
    if (!uid || !data) return;
    const next = step + 1;
    const r = await pickReview(uid, next);
    if (r.item) {
      setStep(next);
      setData((d) => (d ? { ...d, review: r.item, reviewPool: r.pool } : d));
    }
  }, [uid, data, step]);

  return { data, failed, another };
}

// ── small helpers the Home screen uses ──

export function firstName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string | null {
  const m = user?.user_metadata ?? {};
  const raw = (m.name ?? m.full_name ?? m.first_name) as string | undefined;
  if (raw && raw.trim()) return raw.trim().split(/\s+/)[0];
  const local = (user?.email ?? '').split('@')[0];
  if (/[._-]/.test(local)) {
    const t = local.split(/[._-]/)[0].replace(/\d+/g, '');
    if (t.length > 1) return t[0].toUpperCase() + t.slice(1).toLowerCase();
  }
  return null; // e.g. "wilsondorsainvil6": better to ask than to guess
}

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 60) return `${Math.floor(d / 7)} wk ago`;
  if (d < 365) return `${Math.floor(d / 30)} mo ago`;
  return `${Math.floor(d / 365)} yr ago`;
}

export function firstLine(text: string | null | undefined, max = 110): string {
  const line = (text ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return line.length > max ? line.slice(0, max - 1).trimEnd() + '…' : line;
}