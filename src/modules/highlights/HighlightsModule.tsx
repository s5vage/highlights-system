'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react';
import {
  DatabaseZap,
  Download,
  Hash,
  Highlighter,
  Library,
  Pin,
  Search,
  SearchX,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useHighlights } from './useHighlights';
import HighlightCard from './HighlightCard';
import HighlightModal from './HighlightModal';
import SegmentedControl from '@/components/SegmentedControl';
import Masonry from '@/components/Masonry';
import { exportMarkdown } from './helpers';
import { Highlight } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';

type SortMode = 'new' | 'old' | 'len';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'new', label: 'Newest' },
  { value: 'old', label: 'Oldest' },
  { value: 'len', label: 'Longest' },
];

const PIN_STORAGE_KEY = 'hl_pinned_ids';

interface Props {
  pendingId?: string | null;
  onConsumedPending?: () => void;
}

function SideRow({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button type="button" onClick={onClick} data-active={active} className="side-row">
      {active && (
        <motion.span
          layoutId="hl-side-pill"
          className="side-pill"
          transition={{ type: 'spring', stiffness: 520, damping: 40 }}
        />
      )}
      <span className="relative flex min-w-0 items-center gap-2.5">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="side-count tnum relative">{count}</span>
    </button>
  );
}

function StateMessage({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center px-6 py-24 text-center">
      <div className="max-w-xs">
        <span
          className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl"
          style={{ background: 'var(--fill)', color: 'var(--text-dim)' }}
        >
          {icon}
        </span>
        <div className="text-[16px] font-semibold tracking-[-0.012em]">{title}</div>
        <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {body}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export default function HighlightsModule({ pendingId, onConsumedPending }: Props = {}) {
  const { highlights, loading, error, reload, deleteHighlight } = useHighlights();

  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [selected, setSelected] = useState<Highlight | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [intro, setIntro] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (raw) {
      try {
        setPinnedIds(JSON.parse(raw));
      } catch {
        setPinnedIds([]);
      }
    }
  }, []);

  // The staggered entrance only plays once, right after the first load.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => setIntro(false), 1200);
    return () => clearTimeout(t);
  }, [loading]);

  // Press "/" anywhere to jump to search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function togglePin(id: string) {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev];
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const tagCounts = useMemo(() => {
    const map: Record<string, number> = {};
    highlights.forEach((h) => (h.tags || []).forEach((t) => (map[t] = (map[t] || 0) + 1)));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [highlights]);

  const filtered = useMemo(() => {
    let items = [...highlights];
    if (showPinnedOnly) items = items.filter((h) => pinnedIds.includes(h.id));
    if (activeTag) items = items.filter((h) => (h.tags || []).includes(activeTag));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (h) =>
          (h.text || '').toLowerCase().includes(q) ||
          (h.tags || []).some((t) => t.toLowerCase().includes(q.replace('#', '')))
      );
    }
    if (sortMode === 'old') {
      items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortMode === 'len') {
      items.sort((a, b) => (b.text || '').length - (a.text || '').length);
    } else {
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    items.sort((a, b) => (pinnedIds.includes(b.id) ? 1 : 0) - (pinnedIds.includes(a.id) ? 1 : 0));
    return items;
  }, [highlights, showPinnedOnly, activeTag, search, sortMode, pinnedIds]);

  useEffect(() => {
    if (!pendingId) return;
    const match = highlights.find((h) => h.id === pendingId);
    if (match) {
      setSelected(match);
      onConsumedPending?.();
    }
  }, [pendingId, highlights, onConsumedPending]);

  const weekCount = useMemo(
    () => highlights.filter((h) => Date.now() - new Date(h.created_at).getTime() < 604800000).length,
    [highlights]
  );

  function showAll() {
    setActiveTag(null);
    setShowPinnedOnly(false);
  }
  function showPinned() {
    setShowPinnedOnly(true);
    setActiveTag(null);
  }
  function showTag(tag: string) {
    setActiveTag(tag);
    setShowPinnedOnly(false);
  }

  if (!isSupabaseConfigured) {
    return (
      <div style={{ background: 'var(--bg)' }} className="h-full">
        <StateMessage
          icon={<DatabaseZap size={22} strokeWidth={1.8} />}
          title="Database not connected"
          body="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file, then restart the dev server."
        />
      </div>
    );
  }

  if (error && highlights.length === 0) {
    return (
      <div style={{ background: 'var(--bg)' }} className="h-full">
        <StateMessage
          icon={<TriangleAlert size={22} strokeWidth={1.8} />}
          title="Couldn’t load your highlights"
          body={error}
          action={
                        <button type="button" className="btn btn-primary" onClick={() => reload()}>
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const filtering = !!search.trim() || !!activeTag || showPinnedOnly;
  const summary =
    `${highlights.length.toLocaleString()} ${highlights.length === 1 ? 'highlight' : 'highlights'} ` +
    `across ${tagCounts.length} ${tagCounts.length === 1 ? 'tag' : 'tags'}` +
    (weekCount > 0 ? `, ${weekCount} added this week.` : '.');

  const chipStyle = (on: boolean): React.CSSProperties =>
    on
      ? { background: 'var(--text)', color: 'var(--bg)' }
      : { background: 'var(--fill)', color: 'var(--text-dim)' };

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full" style={{ background: 'var(--bg)' }}>
        {/* Sidebar */}
        <aside className="hl-side hidden w-[244px] shrink-0 flex-col overflow-y-auto p-3 md:flex">
          <LayoutGroup id="hl-side">
            <div className="side-title">Library</div>
            <SideRow
              active={!activeTag && !showPinnedOnly}
              onClick={showAll}
              icon={<Library size={15} strokeWidth={1.9} />}
              label="All highlights"
              count={highlights.length}
            />
            <SideRow
              active={showPinnedOnly}
              onClick={showPinned}
              icon={<Pin size={15} strokeWidth={1.9} />}
              label="Pinned"
              count={pinnedIds.length}
            />

            {tagCounts.length > 0 && <div className="side-title">Tags</div>}
            {tagCounts.map(([tag, count]) => (
              <SideRow
                key={tag}
                active={activeTag === tag}
                onClick={() => showTag(tag)}
                icon={<Hash size={15} strokeWidth={1.9} />}
                label={tag}
                count={count}
              />
            ))}
          </LayoutGroup>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1760px]">
            <div className="flex items-end justify-between gap-4 px-5 pb-5 pt-8 md:px-8 md:pt-10">
              <div className="min-w-0">
                <h1 className="text-[30px] font-semibold leading-9 tracking-[-0.022em]">Highlights</h1>
                {!loading && (
                  <p className="mt-1 text-[14.5px]" style={{ color: 'var(--text-dim)' }}>
                    {summary}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn shrink-0"
                onClick={() => exportMarkdown(filtered)}
                title="Export the current view as Markdown"
                disabled={loading || filtered.length === 0}
              >
                <Download size={15} strokeWidth={2} />
                Export
              </button>
            </div>
          </div>

          {/* Sticky toolbar */}
          <div className="hl-bar sticky top-0 z-10">
            <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-3 px-5 py-3 md:px-8">
              <div className="search min-w-[220px] max-w-[460px] flex-1" onClick={() => searchRef.current?.focus()}>
                <Search size={16} strokeWidth={2} style={{ color: 'var(--text-faint)' }} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search highlights and tags"
                  aria-label="Search highlights"
                />
                {search ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                    className="grid h-5 w-5 place-items-center rounded-full"
                    style={{ background: 'var(--fill-strong)', color: 'var(--text-dim)' }}
                  >
                    <X size={12} strokeWidth={2.4} />
                  </button>
                ) : (
                  <span className="kbd hidden md:inline">/</span>
                )}
              </div>
              <div className="w-full md:ml-auto md:w-auto">
                <SegmentedControl label="Sort highlights" options={SORT_OPTIONS} value={sortMode} onChange={setSortMode} />
              </div>
            </div>

            {/* Phones: tags move from the sidebar into a scrolling row */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3 md:hidden">
              <button type="button" className="chip !px-3.5 !py-1.5 !text-[13px] shrink-0" style={chipStyle(!activeTag && !showPinnedOnly)} onClick={showAll}>
                All
              </button>
              <button type="button" className="chip !px-3.5 !py-1.5 !text-[13px] shrink-0" style={chipStyle(showPinnedOnly)} onClick={showPinned}>
                Pinned
              </button>
              {tagCounts.map(([tag]) => (
                <button
                  key={tag}
                  type="button"
                  className="chip !px-3.5 !py-1.5 !text-[13px] shrink-0"
                  style={chipStyle(activeTag === tag)}
                  onClick={() => showTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-[1760px] px-5 pb-24 pt-5 md:px-8">
            {loading ? (
              <div className="hl-grid" aria-busy="true" aria-label="Loading highlights">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 150 + (i % 3) * 22 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <StateMessage
                icon={filtering ? <SearchX size={22} strokeWidth={1.8} /> : <Highlighter size={22} strokeWidth={1.8} />}
                title={filtering ? 'No highlights match' : 'No highlights yet'}
                body={
                  filtering
                    ? 'Try a different word, or clear the filter to see everything.'
                    : 'Select text on any web page with the extension and it will show up here.'
                }
                action={
                  filtering ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setSearch('');
                        showAll();
                      }}
                    >
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {filtering && (
                  <p className="mb-3 text-[13px] tnum" style={{ color: 'var(--text-faint)' }}>
                    {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
                    {activeTag ? ` in ${activeTag}` : ''}
                  </p>
                )}
                <Masonry>
                  {filtered.map((h, i) => (
                    <HighlightCard
                      key={h.id}
                      highlight={h}
                      pinned={pinnedIds.includes(h.id)}
                      index={i}
                      animateIn={intro}
                      onClick={() => setSelected(h)}
                    />
                  ))}
                </Masonry>
              </>
            )}
          </div>
        </main>

        <AnimatePresence>
          {selected && (
            <HighlightModal
              key={selected.id}
              highlight={selected}
              pinned={pinnedIds.includes(selected.id)}
              onClose={() => setSelected(null)}
              onTogglePin={() => togglePin(selected.id)}
              onDelete={() => deleteHighlight(selected.id)}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}