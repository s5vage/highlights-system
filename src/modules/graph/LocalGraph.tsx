'use client';

import { useMemo, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import GraphCanvas, { GraphHandle } from './GraphCanvas';
import { GNode, localSubgraph, useGraphData } from './graphData';

type OpenFn = (module: 'notes' | 'highlights' | 'library', id?: string) => void;

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
  const ref = useRef<GraphHandle>(null);
  const centerId = `n:${noteId}`;
  const sub = useMemo(() => (graph ? localSubgraph(graph, centerId, depth) : null), [graph, centerId, depth]);
  const connections = sub ? Math.max(0, sub.nodes.length - 1) : 0;

  function open(n: GNode) {
    if (n.type === 'note') {
      if (n.ref !== noteId) onOpenNote(n.ref);
    } else if (n.type === 'highlight') onOpenModule?.('highlights', n.ref);
    else if (n.type === 'book') {
      try {
        sessionStorage.setItem('lib_open_book', n.ref);
      } catch {
        /* ignore */
      }
      onOpenModule?.('library');
      setTimeout(() => window.dispatchEvent(new Event('lib-open-book')), 150);
    }
  }

  return (
    <section className="mt-10" aria-label="Graph of this note">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-faint)' }}>
          Graph
          {sub && connections > 0 && (
            <span className="ml-2 font-medium normal-case tracking-normal">
              {connections} {connections === 1 ? 'connection' : 'connections'}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          <div className="seg !inline-flex">
            {([1, 2] as const).map((d) => (
              <button key={d} type="button" data-active={depth === d} aria-pressed={depth === d} className="seg-item !flex-none !px-3 !py-1" onClick={() => setDepth(d)}>
                {d === 1 ? 'Direct' : '2 steps'}
              </button>
            ))}
          </div>
          <button type="button" className="tool" aria-label="Fit graph" title="Fit" onClick={() => ref.current?.fit(true)}>
            <Maximize2 size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl" style={{ height: 280, boxShadow: 'inset 0 0 0 1px var(--hairline)' }}>
        {loading && !sub ? (
          <div className="grid h-full place-items-center text-[13px]" style={{ background: '#08080b', color: 'rgb(255 255 255 / 0.5)' }}>
            Building…
          </div>
        ) : !sub || connections === 0 ? (
          <div className="grid h-full place-items-center px-8 text-center text-[13px] leading-relaxed" style={{ background: '#08080b', color: 'rgb(255 255 255 / 0.55)' }}>
            No connections yet. Link to another note or a book with [[Title]], or add a tag, and it will show up here.
          </div>
        ) : (
          <GraphCanvas ref={ref} variant="local" nodes={sub.nodes} links={sub.links} highlightMode="on" centerId={centerId} onOpen={open} />
        )}
      </div>
    </section>
  );
}