'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FilePlus2, NotebookPen, Search } from 'lucide-react';
import { MODULES } from '@/lib/modules';
import { ModuleId } from '@/lib/types';
import { NOT_ON_HOME, usePrefs, visibleTiles } from '@/lib/prefs';
import { useAuth } from '@/lib/auth';
import { BookLite, HL, NoteLite, ago, firstLine, firstName, useHomeData } from '@/lib/useHomeData';

interface Props {
  onOpenModule: (id: ModuleId, focusId?: string) => void;
  onOpenSearch: () => void;
}

// ── look: one accent (primary button, progress, focus), neutral everything else ──
const RING = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';
const HOVER = 'transition-colors hover:bg-[var(--fill)]';
const LINE = { borderColor: 'var(--hairline)' } as const;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const host = (u: string | null) => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
};

function greeting(hour: number) {
  return hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 22 ? 'Good evening' : 'Working late';
}

// One real sentence about the person's week.
function statLine(d: ReturnType<typeof useHomeData>['data']): string {
  if (!d) return '';
  if (d.week.highlights > 0) return `You saved ${plural(d.week.highlights, 'highlight')} this week.`;
  if (d.week.notes > 0) return `You worked on ${plural(d.week.notes, 'note')} this week.`;
  if (d.counts.highlights + d.counts.books + d.counts.notes === 0) return 'Nothing saved yet. Start with a note, a book, or a clip.';
  const last = d.notes[0] ? ` You last edited a note ${ago(d.notes[0].updated_at)}.` : '';
  return `Nothing new this week.${last}`;
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-faint)' }}>
        {eyebrow}
      </div>
      <h2 className="mb-3 mt-0.5 text-[14px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Skel({ className }: { className: string }) {
  return <div className={`hm-skel ${className}`} aria-hidden />;
}

function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-dashed px-4 py-4" style={{ borderColor: 'var(--border)' }}>
      <div className="text-[13.5px] font-medium">{title}</div>
      <div className="mt-0.5 text-[13px]" style={{ color: 'var(--text-dim)' }}>
        {body}
      </div>
      {action}
    </div>
  );
}

const textAction = `mt-2.5 rounded text-[13px] font-medium underline underline-offset-2 ${RING}`;

function Cover({ book, url }: { book: BookLite; url?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
  ) : (
    <div className="grid h-full w-full place-items-center p-2 text-center text-[11px] leading-snug" style={{ background: 'var(--fill)', color: 'var(--text-faint)' }}>
      {book.title.slice(0, 40)}
    </div>
  );
}

export default function DashboardHome({ onOpenModule, onOpenSearch }: Props) {
  const { user } = useAuth();
  const { prefs } = usePrefs();
  const { data, failed, another } = useHomeData();
  const [mod, setMod] = useState('Ctrl');
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setMod('⌘');
  }, []);

  // The spaces you chose, in the order you chose, in Settings → Home screen. (Settings and Trash live in the account menu.)
  const links = useMemo(() => visibleTiles(MODULES, prefs).filter((m) => !NOT_ON_HOME.includes(m.id)), [prefs]);
  const name = firstName(user);
  const hello = `${greeting(new Date().getHours())}${name ? `, ${name}` : ''}`;

  function newNote() {
    try {
      sessionStorage.setItem('notes_intent', 'new');
    } catch {
      /* ignore */
    }
    onOpenModule('notes');
  }
  function journal() {
    try {
      sessionStorage.setItem('notes_intent', 'journal');
    } catch {
      /* ignore */
    }
    onOpenModule('notes');
  }
  // Opens the Library, then presses its own "Add books" button (still inside the click, as far as the browser is concerned).
  function addBook() {
    onOpenModule('library');
    const find = () => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Add books');
    const go = (n: number) => {
      const el = find();
      if (el) el.click();
      else if (n > 0) setTimeout(() => go(n - 1), 120);
    };
    setTimeout(() => go(20), 150);
  }
  function openBook(id: string) {
    try {
      sessionStorage.setItem('lib_open_book', id);
    } catch {
      /* ignore */
    }
    onOpenModule('library');
    setTimeout(() => window.dispatchEvent(new Event('lib-open-book')), 150);
  }

  // Keyboard: N, J and B work while Home is showing and you aren't typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) || t?.isContentEditable) return;
      if (e.key === 'n') {
        e.preventDefault();
        newNote();
      } else if (e.key === 'j') {
        e.preventDefault();
        journal();
      } else if (e.key === 'b') {
        e.preventDefault();
        addBook();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[880px] px-6 pb-16 pt-10">
        <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em]" suppressHydrationWarning>
          {hello}
        </h1>
        <p className="mt-1 min-h-5 text-[14px]" style={{ color: 'var(--text-dim)' }} suppressHydrationWarning>
          {statLine(data)}
          {data && !name && (
            <>
              {' '}
              <button type="button" className={`rounded underline underline-offset-2 ${RING}`} onClick={() => onOpenModule('settings')}>
                Add your name
              </button>{' '}
              and I’ll use it here.
            </>
          )}
        </p>

        <button
          type="button"
          data-search-button
          onClick={onOpenSearch}
          className={`mt-6 flex h-11 w-full items-center gap-3 rounded-[10px] border px-3.5 text-left text-[14px] transition-colors hover:border-[var(--border)] ${RING}`}
          style={{ ...LINE, background: 'var(--surface)', color: 'var(--text-faint)' }}
        >
          <Search size={16} strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate">Search notes, highlights, and books</span>
          <kbd className="hm-kbd">{mod} K</kbd>
        </button>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={newNote} className={`flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13.5px] font-semibold transition hover:brightness-110 ${RING}`} style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            <NotebookPen size={15} strokeWidth={1.75} /> New note <kbd className="hm-kbd hm-kbd-on-accent">N</kbd>
          </button>
          <button type="button" onClick={addBook} className={`flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13.5px] font-medium ${HOVER} ${RING}`} style={LINE}>
            <FilePlus2 size={15} strokeWidth={1.75} /> Add book <kbd className="hm-kbd">B</kbd>
          </button>
          <button type="button" onClick={journal} className={`flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13.5px] font-medium ${HOVER} ${RING}`} style={LINE}>
            <CalendarDays size={15} strokeWidth={1.75} /> Today&rsquo;s journal <kbd className="hm-kbd">J</kbd>
          </button>
        </div>

        <nav className="mt-4 flex flex-wrap items-center gap-0.5" aria-label="Spaces">
          {links.map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.id} type="button" data-link={m.id} onClick={() => onOpenModule(m.id)} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] ${HOVER} ${RING}`} style={{ color: 'var(--text-dim)' }}>
                <Icon size={14} strokeWidth={1.75} /> {m.label}
              </button>
            );
          })}
          <span className="flex-1" />
          <button type="button" onClick={() => onOpenModule('settings')} className={`flex h-8 items-center rounded-lg px-2.5 text-[13px] ${HOVER} ${RING}`} style={{ color: 'var(--text-faint)' }}>
            Customize
          </button>
        </nav>

        {failed && (
          <p className="mt-8 text-[13px]" style={{ color: 'var(--text-dim)' }}>
            Couldn’t load your recent work. Check your connection and reload.
          </p>
        )}

        {!data && !failed && (
          <div aria-busy="true" aria-label="Loading your work">
            <Section eyebrow="Library" title="Continue reading">
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i}>
                    <Skel className="aspect-[2/3] rounded-lg" />
                    <Skel className="mt-2 h-3 w-4/5" />
                  </div>
                ))}
              </div>
            </Section>
            <div className="grid gap-x-8 md:grid-cols-2">
              {[0, 1].map((c) => (
                <Section key={c} eyebrow={c ? 'Notes' : 'Highlights'} title={c ? 'Recent notes' : 'Recent highlights'}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="border-t py-3" style={LINE}>
                      <Skel className="h-3.5 w-full" />
                      <Skel className="mt-2 h-3 w-1/3" />
                    </div>
                  ))}
                </Section>
              ))}
            </div>
          </div>
        )}

        {data && (
          <>
            <Section eyebrow="Library" title={data.recentlyRead ? 'Continue reading' : 'Start reading'}>
              {data.books.length === 0 ? (
                <Empty
                  title="No books yet"
                  body="Add a PDF and your place in it is saved automatically."
                  action={
                    <button type="button" onClick={addBook} className={textAction}>
                      Add your first book
                    </button>
                  }
                />
              ) : (
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                  {data.books.map((b) => {
                    const pct = b.page_count && b.last_page && b.last_page > 1 ? Math.min(100, Math.round((b.last_page / b.page_count) * 100)) : 0;
                    return (
                      <button key={b.id} type="button" data-book={b.id} title={b.title} onClick={() => openBook(b.id)} className={`group self-start rounded-lg text-left ${RING}`}>
                        <div className="aspect-[2/3] overflow-hidden rounded-lg border transition-colors group-hover:border-[var(--border)]" style={LINE}>
                          <Cover book={b} url={b.cover_path ? data.covers[b.cover_path] : undefined} />
                        </div>
                        {pct > 0 && (
                          <div className="mt-2 h-[3px] rounded-full" style={{ background: 'var(--fill-strong)' }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                          </div>
                        )}
                        <div className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug">{b.title}</div>
                        {pct > 0 && (
                          <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                            {pct}%
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>

            <div className="grid gap-x-8 md:grid-cols-2">
              <Section eyebrow="Highlights" title="Recent highlights">
                {data.highlights.length === 0 ? (
                  <Empty title="No highlights yet" body="Select text on any web page with the clipper, or inside a book, and it appears here." />
                ) : (
                  <ul>
                    {data.highlights.map((h: HL) => (
                      <li key={h.id} className="border-t" style={LINE}>
                        <button type="button" data-highlight={h.id} onClick={() => onOpenModule('highlights', h.id)} className={`-mx-2 block w-[calc(100%+16px)] rounded-lg px-2 py-2.5 text-left ${HOVER} ${RING}`}>
                          <div className="line-clamp-2 text-[13.5px] leading-snug">{h.text}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]" style={{ color: 'var(--text-faint)' }}>
                            {(h.tags ?? []).slice(0, 3).map((t) => (
                              <span key={t}>#{t}</span>
                            ))}
                            {host(h.url) && <span>{host(h.url)}</span>}
                            <span>{ago(h.created_at)}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section eyebrow="Notes" title="Recent notes">
                {data.notes.length === 0 ? (
                  <Empty
                    title="No notes yet"
                    body="Start with anything: a thought, a plan, a to-do."
                    action={
                      <button type="button" onClick={newNote} className={textAction}>
                        Write a note
                      </button>
                    }
                  />
                ) : (
                  <ul>
                    {data.notes.map((n: NoteLite) => (
                      <li key={n.id} className="border-t" style={LINE}>
                        <button type="button" data-note={n.id} onClick={() => onOpenModule('notes', n.id)} className={`-mx-2 block w-[calc(100%+16px)] rounded-lg px-2 py-2.5 text-left ${HOVER} ${RING}`}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-[13.5px] font-medium">{n.is_journal ? `Journal ${n.journal_date ?? ''}` : n.title || 'Untitled'}</span>
                            <span className="shrink-0 text-[12px]" style={{ color: 'var(--text-faint)' }}>
                              {ago(n.updated_at)}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--text-dim)' }}>
                            {firstLine(n.search_text) || 'Empty note'}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            <Section eyebrow="Daily review" title="From your library">
              {data.review ? (
                <figure className="rounded-[10px] border px-4 py-3.5" style={LINE} data-review={data.review.id}>
                  <blockquote className="line-clamp-6 border-l-2 pl-3 text-[15px] leading-relaxed" style={{ borderColor: 'var(--border)' }}>
                    {data.review.text}
                  </blockquote>
                  <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                    <span>Saved {ago(data.review.created_at)}</span>
                    {(data.review.tags ?? []).slice(0, 3).map((t) => (
                      <span key={t}>#{t}</span>
                    ))}
                    <span className="flex-1" />
                    {data.reviewPool > 1 && (
                      <button type="button" onClick={another} className={`rounded px-1 ${HOVER} ${RING}`} style={{ color: 'var(--text-dim)' }}>
                        Show another
                      </button>
                    )}
                    <button type="button" onClick={() => onOpenModule('highlights', data.review!.id)} className={`rounded px-1 ${HOVER} ${RING}`} style={{ color: 'var(--text-dim)' }}>
                      Open
                    </button>
                  </figcaption>
                </figure>
              ) : (
                <Empty title="Nothing to look back on yet" body="Once you have highlights older than a week, one comes back here each day." />
              )}
            </Section>

            <p className="mt-10 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
              {plural(data.counts.highlights, 'highlight')} · {plural(data.counts.books, 'book')} · {plural(data.counts.notes, 'note')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}