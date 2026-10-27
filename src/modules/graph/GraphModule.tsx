'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, RefreshCw, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import GraphCanvas, { GraphHandle } from './GraphCanvas';
import { DEFAULT_FILTERS, Filters, GNode, NodeType, TYPE_META, filterGraph, filtersActive, searchNodes, useGraphData } from './graphData';

type OpenFn = (module: 'notes' | 'highlights' | 'library', id?: string) => void;

const TYPES: NodeType[] = ['note', 'book', 'highlight', 'tag'];
const PRESETS = [
  { id: 'any', label: 'Any time', days: 0 },
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '3 months', days: 90 },
  { id: '365', label: '1 year', days: 365 },
];

const dateStr = (ms: number | null) => (ms === null ? '' : new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 10));
const parseDate = (s: string, end = false) => (s ? new Date(`${s}T${end ? '23:59:59' : '00:00:00'}`).getTime() : null);

function Dot({ type, size = 10 }: { type: NodeType; size?: number }) {
  return <span className="g-dot" style={{ width: size, height: size, background: TYPE_META[type].color, boxShadow: `0 0 10px ${TYPE_META[type].color}88` }} />;
}

export default function GraphModule({ onOpenModule }: { onOpenModule: OpenFn }) {
  const { graph, loading, error, reload } = useGraphData();
  const ref = useRef<GraphHandle>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [preset, setPreset] = useState('any');
  const [showFilters, setShowFilters] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);

  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));
  const visible = useMemo(() => (graph ? filterGraph(graph, filters, pinned) : { nodes: [], links: [] }), [graph, filters, pinned]);
  // Picking a tag shows its highlights too: that's the "filtered" view.
  const mode = filters.tags.length ? 'on' : filters.highlightMode;

  const totals = useMemo(() => {
    const t: Record<NodeType, number> = { note: 0, book: 0, highlight: 0, tag: 0 };
    graph?.nodes.forEach((n) => t[n.type]++);
    return t;
  }, [graph]);
  const shown = useMemo(() => {
    const t: Record<NodeType, number> = { note: 0, book: 0, highlight: 0, tag: 0 };
    visible.nodes.forEach((n) => t[n.type]++);
    return t;
  }, [visible]);

  const tagNodes = useMemo(() => (graph ? graph.nodes.filter((n) => n.type === 'tag').sort((a, b) => b.deg - a.deg) : []), [graph]);
  const tagList = useMemo(() => {
    const q = tagQuery.trim().toLowerCase().replace(/^#/, '');
    return tagNodes.filter((t) => !q || t.label.toLowerCase().includes(q)).slice(0, 80);
  }, [tagNodes, tagQuery]);

  const results = useMemo(() => (graph ? searchNodes(graph, query) : []), [graph, query]);

  // Changing the filters re-centres the graph on what is left (but not the first time it loads).
  const firstFilters = useRef(true);
  useEffect(() => {
    if (firstFilters.current) {
      firstFilters.current = false;
      return;
    }
    setFitToken((n) => n + 1);
  }, [filters]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedId(null);
        setShowFilters(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleOpen(n: GNode) {
    if (n.type === 'note') onOpenModule('notes', n.ref);
    else if (n.type === 'highlight') onOpenModule('highlights', n.ref);
    else if (n.type === 'book') {
      try {
        sessionStorage.setItem('lib_open_book', n.ref);
      } catch {
        /* private mode: the Library just opens normally */
      }
      onOpenModule('library');
      setTimeout(() => window.dispatchEvent(new Event('lib-open-book')), 150);
    }
  }

  function pick(n: GNode) {
    setPinned(new Set([n.id]));
    setSelectedId(n.id);
    setQuery(n.label);
    setFocused(false);
    setTimeout(() => ref.current?.focusNode(n.id), 160);
  }

  function clearSearch() {
    setQuery('');
    setPinned(new Set());
    setSelectedId(null);
  }

    // "Open in Graph" from a note: fly to that note once the graph is ready.
  useEffect(() => {
    function focusFromNote() {
      if (!graph) return;
      let id: string | null = null;
      try {
        id = sessionStorage.getItem('graph_focus');
      } catch {
        return;
      }
      if (!id) return;
      sessionStorage.removeItem('graph_focus');
      const n = graph.nodes.find((x) => x.id === id);
      if (n) pick(n);
    }
    focusFromNote();
    window.addEventListener('graph-focus', focusFromNote);
    return () => window.removeEventListener('graph-focus', focusFromNote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  function applyPreset(id: string) {
    setPreset(id);
    const days = PRESETS.find((p) => p.id === id)?.days ?? 0;
    patch({ from: days ? Date.now() - days * 86400000 : null, to: null });
  }

  function resetAll() {
    setFilters(DEFAULT_FILTERS);
    setPreset('any');
    setPinned(new Set());
    setSelectedId(null);
    setTagQuery('');
  }

  function toggleType(t: NodeType) {
    if (t === 'highlight') patch({ highlightMode: filters.highlightMode === 'off' ? 'auto' : 'off' });
    else patch({ types: { ...filters.types, [t]: !filters.types[t] } });
  }
  const isOn = (t: NodeType) => (t === 'highlight' ? filters.highlightMode !== 'off' : filters.types[t]);

  const empty = !!graph && graph.nodes.length === 0;

  return (
    <div className="g-root relative h-full w-full overflow-hidden">
      <GraphCanvas
        ref={ref}
        nodes={visible.nodes}
        links={visible.links}
        highlightMode={mode}
        fitToken={fitToken}
        forceShow={pinned}
        selectedId={selectedId}
        onOpen={handleOpen}
        onSelect={(n) => setSelectedId(n ? n.id : null)}
      />

      {/* search */}
      <div className="absolute left-4 top-4 z-10 w-[min(340px,calc(100%-132px))]">
        <div className="g-glass flex items-center gap-2 px-3" style={{ height: 42 }}>
          <Search size={16} strokeWidth={2} style={{ color: 'rgb(255 255 255 / 0.5)' }} />
          <input
            className="g-bare"
            value={query}
            placeholder="Search the graph"
            aria-label="Search the graph"
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && results[activeIdx]) pick(results[activeIdx]);
              else if (e.key === 'Escape') {
                clearSearch();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {query && (
            <button type="button" className="g-btn !h-6 !w-6 !rounded-full" aria-label="Clear search" onClick={clearSearch}>
              <X size={13} strokeWidth={2.4} />
            </button>
          )}
        </div>
        {focused && results.length > 0 && (
          <div className="g-glass mt-2 overflow-hidden p-1.5" role="listbox" aria-label="Search results">
            {results.map((n, i) => (
              <button
                key={n.id}
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                className="g-result"
                data-active={i === activeIdx}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(n)}
              >
                <Dot type={n.type} />
                <span className="min-w-0 flex-1 truncate">{n.label}</span>
                <span className="text-[11px] capitalize" style={{ color: 'rgb(255 255 255 / 0.4)' }}>
                  {n.type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* top right */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <div className="g-glass flex items-center p-1">
          <button type="button" className="g-btn" aria-label="Reload graph" title="Reload" onClick={reload}>
            <RefreshCw size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="g-btn"
            aria-label="Filters"
            title="Filters"
            data-active={showFilters || filtersActive(filters)}
            onClick={() => setShowFilters((s) => !s)}
          >
            <SlidersHorizontal size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* filters */}
      {showFilters && (
        <div className="g-glass absolute right-4 top-[68px] z-10 max-h-[calc(100%-150px)] w-[300px] max-w-[calc(100%-32px)] overflow-y-auto p-4" role="dialog" aria-label="Filters">
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-semibold">Filters</div>
            <button type="button" className="g-link" onClick={resetAll}>
              <RotateCcw size={12} strokeWidth={2.4} /> Reset
            </button>
          </div>

          <div className="g-label">Highlights</div>
          <div className="g-seg" role="radiogroup" aria-label="Highlights">
            {(['auto', 'on', 'off'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={filters.highlightMode === m} data-active={filters.highlightMode === m} className="g-seg-item" onClick={() => patch({ highlightMode: m })}>
                {m === 'auto' ? 'Auto' : m === 'on' ? 'Always' : 'Hidden'}
              </button>
            ))}
          </div>
          <div className="g-hint">Auto shows them when you zoom in, or when you pick a tag.</div>

          <div className="g-label">Tags</div>
          {filters.tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {filters.tags.map((id) => {
                const t = tagNodes.find((x) => x.id === id);
                return (
                  <button key={id} type="button" className="g-chip" onClick={() => patch({ tags: filters.tags.filter((x) => x !== id) })} aria-label={`Remove ${t?.label ?? 'tag'}`}>
                    {t?.label ?? id} <X size={11} strokeWidth={2.6} />
                  </button>
                );
              })}
            </div>
          )}
          <input className="g-input" placeholder="Find a tag" aria-label="Find a tag" value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} />
          <div className="mt-2 max-h-[170px] overflow-y-auto">
            {tagList.map((t) => {
              const on = filters.tags.includes(t.id);
              return (
                <button key={t.id} type="button" className="g-result" data-active={on} onClick={() => patch({ tags: on ? filters.tags.filter((x) => x !== t.id) : [...filters.tags, t.id] })}>
                  <span className="g-check" data-on={on} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                  <span className="tnum text-[11.5px]" style={{ color: 'rgb(255 255 255 / 0.4)' }}>
                    {t.deg}
                  </span>
                </button>
              );
            })}
            {tagList.length === 0 && <div className="g-hint !mt-2">No tags match.</div>}
          </div>

          <div className="g-label">Date</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="g-chip" data-active={preset === p.id} onClick={() => applyPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input type="date" className="g-input" aria-label="From date" value={dateStr(filters.from)} onChange={(e) => (setPreset('custom'), patch({ from: parseDate(e.target.value) }))} />
            <input type="date" className="g-input" aria-label="To date" value={dateStr(filters.to)} onChange={(e) => (setPreset('custom'), patch({ to: parseDate(e.target.value, true) }))} />
          </div>
          <div className="g-hint">Based on when notes were last edited and when books and highlights were added.</div>

          <div className="g-label">Orphans</div>
          <div className="g-seg" role="radiogroup" aria-label="Orphans">
            {(['show', 'hide', 'only'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={filters.orphans === m} data-active={filters.orphans === m} className="g-seg-item" onClick={() => patch({ orphans: m })}>
                {m === 'show' ? 'Show' : m === 'hide' ? 'Hide' : 'Only'}
              </button>
            ))}
          </div>
          <div className="g-hint">Orphans have no links, tags, or book.</div>

          <label className="g-switchrow">
            <span>Journal entries</span>
            <input type="checkbox" checked={filters.journal} onChange={(e) => patch({ journal: e.target.checked })} />
            <span className="g-switch" aria-hidden />
          </label>
        </div>
      )}

      {/* legend */}
      {graph && !empty && (
        <div className="g-glass absolute bottom-4 left-4 z-10 w-[220px] p-2" aria-label="Legend">
          {TYPES.map((t) => {
            const on = isOn(t);
            return (
              <button key={t} type="button" className="g-legend" data-off={!on} aria-pressed={on} onClick={() => toggleType(t)}>
                <Dot type={t} size={11} />
                <span className="flex-1 text-left">{TYPE_META[t].label}</span>
                <span className="tnum text-[11.5px]" style={{ color: 'rgb(255 255 255 / 0.45)' }}>
                  {on ? shown[t] : 0}
                  {on && shown[t] !== totals[t] ? ` / ${totals[t]}` : ''}
                </span>
              </button>
            );
          })}
          <div className="g-hint !mx-2 !mb-1 !mt-1.5">
            {visible.nodes.length} dots · {visible.links.length} lines
            {filters.highlightMode === 'auto' && !filters.tags.length ? ' · zoom in to see highlights' : ''}
          </div>
        </div>
      )}

      {/* zoom */}
      <div className="g-glass absolute bottom-4 right-4 z-10 flex flex-col p-1">
        <button type="button" className="g-btn" aria-label="Zoom in" onClick={() => ref.current?.zoomBy(1.5)}>
          <Plus size={17} strokeWidth={2.2} />
        </button>
        <button type="button" className="g-btn" aria-label="Zoom out" onClick={() => ref.current?.zoomBy(1 / 1.5)}>
          <Minus size={17} strokeWidth={2.2} />
        </button>
        <span className="mx-2 my-0.5 h-px" style={{ background: 'rgb(255 255 255 / 0.1)' }} />
        <button type="button" className="g-btn" aria-label="Reset view" title="Reset view" onClick={() => ref.current?.fit(true)}>
          <Maximize2 size={16} strokeWidth={2} />
        </button>
      </div>

      {(loading || error || empty) && (
        <div className="pointer-events-none absolute inset-0 z-[5] grid place-items-center px-6 text-center">
          <div className="max-w-[300px] text-[14px] leading-relaxed" style={{ color: 'rgb(255 255 255 / 0.6)' }}>
            {error
              ? `Couldn’t build the graph. ${error}`
              : loading
              ? 'Building your graph…'
              : 'Nothing to show yet. Write a note, add a book, or save a highlight, and link them with [[Titles]] and tags.'}
          </div>
        </div>
      )}
    </div>
  );
}