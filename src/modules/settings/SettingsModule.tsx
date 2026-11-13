'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, FileDown, FileText, KeyRound, LogOut, Mail, MonitorSmartphone, ShieldAlert, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { friendlyAuthError } from '@/components/LoginScreen';
import { fetchQuota } from '@/modules/library/r2';
import { buildJson, buildMarkdown, download, fetchEverything } from './exportData';

const gb = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`);
const field =
  'h-11 w-full rounded-xl px-3.5 text-[14.5px] outline-none placeholder:text-[var(--text-faint)] focus:shadow-[0_0_0_2px_var(--accent)]';

function Card({ title, hint, danger, children }: { title: string; hint?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className="mt-7" aria-label={title}>
      <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.05em]" style={{ color: danger ? 'var(--hue-red, #e5655b)' : 'var(--text-faint)' }}>
        {title}
      </h2>
      {hint && (
        <p className="mt-1 px-1 text-[13px]" style={{ color: 'var(--text-faint)' }}>
          {hint}
        </p>
      )}
      <div className="mt-2.5 overflow-hidden rounded-2xl" style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--hairline)' }}>
        {children}
      </div>
    </section>
  );
}

function Row({ icon, label, hint, action, children }: { icon?: React.ReactNode; label: string; hint?: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5" style={{ borderTop: '1px solid var(--hairline)' }}>
      <div className="flex items-center gap-3">
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--fill)', color: 'var(--text-dim)' }}>
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-medium">{label}</div>
          {hint && (
            <div className="mt-0.5 break-words text-[13px]" style={{ color: 'var(--text-dim)' }}>
              {hint}
            </div>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Notice({ kind, children }: { kind: 'ok' | 'err'; children: React.ReactNode }) {
  const color = kind === 'ok' ? 'var(--hue-green, #4fb06d)' : 'var(--hue-red, #e5655b)';
  return (
    <p className="mt-3 rounded-xl px-3.5 py-2.5 text-[13.5px] leading-snug" role={kind === 'err' ? 'alert' : 'status'} style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
      {children}
    </p>
  );
}

const quiet = 'h-9 shrink-0 rounded-lg px-3.5 text-[13.5px] font-semibold';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { authorization: `Bearer ${data.session.access_token}` } : {};
}

function DeleteDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = typed.trim().toUpperCase() === 'DELETE';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function go() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (res.ok) {
        await supabase.auth.signOut({ scope: 'local' });
        return; // the sign-in screen takes over
      }
      const body = await res.json().catch(() => ({}));
      setError(
        body.error === 'owner'
          ? 'This is the owner account, so it can’t be deleted here.'
          : body.error === 'not_configured'
          ? 'Deleting accounts isn’t switched on yet. Ask the person who runs this app to delete yours.'
          : 'Something went wrong and nothing was deleted. Try again in a moment.'
      );
    } catch {
      setError('Can’t reach the server. Nothing was deleted.');
    }
    setBusy(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center p-5" style={{ background: 'rgb(0 0 0 / 0.55)' }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="del-title" className="w-full max-w-[440px] rounded-3xl p-6" style={{ background: 'var(--surface-hover, var(--surface))', color: 'var(--text)', boxShadow: '0 30px 80px -20px rgb(0 0 0 / 0.7), inset 0 0 0 1px var(--hairline)' }}>
        <div className="flex items-start justify-between gap-3">
          <h3 id="del-title" className="text-[19px] font-semibold tracking-[-0.015em]">
            Delete your account?
          </h3>
          <button type="button" className="tool" aria-label="Close" onClick={onClose} disabled={busy}>
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          This permanently deletes <b style={{ color: 'var(--text)' }}>{email}</b> and everything in it: your notes, highlights, books, and files. It can’t be undone. Download a copy of your data first if you might want it.
        </p>
        <label className="mt-5 grid gap-1.5">
          <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-dim)' }}>
            Type <b>DELETE</b> to confirm
          </span>
          <input className={field} style={{ background: 'var(--fill)', color: 'var(--text)' }} value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} autoFocus autoComplete="off" aria-label="Type DELETE to confirm" />
        </label>
        {error && <Notice kind="err">{error}</Notice>}
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" className={quiet} style={{ background: 'var(--fill-strong)' }} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={quiet} style={{ background: 'var(--hue-red, #e5655b)', color: '#fff', opacity: ready && !busy ? 1 : 0.4 }} disabled={!ready || busy} onClick={go}>
            {busy ? 'Deleting…' : 'Delete everything'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SettingsModule() {
  const { user, isAdmin, signOut } = useAuth();
  const email = user?.email ?? '';

  const [panel, setPanel] = useState<null | 'email' | 'password'>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');

  const [used, setUsed] = useState<number | null>(null);
  const [books, setBooks] = useState(0);
  const [limit, setLimit] = useState<number | null>(null);

  const [exporting, setExporting] = useState<null | 'json' | 'md'>(null);
  const [exportNote, setExportNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let total = 0;
      let count = 0;
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('books').select('size_bytes').range(from, from + 999);
        if (error) return;
        (data ?? []).forEach((r: { size_bytes: number | null }) => {
          total += r.size_bytes || 0;
          count++;
        });
        if (!data || data.length < 1000) break;
      }
      const q = await fetchQuota();
      if (alive) {
        setUsed(total);
        setBooks(count);
        setLimit(q);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function open(p: 'email' | 'password') {
    setPanel(panel === p ? null : p);
    setNote(null);
    setCurrent('');
    setNext('');
    setAgain('');
    setNewEmail('');
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    const mail = newEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setNote({ kind: 'err', text: 'Enter a valid email address.' });
    if (mail.toLowerCase() === email.toLowerCase()) return setNote({ kind: 'err', text: 'That’s already your email.' });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: mail }, { emailRedirectTo: window.location.origin });
    setBusy(false);
    if (error) return setNote({ kind: 'err', text: friendlyAuthError(error.message) });
    setNote({ kind: 'ok', text: `We sent a confirmation link to ${mail}. Your email changes once you open it.` });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return setNote({ kind: 'err', text: 'Enter your current password.' });
    if (next.length < 8) return setNote({ kind: 'err', text: 'Use at least 8 characters for the new password.' });
    if (next !== again) return setNote({ kind: 'err', text: 'The new passwords don’t match.' });
    if (next === current) return setNote({ kind: 'err', text: 'Choose a password you haven’t been using.' });
    setBusy(true);
    setNote(null);
    // Prove it's really you before changing anything.
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setBusy(false);
      return setNote({ kind: 'err', text: 'Your current password isn’t right.' });
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setBusy(false);
      return setNote({ kind: 'err', text: friendlyAuthError(error.message) });
    }
    await supabase.auth.signOut({ scope: 'others' }); // any other device has to sign in again
    setBusy(false);
    setCurrent('');
    setNext('');
    setAgain('');
    setNote({ kind: 'ok', text: 'Password changed. Your other devices were signed out.' });
  }

  async function exportAs(kind: 'json' | 'md') {
    setExporting(kind);
    setExportNote(null);
    try {
      const d = await fetchEverything();
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'json') download(`my-data-${stamp}.json`, 'application/json', buildJson(d, email));
      else download(`my-notes-and-highlights-${stamp}.md`, 'text/markdown', buildMarkdown(d, email));
      setExportNote({ kind: 'ok', text: `Downloaded ${d.notes.length} notes and ${d.highlights.length} highlights${kind === 'json' ? ` and the list of your ${d.books.length} books` : ''}.` });
    } catch (e) {
      setExportNote({ kind: 'err', text: e instanceof Error ? e.message : 'Couldn’t prepare your data. Try again.' });
    }
    setExporting(null);
  }

  const pct = used !== null && limit ? Math.min(100, (used / limit) * 100) : 0;
  const barColor = pct >= 95 ? 'var(--hue-red, #e5655b)' : pct >= 80 ? 'var(--hue-yellow, #e0b43a)' : 'var(--accent)';
  const since = user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto max-w-[720px] px-5 pb-24 pt-10 md:px-6">
        <h1 className="text-[32px] font-semibold tracking-[-0.025em]">Settings</h1>
        <p className="mt-1 text-[14.5px]" style={{ color: 'var(--text-dim)' }}>
          Your account, your storage, and your data.
        </p>

        <Card title="Account">
          <Row label="Email" hint={email} icon={<Mail size={16} strokeWidth={1.9} />} action={<button type="button" className={quiet} style={{ background: 'var(--fill-strong)' }} onClick={() => open('email')}>Change</button>}>
            {panel === 'email' && (
              <form className="mt-3 grid gap-2.5" onSubmit={changeEmail} noValidate>
                <input className={field} style={{ background: 'var(--fill)', color: 'var(--text)' }} type="email" placeholder="New email address" aria-label="New email address" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" />
                <button type="submit" disabled={busy} className="h-10 rounded-xl text-[14px] font-semibold disabled:opacity-60" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  {busy ? 'One moment…' : 'Send confirmation link'}
                </button>
                {note && <Notice kind={note.kind}>{note.text}</Notice>}
              </form>
            )}
          </Row>
          <Row label="Password" hint="Choose something you don’t use anywhere else." icon={<KeyRound size={16} strokeWidth={1.9} />} action={<button type="button" className={quiet} style={{ background: 'var(--fill-strong)' }} onClick={() => open('password')}>Change</button>}>
            {panel === 'password' && (
              <form className="mt-3 grid gap-2.5" onSubmit={changePassword} noValidate>
                <input className={field} style={{ background: 'var(--fill)', color: 'var(--text)' }} type="password" placeholder="Current password" aria-label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
                <input className={field} style={{ background: 'var(--fill)', color: 'var(--text)' }} type="password" placeholder="New password (at least 8 characters)" aria-label="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
                <input className={field} style={{ background: 'var(--fill)', color: 'var(--text)' }} type="password" placeholder="New password again" aria-label="New password again" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
                <button type="submit" disabled={busy} className="h-10 rounded-xl text-[14px] font-semibold disabled:opacity-60" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  {busy ? 'One moment…' : 'Change password'}
                </button>
                {note && <Notice kind={note.kind}>{note.text}</Notice>}
              </form>
            )}
          </Row>
          <Row label="Member since" hint={`${since}${isAdmin ? ' · Owner' : ''}`} icon={<ShieldAlert size={16} strokeWidth={1.9} />} />
          {isAdmin && (
            <Row label="Usage" hint="How many people use the app" icon={<BarChart3 size={16} strokeWidth={1.9} />} action={<a href="/admin" className={`${quiet} grid place-items-center`} style={{ background: 'var(--fill-strong)' }}>Open</a>} />
          )}
        </Card>

        <Card title="Storage">
          <div className="px-4 py-4" style={{ borderTop: '1px solid var(--hairline)' }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[14.5px] font-medium">Your books</span>
              <span className="tnum text-[13.5px]" style={{ color: 'var(--text-dim)' }}>
                {used === null ? 'Loading…' : `${gb(used)}${limit ? ` of ${gb(limit)}` : ''} · ${books} ${books === 1 ? 'book' : 'books'}`}
              </span>
            </div>
            <div className="progress mt-3 !h-[6px]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Storage used">
              <span style={{ width: `${used ? Math.max(pct, 1.5) : 0}%`, background: barColor }} />
            </div>
            <p className="mt-2.5 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
              Notes and highlights take almost no space. Books are the only thing that counts.
            </p>
          </div>
        </Card>

        <Card title="Your data" hint="Your work belongs to you. Download a copy any time.">
          <Row label="Everything, as a data file" hint="Notes, highlights, books list, collections (JSON)" icon={<FileDown size={16} strokeWidth={1.9} />} action={<button type="button" disabled={!!exporting} className={quiet} style={{ background: 'var(--fill-strong)' }} onClick={() => exportAs('json')}>{exporting === 'json' ? 'Preparing…' : 'Download'}</button>} />
          <Row label="Notes and highlights, to read" hint="One readable Markdown file you can open anywhere" icon={<FileText size={16} strokeWidth={1.9} />} action={<button type="button" disabled={!!exporting} className={quiet} style={{ background: 'var(--fill-strong)' }} onClick={() => exportAs('md')}>{exporting === 'md' ? 'Preparing…' : 'Download'}</button>}>
            {exportNote && <Notice kind={exportNote.kind}>{exportNote.text}</Notice>}
          </Row>
          <div className="px-4 pb-3.5 text-[12.5px]" style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--hairline)', paddingTop: 12 }}>
            The PDFs themselves aren’t in these files. They stay in your library, and you can download each one from there.
          </div>
        </Card>

        <Card title="Signing out">
          <Row label="Sign out" hint="On this device" icon={<LogOut size={16} strokeWidth={1.9} />} action={<button type="button" className={quiet} style={{ background: 'var(--fill-strong)' }} onClick={() => signOut()}>Sign out</button>} />
          <Row label="Sign out everywhere" hint="Every phone, tablet, and computer. You’ll sign in again here too." icon={<MonitorSmartphone size={16} strokeWidth={1.9} />} action={<button type="button" className={quiet} style={{ background: 'var(--fill-strong)' }} onClick={() => supabase.auth.signOut({ scope: 'global' })}>Sign out all</button>} />
        </Card>

        <Card title="Danger zone" danger>
          <Row
            label="Delete my account"
            hint={isAdmin ? 'This is the owner account, so it can’t be deleted here.' : 'Permanently removes your account and everything in it.'}
            icon={<Trash2 size={16} strokeWidth={1.9} />}
            action={
              <button type="button" disabled={isAdmin} className={quiet} style={{ background: 'color-mix(in srgb, var(--hue-red, #e5655b) 16%, transparent)', color: 'var(--hue-red, #e5655b)', opacity: isAdmin ? 0.4 : 1 }} onClick={() => setConfirmDelete(true)}>
                Delete…
              </button>
            }
          />
        </Card>
      </div>
      {confirmDelete && <DeleteDialog email={email} onClose={() => setConfirmDelete(false)} />}
    </div>
  );
}