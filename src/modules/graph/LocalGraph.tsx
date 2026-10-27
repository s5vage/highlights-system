'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LocateFixed, Maximize2, Minus, Network, Plus, X } from 'lucide-react';
import GraphCanvas, { GraphHandle } from './GraphCanvas';
import { GLink, GNode, localSubgraph, useGraphData } from './graphData';

type OpenFn = (module: 'notes' | 'highlights' | 'library' | 'graph', id?: string) => void;

function Depth({ depth, onChange, dark }: { depth: 1 | 2; onChange: (d: 1 | 2) => void; dark?: boolean }) {
  const labels = { 1: 'Direct', 2: '2 steps' } as const;
  return dark ? (
    <div className="g-seg" role="radiogroup" aria-label="How far to look">
      {([1, 2] as const).map((d) => (
        <button key={d} type="button" role="radio" aria-checked={depth === d} data-active={depth === d} className="g-seg-item !px-3.5" onClick={() => onChange(d)}>
          {labels[d]}
        </button>
      ))}
    </div>
  ) : (
    <div className="seg !inline-flex">
      {([1, 2] as const).map((d) => (
        <button key={d} type="button" data-active={depth === d} aria-pressed={depth === d} className="seg-item !flex-none !px-3 !py-1" onClick={() => onChange(d)}>
          {labels[d]}
        </button>
      ))}
    </div>
  );
}

// The same graph, but filling the screen.
function Expanded({
  title,
  sub,
  centerId,
  depth,
  setDepth,
  onClose,
  onOpen,
  onOpenInGraph,
}: {
  title: string;
  sub: { nodes: GNode[]; links: GLink[] };
  centerId: string;
  depth: 1 | 2;
  setDepth: (d: 1 | 2) => void;
  onClose: () => void;
  onOpen: (n: GNode) => void;
  onOpenInGraph?: () => void;
}) {
  const ref = useRef<GraphHandle>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col" style={{ background: '#0a0919' }} role="dialog" aria-label="Expanded graph">
      <div className="flex shrink-0 items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgb(255 255 255 / 0.07)', color: '#ececf2' }}>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'rgb(255 255 255 / 0.45)' }}>
            Graph of
          </div>
          <div className="truncate text-[15px] font-semibold">{title}</div>
        </div>
        <Depth depth={depth} onChange={setDepth} dark />
        {onOpenInGraph && (
          <button type="button" className="g-btn !w-auto gap-2 px-3 text-[13px] font-medium" onClick={onOpenInGraph}>
            <Network size={15} strokeWidth={2} /> Open in Graph
          </button>
        )}
        <button type="button" className="g-btn" aria-label="Close" title="Close (Esc)" onClick={onClose}>
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <GraphCanvas ref={ref} variant="local" interactive nodes={sub.nodes} links={sub.links} highlightMode="on" centerId={centerId} onOpen={onOpen} />
        <div className="g-glass absolute bottom-4 right-4 flex flex-col p-1">
          <button type="button" className="g-btn" aria-label="Zoom in" onClick={() => ref.current?.zoomBy(1.5)}>
            <Plus size={17} strokeWidth={2.2} />
          </button>
          <button type="button" className="g-btn" aria-label="Zoom out" onClick={() => ref.current?.zoomBy(1 / 1.5)}>
            <Minus size={17} strokeWidth={2.2} />
          </button>
          <span className="mx-2 my-0.5 h-px" style={{ background: 'rgb(255 255 255 / 0.1)' }} />
          <button type="button" className="g-btn" aria-label="Fit everything" onClick={() => ref.current?.fit(true)}>
            <LocateFixed size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// A small graph of one note: what it links to, what links to it, its tags and books.
export default function LocalGraph({
  noteId,
  onOpenNote,
  onOpenModule,
}: {
  noteId: string;
  onOpenNote: (id: string) => void;
  onOpenModule?: OpenFn;
}) {
  const { graph, loading } = useGraphData();
  const [depth, setDepth] = useState<1 | 2>(1);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<GraphHandle>(null);
  const centerId = `n:${noteId}`;
  const sub = useMemo(() => (graph ? localSubgraph(graph, centerId, depth) : null), [graph, centerId, depth]);
  const connections = sub ? Math.max(0, sub.nodes.length - 1) : 0;
  const title = graph?.nodes.find((n) => n.id === centerId)?.label ?? 'This note';

  function open(n: GNode) {
    if (n.type === 'note') {
      if (n.ref !== noteId) {
        setExpanded(false);
        onOpenNote(n.ref);
      }
    } else if (n.type === 'highlight') {
      setExpanded(false);
      onOpenModule?.('highlights', n.ref);
    } else if (n.type === 'book') {
      try {
        sessionStorage.setItem('lib_open_book', n.ref);
      } catch {
        /* ignore */
      }
      setExpanded(false);
      onOpenModule?.('library');
      setTimeout(() => window.dispatchEvent(new Event('lib-open-book')), 150);
    }
  }

  function openInGraph() {
    try {
      sessionStorage.setItem('graph_focus', centerId);
    } catch {
      /* ignore */
    }
    setExpanded(false);
    onOpenModule?.('graph');
    setTimeout(() => window.dispatchEvent(new Event('graph-focus')), 150);
  }

  const hasGraph = !!sub && connections > 0;

  return (
    <section className="mt-10" aria-label="Graph of this note">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-faint)' }}>
          Graph
          {hasGraph && (
            <span className="ml-2 font-medium normal-case tracking-normal">
              {connections} {connections === 1 ? 'connection' : 'connections'}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          <Depth depth={depth} onChange={setDepth} />
          <button type="button" className="tool" aria-label="Re-centre graph" title="Re-centre" disabled={!hasGraph} onClick={() => ref.current?.fit(true)}>
            <LocateFixed size={15} strokeWidth={2} />
          </button>
          <button type="button" className="tool" aria-label="Expand graph" title="Expand" disabled={!hasGraph} onClick={() => setExpanded(true)}>
            <Maximize2 size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl" style={{ height: 280, boxShadow: 'inset 0 0 0 1px var(--hairline)' }}>
        {loading && !sub ? (
          <div className="grid h-full place-items-center text-[13px]" style={{ background: '#0a0919', color: 'rgb(255 255 255 / 0.5)' }}>
            Building…
          </div>
        ) : !hasGraph || !sub ? (
          <div className="grid h-full place-items-center px-8 text-center text-[13px] leading-relaxed" style={{ background: '#0a0919', color: 'rgb(255 255 255 / 0.55)' }}>
            No connections yet. Link to another note or a book with [[Title]], or add a tag, and it will show up here.
          </div>
        ) : (
          <GraphCanvas ref={ref} variant="local" nodes={sub.nodes} links={sub.links} highlightMode="on" centerId={centerId} onOpen={open} />
        )}
      </div>
      {expanded && hasGraph && sub && (
        <Expanded
          title={title}
          sub={sub}
          centerId={centerId}
          depth={depth}
          setDepth={setDepth}
          onClose={() => setExpanded(false)}
          onOpen={open}
          onOpenInGraph={onOpenModule ? openInGraph : undefined}
        />
      )}
    </section>
  );
}