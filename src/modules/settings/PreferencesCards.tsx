'use client';

import { ChevronDown, ChevronUp, Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { MODULES } from '@/lib/modules';
import { ACCENTS, ACCENT_COLORS, ALWAYS_SHOWN, Accent, ThemePref, resolveTheme, sortTiles, usePrefs } from '@/lib/prefs';

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7" aria-label={title}>
      <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-faint)' }}>
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

function Row({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3.5" style={{ borderTop: '1px solid var(--hairline)' }}>
      <div className="min-w-[160px] flex-1">
        <div className="text-[14.5px] font-medium">{label}</div>
        {hint && (
          <div className="mt-0.5 text-[13px]" style={{ color: 'var(--text-dim)' }}>
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:opacity-50"
      style={{ background: on ? 'var(--accent)' : 'var(--fill-strong)' }}
    >
      <span className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 21 : 3 }} />
    </button>
  );
}

const THEME_OPTIONS: { id: ThemePref; label: string; Icon: typeof Sun }[] = [
  { id: 'system', label: 'System', Icon: Monitor },
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
];

export default function PreferencesCards() {
  const { prefs, setPrefs, resetHome, sync } = usePrefs();
  const resolved = typeof window !== 'undefined' ? resolveTheme(prefs.theme) : 'dark';
  const ordered = sortTiles(MODULES, prefs.tileOrder);

  function move(id: string, dir: -1 | 1) {
    const ids: string[] = ordered.map((m) => m.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setPrefs({ tileOrder: ids });
  }
  function setHidden(id: string, hidden: boolean) {
    setPrefs({ tileHidden: hidden ? [...prefs.tileHidden.filter((x) => x !== id), id] : prefs.tileHidden.filter((x) => x !== id) });
  }

  const status =
    sync === 'saving' ? 'Saving…' : sync === 'saved' ? 'Saved to your account' : sync === 'local' ? 'Saved on this device (account saving isn’t set up yet)' : '';

  return (
    <>
      <Card title="Appearance">
        <Row label="Theme" hint="System follows your computer’s light or dark setting.">
          <div className="flex rounded-xl p-1" style={{ background: 'var(--fill)' }} role="radiogroup" aria-label="Theme">
            {THEME_OPTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={prefs.theme === id}
                data-theme-option={id}
                onClick={() => setPrefs({ theme: id })}
                className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold"
                style={prefs.theme === id ? { background: 'var(--seg-thumb, var(--fill-strong))', color: 'var(--text)' } : { color: 'var(--text-dim)' }}
              >
                <Icon size={14} strokeWidth={2} /> {label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Accent colour" hint="Buttons, links, and highlights of the active item.">
          <div className="flex gap-2.5" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((a: Accent) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={prefs.accent === a}
                aria-label={a[0].toUpperCase() + a.slice(1)}
                title={a[0].toUpperCase() + a.slice(1)}
                data-accent-option={a}
                onClick={() => setPrefs({ accent: a })}
                className="h-8 w-8 rounded-full"
                style={{ background: ACCENT_COLORS[a][resolved], boxShadow: prefs.accent === a ? `0 0 0 2px var(--surface), 0 0 0 4px ${ACCENT_COLORS[a][resolved]}` : 'inset 0 0 0 1px rgb(0 0 0 / 0.15)' }}
              />
            ))}
          </div>
        </Row>
      </Card>

      <Card title="Home screen" hint="Choose what opens first, and which tiles show on Home.">
        <Row label="Open this first" hint="The tab you land on when you open the app.">
          <select
            aria-label="Open this first"
            value={prefs.startTab}
            onChange={(e) => setPrefs({ startTab: e.target.value })}
            className="h-9 rounded-lg px-3 text-[13.5px] font-semibold outline-none"
            style={{ background: 'var(--fill-strong)', color: 'var(--text)' }}
          >
            <option value="home">Home</option>
            {MODULES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Row>
        {ordered.map((m, i) => {
          const Icon = m.icon;
          const locked = ALWAYS_SHOWN.includes(m.id);
          const hidden = !locked && prefs.tileHidden.includes(m.id);
          return (
            <div key={m.id} data-tile-row={m.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: '1px solid var(--hairline)', opacity: hidden ? 0.55 : 1 }}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--fill)', color: 'var(--text-dim)' }}>
                <Icon size={16} strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1 text-[14.5px] font-medium">
                {m.label}
                {locked && (
                  <span className="ml-2 text-[12px] font-normal" style={{ color: 'var(--text-faint)' }}>
                    Always shown
                  </span>
                )}
              </span>
              <button type="button" className="tool" aria-label={`Move ${m.label} up`} disabled={i === 0} onClick={() => move(m.id, -1)}>
                <ChevronUp size={16} strokeWidth={2.2} />
              </button>
              <button type="button" className="tool" aria-label={`Move ${m.label} down`} disabled={i === ordered.length - 1} onClick={() => move(m.id, 1)}>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              <Switch on={!hidden} disabled={locked} label={`Show ${m.label} on Home`} onChange={(v) => setHidden(m.id, !v)} />
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--hairline)' }}>
          <span className="text-[12.5px]" style={{ color: 'var(--text-faint)' }} role="status">
            {status}
          </span>
          <button type="button" className="flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13.5px] font-semibold" style={{ background: 'var(--fill-strong)' }} onClick={resetHome}>
            <RotateCcw size={14} strokeWidth={2} /> Reset Home
          </button>
        </div>
      </Card>
    </>
  );
}