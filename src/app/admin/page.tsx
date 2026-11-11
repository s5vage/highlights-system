'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Day {
  day: string;
  users: number;
}
interface Stats {
  users_total: number;
  users_7d: number;
  active_today: number;
  active_7d: number;
  active_30d: number;
  daily: Day[];
  signups: Day[];
  totals: { notes: number; highlights: number; books: number; book_bytes: number };
  users: { email: string | null; joined: string; last_seen: string | null; notes: number; highlights: number; books: number; bytes: number }[];
}

const bytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`);
const dayLabel = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--hairline)' }}>
      <div className="text-[12.5px] font-medium" style={{ color: 'var(--text-dim)' }}>
        {label}
      </div>
      <div className="tnum mt-1.5 text-[30px] font-semibold leading-none tracking-[-0.02em]">{value}</div>
      {hint && (
        <div className="mt-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// The last 30 days as bars, with days nobody opened the app shown as zero.
function Bars({ data }: { data: Day[] }) {
  const days = useMemo(() => {
    const map = new Map(data.map((d) => [d.day, d.users]));
    const out: Day[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key, users: map.get(key) ?? 0 });
    }
    return out;
  }, [data]);
  const max = Math.max(1, ...days.map((d) => d.users));
  const W = 720,
    H = 150,
    gap = 4,
    bw = (W - gap * 29) / 30;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label="People who opened the app each day, last 30 days">
        {days.map((d, i) => {
          const h = Math.max(d.users ? 4 : 2, (d.users / max) * H);
          return (
            <g key={d.day}>
              <title>{`${dayLabel(d.day)}: ${d.users} ${d.users === 1 ? 'person' : 'people'}`}</title>
              <rect x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={3} fill={d.users ? 'var(--accent)' : 'var(--fill-strong)'} />
            </g>
          );
        })}
        <text x={0} y={H + 17} fontSize="11" fill="var(--text-faint)">
          {dayLabel(days[0].day)}
        </text>
        <text x={W} y={H + 17} fontSize="11" fill="var(--text-faint)" textAnchor="end">
          Today
        </text>
      </svg>
      <figcaption className="mt-1 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        People who opened the app each day (busiest day: {max})
      </figcaption>
    </figure>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');

  useEffect(() => {
    Promise.resolve(supabase.rpc('admin_stats')).then(
      ({ data, error }) => {
        if (error) setState(/not allowed|permission|42501/i.test(`${error.code} ${error.message}`) ? 'denied' : 'error');
        else {
          setStats(data as Stats);
          setState('ready');
        }
      },
      () => setState('error')
    );
  }, []);

  return (
    <main className="mx-auto min-h-dvh max-w-[980px] px-6 py-10" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <a href="/" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium" style={{ color: 'var(--text-dim)' }}>
        <ArrowLeft size={15} strokeWidth={2} /> Back to the app
      </a>
      <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.022em]">Usage</h1>
      <p className="mt-1 text-[14.5px]" style={{ color: 'var(--text-dim)' }}>
        How many people use the app. Only counts and dates, never anyone’s writing.
      </p>

      {state === 'loading' && <p className="mt-10 text-[14px]" style={{ color: 'var(--text-faint)' }}>Loading…</p>}
      {state === 'denied' && (
        <p className="mt-10 rounded-2xl p-5 text-[14.5px]" style={{ background: 'var(--surface)' }}>
          This page is only for the person who runs the app.
        </p>
      )}
      {state === 'error' && (
        <p className="mt-10 rounded-2xl p-5 text-[14.5px]" style={{ background: 'var(--surface)' }}>
          Couldn’t load the numbers. Make sure Step 1 of the accounts SQL has been run, then reload.
        </p>
      )}

      {state === 'ready' && stats && (
        <>
          <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Summary">
            <Card label="Accounts" value={stats.users_total} hint={`${stats.users_7d} joined this week`} />
            <Card label="Opened today" value={stats.active_today} />
            <Card label="Last 7 days" value={stats.active_7d} hint="people who opened it" />
            <Card label="Last 30 days" value={stats.active_30d} hint="people who opened it" />
            <Card label="Books stored" value={stats.totals.books} hint={bytes(stats.totals.book_bytes)} />
          </section>

          <section className="mt-6 rounded-2xl p-5" style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--hairline)' }}>
            <Bars data={stats.daily} />
          </section>

          <section className="mt-6 overflow-x-auto rounded-2xl" style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--hairline)' }}>
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead>
                <tr style={{ color: 'var(--text-faint)' }} className="text-[12px]">
                  {['Person', 'Joined', 'Last seen', 'Notes', 'Highlights', 'Books', 'Storage'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 font-medium ${i > 2 ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.users.map((u) => (
                  <tr key={u.email ?? u.joined} style={{ borderTop: '1px solid var(--hairline)' }}>
                    <td className="px-4 py-3 font-medium">{u.email}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-dim)' }}>
                      {dayLabel(u.joined.slice(0, 10))}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-dim)' }}>
                      {u.last_seen ? dayLabel(u.last_seen) : 'Not yet'}
                    </td>
                    <td className="tnum px-4 py-3 text-right">{u.notes}</td>
                    <td className="tnum px-4 py-3 text-right">{u.highlights}</td>
                    <td className="tnum px-4 py-3 text-right">{u.books}</td>
                    <td className="tnum px-4 py-3 text-right">{bytes(u.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}