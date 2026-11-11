'use client';

import { useState } from 'react';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Highlights';

export function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match. Check them and try again.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first. Look for the link we sent you.';
  if (/already (been )?registered|already exists/i.test(message)) return 'There’s already an account with that email. Try signing in instead.';
  if (/database error saving new user/i.test(message)) return 'That email isn’t on the invite list yet. Ask the person who runs this app to add you.';
  if (/rate limit|too many|security purposes/i.test(message)) return 'Too many tries. Wait a minute and try again.';
  if (/failed to fetch|network|load failed/i.test(message)) return 'Can’t reach the server. Check your connection and try again.';
  if (/password/i.test(message) && /(least|short|weak)/i.test(message)) return 'Choose a longer password (at least 8 characters).';
  return message;
}

const field =
  'h-12 w-full rounded-xl px-3.5 text-[15px] outline-none transition-shadow placeholder:text-[var(--text-faint)] focus:shadow-[0_0_0_2px_var(--accent)]';

export default function LoginScreen({ mode: forced }: { mode?: 'reset' }) {
  const { finishRecovery } = useAuth();
  const [mode, setMode] = useState<Mode>(forced ?? 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<'signup' | 'forgot' | null>(null);

  function go(next: Mode) {
    setMode(next);
    setError(null);
    setSent(null);
    setPassword('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const mail = email.trim();
    if (mode !== 'reset' && !/^\S+@\S+\.\S+$/.test(mail)) return setError('Enter a valid email address.');
    if (mode !== 'forgot' && mode !== 'signin' && password.length < 8) return setError('Use at least 8 characters for your password.');
    if (mode === 'signin' && !password) return setError('Enter your password.');

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) setError(friendlyAuthError(error.message));
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { emailRedirectTo: window.location.origin } });
        if (error) setError(friendlyAuthError(error.message));
        else if (!data.session) setSent('signup'); // an email link has to be opened first
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: window.location.origin });
        if (error) setError(friendlyAuthError(error.message));
        else setSent('forgot');
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) setError(friendlyAuthError(error.message));
        else finishRecovery();
      }
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  }

  const title = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password', reset: 'Choose a new password' }[mode];
  const sub = {
    signin: `Sign in to ${APP_NAME}.`,
    signup: 'Your notes, highlights, and books stay private to you.',
    forgot: 'Enter your email and we’ll send you a link.',
    reset: 'Pick something you haven’t used before.',
  }[mode];

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl text-[17px] font-bold" style={{ background: 'var(--accent)', color: 'var(--bg)' }} aria-hidden>
            {APP_NAME.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-[19px] font-semibold tracking-[-0.015em]">{APP_NAME}</span>
        </div>

        <div className="rounded-[28px] p-7" style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--hairline), 0 30px 80px -40px rgb(0 0 0 / 0.6)' }}>
          {sent ? (
            <div className="text-center" role="status">
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl" style={{ background: 'var(--fill)', color: 'var(--accent)' }}>
                <MailCheck size={24} strokeWidth={1.8} />
              </span>
              <h1 className="text-[20px] font-semibold tracking-[-0.015em]">Check your email</h1>
              <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                {sent === 'signup'
                  ? `We sent a link to ${email.trim()}. Open it to finish creating your account, then come back and sign in.`
                  : `If ${email.trim()} has an account, a link to reset the password is on its way.`}
              </p>
              <button type="button" className="mt-6 h-11 w-full rounded-xl text-[14.5px] font-semibold" style={{ background: 'var(--fill-strong)' }} onClick={() => go('signin')}>
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h1 className="text-[21px] font-semibold tracking-[-0.018em]">{title}</h1>
              <p className="mt-1.5 text-[14px]" style={{ color: 'var(--text-dim)' }}>
                {sub}
              </p>

              <div className="mt-6 grid gap-3">
                {mode !== 'reset' && (
                  <label className="grid gap-1.5">
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-dim)' }}>
                      Email
                    </span>
                    <input
                      className={field}
                      style={{ background: 'var(--fill)', color: 'var(--text)' }}
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@school.edu"
                    />
                  </label>
                )}
                {mode !== 'forgot' && (
                  <label className="grid gap-1.5">
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-dim)' }}>
                      {mode === 'reset' ? 'New password' : 'Password'}
                    </span>
                    <span className="relative block">
                      <input
                        className={`${field} pr-11`}
                        style={{ background: 'var(--fill)', color: 'var(--text)' }}
                        type={show ? 'text' : 'password'}
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'signin' ? 'Your password' : 'At least 8 characters'}
                      />
                      <button
                        type="button"
                        className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg"
                        style={{ color: 'var(--text-faint)' }}
                        aria-label={show ? 'Hide password' : 'Show password'}
                        onClick={() => setShow((s) => !s)}
                      >
                        {show ? <EyeOff size={17} strokeWidth={1.9} /> : <Eye size={17} strokeWidth={1.9} />}
                      </button>
                    </span>
                  </label>
                )}
              </div>

              {error && (
                <p className="mt-3.5 rounded-xl px-3.5 py-2.5 text-[13.5px] leading-snug" role="alert" style={{ background: 'color-mix(in srgb, var(--hue-red, #e5655b) 14%, transparent)', color: 'var(--hue-red, #e5655b)' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-5 h-12 w-full rounded-xl text-[15px] font-semibold disabled:opacity-60"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                {busy ? 'One moment…' : { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', reset: 'Save new password' }[mode]}
              </button>

              {mode !== 'reset' && (
                <div className="mt-5 flex items-center justify-between text-[13.5px]" style={{ color: 'var(--text-dim)' }}>
                  {mode === 'signin' ? (
                    <>
                      <button type="button" className="font-medium hover:underline" onClick={() => go('forgot')}>
                        Forgot password?
                      </button>
                      <button type="button" className="font-semibold hover:underline" style={{ color: 'var(--accent)' }} onClick={() => go('signup')}>
                        Create an account
                      </button>
                    </>
                  ) : (
                    <button type="button" className="font-semibold hover:underline" style={{ color: 'var(--accent)' }} onClick={() => go('signin')}>
                      ← Back to sign in
                    </button>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}