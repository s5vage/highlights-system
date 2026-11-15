'use client';

import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// "Name" in Settings → Account. It's used in the greeting on Home and in the account menu.
export default function NameRow() {
  const { user } = useAuth();
  const current = ((user?.user_metadata?.name as string | undefined) ?? '').trim();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = value.trim().replace(/\s+/g, ' ').slice(0, 60);
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ data: { name } });
    setBusy(false);
    if (error) return setError('Couldn’t save your name. Try again.');
    setEditing(false);
  }

  return (
    <div className="px-4 py-3.5" style={{ borderTop: '1px solid var(--hairline)' }}>
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--fill)', color: 'var(--text-dim)' }}>
          <UserRound size={16} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-medium">Name</div>
          <div className="mt-0.5 break-words text-[13px]" style={{ color: 'var(--text-dim)' }}>
            {current || 'Used for the greeting on Home.'}
          </div>
        </div>
        <button
          type="button"
          className="h-9 shrink-0 rounded-lg px-3.5 text-[13.5px] font-semibold"
          style={{ background: 'var(--fill-strong)' }}
          onClick={() => {
            setValue(current);
            setEditing((v) => !v);
            setError(null);
          }}
        >
          {current ? 'Change' : 'Add'}
        </button>
      </div>
      {editing && (
        <form className="mt-3 flex gap-2.5" onSubmit={save} noValidate>
          <input
            className="h-11 min-w-0 flex-1 rounded-xl px-3.5 text-[14.5px] outline-none placeholder:text-[var(--text-faint)] focus:shadow-[0_0_0_2px_var(--accent)]"
            style={{ background: 'var(--fill)', color: 'var(--text)' }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your first name"
            aria-label="Your name"
            autoComplete="given-name"
            autoFocus
          />
          <button type="submit" disabled={busy} className="h-11 shrink-0 rounded-xl px-4 text-[14px] font-semibold disabled:opacity-60" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
      {error && (
        <p className="mt-3 text-[13.5px]" role="alert" style={{ color: 'var(--hue-red, #e5655b)' }}>
          {error}
        </p>
      )}
    </div>
  );
}