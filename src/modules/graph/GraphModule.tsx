'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
} from 'd3-force';
import { useNotes } from '@/modules/notes/useNotes';
import { useFolders } from '@/modules/notes/useFolders';
import { colorHex } from '@/modules/notes/helpers';
import { computeGraphData, graphSignature, GraphNode, GraphEdge } from './graphData';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ModuleId } from '@/lib/types';

type SimNode = GraphNode & SimulationNodeDatum;

const WIDTH = 900;
const HEIGHT = 600;

interface Props {
  onOpenModule: (id: ModuleId, focusId?: string) => void;
}

export default function GraphModule({ onOpenModule }: Props) {
  const { notes, loading } = useNotes();
  const { folders } = useFolders();

  const { nodes: rawNodes, edges } = useMemo(() => computeGraphData(notes), [notes]);
  const signature = useMemo(() => graphSignature(rawNodes, edges), [rawNodes, edges]);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    if (rawNodes.length === 0) {
      setPositions({});
      return;
    }

    const simNodes: SimNode[] = rawNodes.map((n) => ({ ...n }));
    const simEdges: GraphEdge[] = edges.map((e) => ({ ...e }));

    const sim = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-220))
      .force(
        'link',
        forceLink<SimNode, GraphEdge>(simEdges)
          .id((d) => d.id)
          .distance(95)
      )
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide(34))
      .stop();

    for (let i = 0; i < 300; i++) sim.tick();

    const next: Record<string, { x: number; y: number }> = {};
    simNodes.forEach((n) => {
      next[n.id] = { x: n.x ?? WIDTH / 2, y: n.y ?? HEIGHT / 2 };
    });
    setPositions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  function toSvgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function handlePointerDown(id: string) {
    dragId.current = id;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragId.current) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    setPositions((prev) => ({ ...prev, [dragId.current!]: p }));
  }

  function handlePointerUp() {
    dragId.current = null;
  }

  function folderColor(folderId: string | null): string {
    if (!folderId) return 'var(--text-faint)';
    const f = folders.find((f) => f.id === folderId);
    return (f && colorHex(f.color)) || 'var(--text-faint)';
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="h-full flex items-center justify-center text-center px-6" style={{ background: 'var(--bg)' }}>
        <div className="max-w-sm">
          <div className="text-2xl mb-3">⚠️</div>
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Database not connected</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm" style={{ background: 'var(--bg)', color: 'var(--text-dim)' }}>
        Loading graph…
      </div>
    );
  }

  if (rawNodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center px-6" style={{ background: 'var(--bg)' }}>
        <div className="max-w-xs">
          <div className="text-2xl mb-3">🕸️</div>
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>No notes yet</div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-faint)' }}>
            Create a few notes, then link them with <code>[[Note Title]]</code> to see them connect here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Graph</span>
        <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
          {rawNodes.length} notes · {edges.length} links
        </span>
      </div>

      <div className="flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {edges.map((e, i) => {
            const a = positions[e.source];
            const b = positions[e.target];
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--border-light)"
                strokeWidth={1.5}
              />
            );
          })}

          {rawNodes.map((n) => {
            const p = positions[n.id];
            if (!p) return null;
            const hex = folderColor(n.folderId);
            return (
              <g
                key={n.id}
                transform={`translate(${p.x}, ${p.y})`}
                className="cursor-pointer"
                onPointerDown={() => handlePointerDown(n.id)}
                onClick={() => onOpenModule('notes', n.id)}
              >
                <circle r={8} fill={hex} stroke="var(--bg)" strokeWidth={2} />
                <text
                  x={0}
                  y={22}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--text-dim)"
                  style={{ fontFamily: 'inherit', pointerEvents: 'none' }}
                >
                  {n.title.length > 20 ? n.title.slice(0, 20) + '…' : n.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}