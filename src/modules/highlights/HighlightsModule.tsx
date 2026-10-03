'use client';

import { useEffect, useMemo, useState } from 'react';
import { useHighlights } from './useHighlights';
import HighlightCard from './HighlightCard';
import HighlightModal from './HighlightModal';
import { exportMarkdown } from './helpers';
import { Highlight } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';

type SortMode = 'new' | 'old' | 'len';

const PIN_STORAGE_KEY = 'hl_pinned_ids';

export default function HighlightsModule() {
  const { highlights, loading, error, deleteHighlight } = useHighlights();

  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [selected, setSelected] = useState<Highlight | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

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

  const weekCount = useMemo(
    () => highlights.filter((h) => Date.now() - new Date(h.created_at).getTime() < 604800000).length,
    [highlights]
  );

  if (!isSupabaseConfigured) {
    return (
      <div className="h-full flex items-center justify-center text-center px-6">
        <div className="max-w-sm">
          <div className="text-2xl mb-3">⚠️</div>
          <div className="text-sm font-semibold text-neutral-200 mb-2">
            Database not connected
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Add <code className="text-neutral-400">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="text-neutral-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your{' '}
            <code className="text-neutral-400">.env.local</code> file, then restart the dev
            server.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
        Loading highlights…
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-center px-6">
        <div>
          <div className="text-red-400 text-sm mb-2">Couldn&apos;t load highlights</div>
          <div className="text-neutral-600 text-xs font-mono">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="w-[190px] shrink-0 border-r border-neutral-800 p-4 overflow-y-auto hidden md:block">
        <div className="text-[10px] uppercase tracking-wider text-neutral-600 font-mono mb-2 px-2">
          Library
        </div>
        <button
          onClick={() => {
            setActiveTag(null);
            setShowPinnedOnly(false);
          }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] mb-1 ${
            !activeTag && !showPinnedOnly
              ? 'bg-neutral-900 text-neutral-100'
              : 'text-neutral-500 hover:bg-neutral-900/60 hover:text-neutral-200'
          }`}
        >
          <span>All highlights</span>
          <span className="font-mono text-[11px] text-neutral-600">{highlights.length}</span>
        </button>
        <button
          onClick={() => {
            setShowPinnedOnly(true);
            setActiveTag(null);
          }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] mb-4 ${
            showPinnedOnly
              ? 'bg-neutral-900 text-neutral-100'
              : 'text-neutral-500 hover:bg-neutral-900/60 hover:text-neutral-200'
          }`}
        >
          <span>Pinned</span>
          <span className="font-mono text-[11px] text-neutral-600">{pinnedIds.length}</span>
        </button>

        <div className="text-[10px] uppercase tracking-wider text-neutral-600 font-mono mb-2 px-2">
          Tags
        </div>
        {tagCounts.map(([tag, count]) => (
          <button
            key={tag}
            onClick={() => {
              setActiveTag(tag);
              setShowPinnedOnly(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] ${
              activeTag === tag
                ? 'bg-neutral-900 text-neutral-100'
                : 'text-neutral-500 hover:bg-neutral-900/60 hover:text-neutral-200'
            }`}
          >
            <span className="truncate">{tag}</span>
            <span className="font-mono text-[11px] text-neutral-600">{count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto p-5">
        <div className="flex gap-0 border border-neutral-800 rounded-lg overflow-hidden max-w-md mb-5">
          <div className="flex-1 px-4 py-3 border-r border-neutral-800">
            <div className="font-mono text-lg">{highlights.length}</div>
            <div className="text-[10px] uppercase text-neutral-600 mt-1">Total</div>
          </div>
          <div className="flex-1 px-4 py-3 border-r border-neutral-800">
            <div className="font-mono text-lg">{tagCounts.length}</div>
            <div className="text-[10px] uppercase text-neutral-600 mt-1">Tags</div>
          </div>
          <div className="flex-1 px-4 py-3">
            <div className="font-mono text-lg">{weekCount}</div>
            <div className="text-[10px] uppercase text-neutral-600 mt-1">This week</div>
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search highlights or tags"
          className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 px-3.5 py-2.5 outline-none focus:border-neutral-600 mb-4"
        />

        <div className="flex items-center gap-2 mb-4 text-xs font-mono">
          <span className="text-neutral-600">Sort:</span>
          {(['new', 'old', 'len'] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-2 py-1 rounded ${
                sortMode === mode ? 'bg-neutral-900 text-neutral-100' : 'text-neutral-500 hover:text-neutral-200'
              }`}
            >
              {mode === 'new' ? 'Newest' : mode === 'old' ? 'Oldest' : 'Longest'}
            </button>
          ))}
          <button
            onClick={() => exportMarkdown(filtered)}
            className="ml-auto border border-neutral-800 text-neutral-500 hover:text-neutral-200 px-2.5 py-1 rounded"
          >
            Export .md
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-neutral-600">
            <div className="text-2xl mb-3">{highlights.length ? '∅' : '✦'}</div>
            <div className="text-sm font-semibold text-neutral-400 mb-1">
              {highlights.length ? 'Nothing found' : 'No highlights yet'}
            </div>
            <p className="text-xs max-w-xs mx-auto">
              {highlights.length
                ? 'Try a different tag or search.'
                : 'Select text anywhere on the web with the extension to save your first highlight.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((h) => (
              <HighlightCard
                key={h.id}
                highlight={h}
                pinned={pinnedIds.includes(h.id)}
                onClick={() => setSelected(h)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <HighlightModal
          highlight={selected}
          pinned={pinnedIds.includes(selected.id)}
          onClose={() => setSelected(null)}
          onTogglePin={() => togglePin(selected.id)}
          onDelete={() => deleteHighlight(selected.id)}
        />
      )}
    </div>
  );
}