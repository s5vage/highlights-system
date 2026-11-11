import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export interface Authed {
  user: User;
  db: SupabaseClient; // acts as this person, so the database's own rules apply to everything it does
}

// Works out who is calling from the sign-in token the browser sends, by asking Supabase.
export async function authenticate(req: Request): Promise<Authed | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const header = req.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  const db = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, db };
}

const MB = 1024 * 1024;

// How much storage this person may use, and how much they have used.
export async function quotaFor(db: SupabaseClient): Promise<{ limit: number; used: number; admin: boolean }> {
  const admin = await Promise.resolve(db.rpc('am_i_admin')).then(({ data }) => data === true).catch(() => false);
  const userMb = Number(process.env.USER_QUOTA_MB) || 1000;
  const adminMb = Number(process.env.ADMIN_QUOTA_MB) || 9000;

  let used = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('books').select('size_bytes').range(from, from + 999);
    if (error) break;
    used += (data ?? []).reduce((sum, r: { size_bytes: number | null }) => sum + (r.size_bytes || 0), 0);
    if (!data || data.length < 1000) break;
  }
  return { limit: (admin ? adminMb : userMb) * MB, used, admin };
}