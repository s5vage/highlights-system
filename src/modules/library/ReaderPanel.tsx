'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { motion } from 'motion/react';
import { ChevronDown, ChevronUp, Copy, Highlighter, LayoutGrid, List, Search, Trash2, X } from 'lucide-react';
import { BookHighlight } from '@/lib/types';
import { useBookSearch } from './useBookSearch';

export type PanelTab = 'contents' | 'pages' | 'highlights' | 'search';

const TABS: { id: PanelTab; label: string; Icon: typeof List }[] = [
  { id: 'contents', label: 'Contents', Icon: List },
  { id: 'pages', label: 'Pages', Icon: LayoutGrid },
  { id: 'highlights', label: 'Highlights', Icon: Highlighter },
  { id: 'search', label: 'Search', Icon: Search },
];

interface Props {
  pdf: PDFDocumentProxy | null;
  base: { w: number; h: number };
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  current: number;
  currentEnd: number;
  onJump: (page: number) => void;
  highlights: BookHighlight[];
  onJumpHighlight: (h: BookHighlight) => void;
  onCopy: (text: string) => void;
  onDeleteHighlight: (id: string) => void;
  search: ReturnType<typeof useBookSearch>;
  activeHit: number;
  onPickHit: (i: number) => void;
  onStepHit: (delta: number) => void;
  focusTick: number;
  onClose: () => void;
}

interface TocItem {
  title: string;
  page: number | null;
  level: number;
}

async function resolvePage(pdf: PDFDocumentProxy, dest: unknown): Promise<number | null> {
  try {
    const d = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(d)) return null;
    const first = d[0];
    if (typeof first === 'number') return first + 1;
    if (first && typeof first === 'object') return (await pdf.getPageIndex(first as never)) + 1;
  } catch {
    /* an unresolvable link just becomes a non-clickable heading */
  }
  return null;
}

function ContentsTab({ pdf, current, onJump }: { pdf: PDFDocumentProxy | null; current: number; onJump: (p: number) => void }) {
  const [items, setItems] = useState<TocItem[] | null>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    setItems(null);
    (async () => {
      const outline = await pdf.getOutline().catch(() => null);
      const out: TocItem[] = [];
      async function walk(nodes: NonNullable<typeof outline>, level: number) {
        for (const n of nodes) {
          if (cancelled || out.length > 1500) return;
          out.push({ title: (n.title || '').trim() || 'Untitled', page: await resolvePage(pdf!, n.dest), level });
          if (n.items?.length) await walk(n.items as NonNullable<typeof outline>, level + 1);
        }
      }
      if (outline?.length) await walk(outline, 0);
      if (!cancelled) setItems(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  // The chapter you are in: the last heading at or before the current page.
  let activeIdx = -1;
  items?.forEach((it, i) => {
    if (it.page !== null && it.page <= current && (activeIdx === -1 || it.page >= (items[activeIdx].page ?? 0))) activeIdx = i;
  });

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, items]);

  if (items === null) return <Message>Reading the table of contents…</Message>;
  if (items.length === 0)
    return <Message>This book has no table of contents. Use Pages or Search to move around.</Message>;

  return (
    <div className="px-2 py-2">
      {items.map((it, i) => (
        <button
          key={i}
          ref={i === activeIdx ? activeRef : undefined}
          type="button"
          disabled={it.page === null}
          onClick={() => it.page && onJump(it.page)}
          className="flex w-full items-baseline gap-3 rounded-lg py-1.5 pr-2.5 text-left text-[13.5px] disabled:opacity-60"
          style={{
            paddingLeft: 10 + it.level * 16,
            background: i === activeIdx ? 'var(--fill-strong)' : 'transparent',
            fontWeight: it.level === 0 ? 600 : 500,
            color: i === activeIdx ? 'var(--text)' : 'var(--text-dim)',
          }}
        >
          <span className="min-w-0 flex-1 leading-snug">{it.title}</span>
          {it.page !== null && (
            <span className="tnum shrink-0 text-[12px]" style={{ color: 'var(--text-faint)' }}>
              {it.page}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Thumb({
  pdf,
  page,
  base,
  active,
  onClick,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  base: { w: number; h: number };
  active: boolean;
  onClick: () => void;
}) {
  const wrap = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);

  // Draw each thumbnail once, when it scrolls into view.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || drawn.current) return;
        drawn.current = true;
        (async () => {
          try {
            const p = await pdf.getPage(page);
            const c = canvas.current;
            if (!c) return;
            const natural = p.getViewport({ scale: 1 });
            const cssW = el.clientWidth || 130;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const viewport = p.getViewport({ scale: (cssW / natural.width) * dpr });
            c.width = Math.floor(viewport.width);
            c.height = Math.floor(viewport.height);
            const ctx = c.getContext('2d');
            if (ctx) await p.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
          } catch {
            drawn.current = false;
          }
        })();
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pdf, page]);

  return (
    <button
      ref={wrap}
      type="button"
      onClick={onClick}
      aria-label={`Go to page ${page}`}
      aria-current={active}
      className="group block w-full text-left"
    >
      <div
        className="overflow-hidden rounded-[3px] bg-white"
        style={{
          aspectRatio: `${base.w} / ${base.h}`,
          boxShadow: active
            ? '0 0 0 2.5px var(--accent), 0 4px 12px -4px rgb(0 0 0 / 0.35)'
            : '0 1px 3px rgb(0 0 0 / 0.18), inset 0 0 0 1px var(--hairline)',
        }}
      >
        <canvas ref={canvas} className="block h-full w-full" />
      </div>
      <div
        className="tnum mt-1.5 text-center text-[11.5px] font-medium"
        style={{ color: active ? 'var(--accent)' : 'var(--text-faint)' }}
      >
        {page}
      </div>
    </button>
  );
}

function PagesTab({ pdf, base, current, currentEnd, onJump }: { pdf: PDFDocumentProxy | null; base: { w: number; h: number }; current: number; currentEnd: number; onJump: (p: number) => void }) {
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [current]);
  if (!pdf) return <Message>Opening the book…</Message>;
  return (
    <div className="grid grid-cols-2 gap-x-3.5 gap-y-4 p-3.5">
      {Array.from({ length: pdf.numPages }, (_, i) => (
        <div key={i} ref={i + 1 === current ? activeRef : undefined}>
          <Thumb pdf={pdf} page={i + 1} base={base} active={i + 1 >= current && i + 1 <= currentEnd} onClick={() => onJump(i + 1)} />
        </div>
      ))}
    </div>
  );
}

function HighlightsTab({
  highlights,
  onJumpHighlight,
  onCopy,
  onDelete,
}: {
  highlights: BookHighlight[];
  onJumpHighlight: (h: BookHighlight) => void;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  if (highlights.length === 0)
    return <Message>No highlights in this book yet. Select text on any page and pick a color.</Message>;
  const sorted = [...highlights].sort((a, b) => a.page - b.page || a.created_at.localeCompare(b.created_at));
  return (
    <div className="px-2 py-2">
      <div className="px-2.5 pb-2 pt-1 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        {sorted.length} {sorted.length === 1 ? 'highlight' : 'highlights'}
      </div>
      {sorted.map((h) => (
        <div key={h.id} className="group relative">
          <button
            type="button"
            onClick={() => onJumpHighlight(h)}
            className="block w-full rounded-xl py-2.5 pl-3.5 pr-3 text-left hover:bg-[var(--fill)]"
          >
            <span
              className="absolute bottom-3 left-1 top-3 w-[3px] rounded-full"
              style={{ background: `var(--hue-${h.color})` }}
              aria-hidden
            />
            <span className="tnum block text-[11.5px] font-semibold" style={{ color: 'var(--text-faint)' }}>
              Page {h.page}
            </span>
            <span className="mt-0.5 line-clamp-4 block text-[13.5px] leading-snug">{h.text}</span>
          </button>
          <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <button type="button" className="tool !h-6 !w-6 !rounded-md" aria-label="Copy highlight" title="Copy" onClick={() => onCopy(h.text)} style={{ background: 'var(--surface)' }}>
              <Copy size={13} strokeWidth={2} />
            </button>
            <button type="button" className="tool !h-6 !w-6 !rounded-md hover:!text-[#e5484d]" aria-label="Remove highlight" title="Remove" onClick={() => onDelete(h.id)} style={{ background: 'var(--surface)' }}>
              <Trash2 size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchTab({
  search,
  activeHit,
  onPickHit,
  onStepHit,
  focusTick,
}: {
  search: ReturnType<typeof useBookSearch>;
  activeHit: number;
  onPickHit: (i: number) => void;
  onStepHit: (d: number) => void;
  focusTick: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [focusTick]);

  const { query, setQuery, hits, ready, progress, hasText } = search;
  const pages = new Set(hits.map((h) => h.page)).size;
  const typed = query.trim().length >= 2;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pb-2 pt-3">
        <div className="search" onClick={() => input.current?.focus()}>
          <Search size={15} strokeWidth={2} style={{ color: 'var(--text-faint)' }} />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onStepHit(e.shiftKey ? -1 : 1);
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder="Search in this book"
            aria-label="Search in this book"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="grid h-5 w-5 place-items-center rounded-full"
              style={{ background: 'var(--fill-strong)', color: 'var(--text-dim)' }}
            >
              <X size={12} strokeWidth={2.4} />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex min-h-[28px] items-center justify-between px-1 text-[12px]" style={{ color: 'var(--text-faint)' }} aria-live="polite">
          {!ready ? (
            <span className="tnum">Preparing search… {Math.round(progress * 100)}%</span>
          ) : !hasText ? (
            <span>No searchable text in this book.</span>
          ) : !typed ? (
            <span>Type at least 2 letters.</span>
          ) : hits.length === 0 ? (
            <span>No matches.</span>
          ) : (
            <>
              <span className="tnum">
                {hits.length >= 600 ? '600+' : hits.length} {hits.length === 1 ? 'match' : 'matches'} on {pages} {pages === 1 ? 'page' : 'pages'}
              </span>
              <span className="flex items-center gap-0.5">
                <button type="button" className="tool !h-6 !w-6 !rounded-md" aria-label="Previous match" onClick={() => onStepHit(-1)}>
                  <ChevronUp size={15} strokeWidth={2.2} />
                </button>
                <button type="button" className="tool !h-6 !w-6 !rounded-md" aria-label="Next match" onClick={() => onStepHit(1)}>
                  <ChevronDown size={15} strokeWidth={2.2} />
                </button>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {hits.map((h, i) => (
          <button
            key={`${h.page}-${h.index}`}
            type="button"
            onClick={() => onPickHit(i)}
            className="block w-full rounded-xl px-2.5 py-2 text-left"
            style={{ background: i === activeHit ? 'var(--fill-strong)' : 'transparent' }}
          >
            <span className="tnum block text-[11.5px] font-semibold" style={{ color: 'var(--text-faint)' }}>
              Page {h.page}
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: 'var(--text-dim)' }}>
              …{h.before}
              <mark className="rounded-[3px] px-0.5 font-semibold" style={{ background: 'rgb(255 190 0 / 0.4)', color: 'var(--text)' }}>
                {h.match}
              </mark>
              {h.after}…
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-6 py-10 text-center text-[13.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
      {children}
    </p>
  );
}

export default function ReaderPanel(props: Props) {
  const { tab, onTab, onClose } = props;
  return (
    <aside
      className="flex h-full w-[320px] shrink-0 flex-col max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[88vw] max-md:max-w-[360px]"
      style={{
        borderRight: '1px solid var(--hairline)',
        background: 'color-mix(in srgb, var(--surface) 92%, var(--bg))',
      }}
      aria-label="Book panel"
    >
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
        <div role="tablist" className="seg !flex !w-full">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={label}
                title={label}
                data-active={active}
                onClick={() => onTab(id)}
                className="seg-item !flex !flex-1 items-center justify-center !py-1.5"
              >
                {active && (
                  <motion.span layoutId="panel-tab" className="seg-thumb" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                )}
                <Icon size={16} strokeWidth={2} className="relative" />
              </button>
            );
          })}
        </div>
        <button type="button" className="tool !h-8 !w-8 md:hidden" aria-label="Close panel" onClick={onClose}>
          <X size={17} strokeWidth={2} />
        </button>
      </div>

      <div className="px-4 pb-1 pt-1 text-[12px] font-semibold" style={{ color: 'var(--text-faint)' }}>
        {TABS.find((t) => t.id === tab)?.label}
      </div>

      <div className={`min-h-0 flex-1 ${tab === 'search' ? '' : 'overflow-y-auto'}`}>
        {tab === 'contents' && <ContentsTab pdf={props.pdf} current={props.current} onJump={props.onJump} />}
        {tab === 'pages' && <PagesTab pdf={props.pdf} base={props.base} current={props.current} currentEnd={props.currentEnd} onJump={props.onJump} />}
        {tab === 'highlights' && (
          <HighlightsTab
            highlights={props.highlights}
            onJumpHighlight={props.onJumpHighlight}
            onCopy={props.onCopy}
            onDelete={props.onDeleteHighlight}
          />
        )}
        {tab === 'search' && (
          <SearchTab
            search={props.search}
            activeHit={props.activeHit}
            onPickHit={props.onPickHit}
            onStepHit={props.onStepHit}
            focusTick={props.focusTick}
          />
        )}
      </div>
    </aside>
  );
}