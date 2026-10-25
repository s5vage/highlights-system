'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, Simulation } from 'd3-force';
import { GLink, GNode, NodeType, TYPE_META } from './graphData';

export interface GraphHandle {
  fit: (animate?: boolean) => void;
  zoomBy: (factor: number) => void;
  focusNode: (id: string) => void;
  focusIds: (ids: string[]) => void;
}

interface Props {
  nodes: GNode[];
  links: GLink[];
  variant?: 'global' | 'local';
  highlightMode: 'auto' | 'on' | 'off';
  fitToken?: number; // change this to re-centre and zoom to fit once the layout settles
  forceShow?: Set<string>;
  selectedId?: string | null;
  centerId?: string | null;
  onOpen: (n: GNode) => void;
  onSelect?: (n: GNode | null) => void;
  className?: string;
}

interface SNode {
  id: string;
  g: GNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  r: number;
  alpha: number;
  appear: number;
  labelZoom: number;
  sx: number;
  sy: number;
  rs: number;
}
interface SLink {
  source: SNode | string;
  target: SNode | string;
}
interface Cam {
  x: number;
  y: number;
  k: number;
}
interface Preview {
  g: GNode;
  x: number;
  y: number;
  touch: boolean;
}

const KMIN = 0.1;
const KMAX = 9;
const sm = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const RADIUS_BASE: Record<NodeType, number> = { note: 3.2, book: 4, tag: 4.6, highlight: 2.1 };
const RADIUS_GAIN: Record<NodeType, number> = { note: 1.15, book: 1.5, tag: 1.9, highlight: 0.45 };

function radiusOf(g: GNode, local: boolean) {
  const r = Math.min(24, RADIUS_BASE[g.type] + Math.sqrt(g.deg) * RADIUS_GAIN[g.type]);
  return local ? r * 1.35 : r;
}

// A soft round glow, drawn once per colour and stamped for every dot.
let glowCache: Record<NodeType, HTMLCanvasElement> | null = null;
function glows() {
  if (glowCache) return glowCache;
  const make = (rgb: [number, number, number]) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    const [r, gg, b] = rgb;
    gr.addColorStop(0, `rgba(${r},${gg},${b},0.95)`);
    gr.addColorStop(0.22, `rgba(${r},${gg},${b},0.42)`);
    gr.addColorStop(0.55, `rgba(${r},${gg},${b},0.1)`);
    gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return c;
  };
  glowCache = {
    note: make(TYPE_META.note.rgb),
    book: make(TYPE_META.book.rgb),
    tag: make(TYPE_META.tag.rgb),
    highlight: make(TYPE_META.highlight.rgb),
  };
  return glowCache;
}

interface Engine {
  sync: (nodes: GNode[], links: GLink[]) => void;
  handle: GraphHandle;
  request: () => void;
}

const GraphCanvas = forwardRef<GraphHandle, Props>(function GraphCanvas(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const local = props.variant === 'local';

  useImperativeHandle(
    ref,
    () => ({
      fit: (a) => engineRef.current?.handle.fit(a),
      zoomBy: (f) => engineRef.current?.handle.zoomBy(f),
      focusNode: (id) => engineRef.current?.handle.focusNode(id),
      focusIds: (ids) => engineRef.current?.handle.focusIds(ids),
    }),
    []
  );

  useEffect(() => {
    const wrap = wrapRef.current as HTMLDivElement;
    const canvas = canvasRef.current as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const sprites = glows();
    const isLocal = () => propsRef.current.variant === 'local';

    const size = { w: 0, h: 0, dpr: 1 };
    const cam: Cam = { x: 0, y: 0, k: 1 };
    let anim: { t0: number; ms: number; from: Cam; to: Cam } | null = null;
    let nodes = new Map<string, SNode>();
    let list: SNode[] = [];
    let edges: { a: SNode; b: SNode }[] = [];
    let adj = new Map<string, Set<string>>();
    let hoverId: string | null = null;
    let touchId: string | null = null;
    let focus = 0;
    let focusKey: string | null = null;
    let focusNb: Set<string> = new Set();
    let pulse: { id: string; t0: number } | null = null;
    let raf = 0;
    let maxDpr = 2;
    let lastDataset = '';
    let glowCv: HTMLCanvasElement | null = null;
    let glowCtx: CanvasRenderingContext2D | null = null;
    const labelW = new Map<string, number>();

    const sim: Simulation<SNode, undefined> = forceSimulation<SNode>([])
      .alphaDecay(0.035)
      .velocityDecay(0.38)
      .force(
        'link',
        forceLink<SNode, SLink>([])
          .id((d) => d.id)
          .distance((l) => {
            const a = (l.source as SNode).g.type;
            const b = (l.target as SNode).g.type;
            if (a === 'highlight' || b === 'highlight') return 26;
            if (a === 'tag' || b === 'tag') return 62;
            if (a === 'book' || b === 'book') return 78;
            return 70;
          })
      )
      .force(
        'charge',
        forceManyBody<SNode>()
          .strength((d) => (d.g.type === 'highlight' ? -9 : -(26 + d.r * 7)))
          .distanceMax(340)
          .theta(0.9)
      )
      .force('x', forceX<SNode>(0).strength(0.055))
      .force('y', forceY<SNode>(0).strength(0.055))
      .force('collide', forceCollide<SNode>().radius((d) => d.r + 1.5).strength(0.7));

    const request = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };
    sim.on('tick', request);

    // ── camera ──
    const stopAnim = () => {
      anim = null;
    };
    const animateTo = (to: Cam, ms = 650) => {
      anim = { t0: performance.now(), ms, from: { ...cam }, to };
      request();
    };
    const visibleForFit = () => {
      const mode = propsRef.current.highlightMode;
      const show = list.filter((n) => n.g.type !== 'highlight' || mode === 'on' || isLocal());
      return show.length ? show : list;
    };
    const fitTarget = (set?: SNode[]): Cam | null => {
      const arr = set && set.length ? set : visibleForFit();
      if (!arr.length || !size.w) return null;
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      arr.forEach((n) => {
        x0 = Math.min(x0, n.x - n.r);
        y0 = Math.min(y0, n.y - n.r);
        x1 = Math.max(x1, n.x + n.r);
        y1 = Math.max(y1, n.y + n.r);
      });
      const pad = isLocal() ? 36 : 70;
      const bw = Math.max(60, x1 - x0);
      const bh = Math.max(60, y1 - y0);
      const k = clamp(Math.min((size.w - pad * 2) / bw, (size.h - pad * 2) / bh), KMIN, isLocal() ? 1.6 : 2.4);
      return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, k };
    };
    const fit = (animate = true) => {
      const t = fitTarget();
      if (!t) return;
      if (animate) animateTo(t);
      else {
        stopAnim();
        cam.x = t.x;
        cam.y = t.y;
        cam.k = t.k;
        request();
      }
    };
    const zoomAt = (px: number, py: number, factor: number) => {
      const k0 = cam.k;
      const k1 = clamp(k0 * factor, KMIN, KMAX);
      const wx = (px - size.w / 2) / k0 + cam.x;
      const wy = (py - size.h / 2) / k0 + cam.y;
      cam.k = k1;
      cam.x = wx - (px - size.w / 2) / k1;
      cam.y = wy - (py - size.h / 2) / k1;
      request();
    };

    // ── sizing ──
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      size.w = Math.max(1, Math.round(r.width));
      size.h = Math.max(1, Math.round(r.height));
      size.dpr = dpr;
      canvas.width = Math.round(size.w * dpr);
      canvas.height = Math.round(size.h * dpr);
      canvas.style.width = `${size.w}px`;
      canvas.style.height = `${size.h}px`;
      setBox({ w: size.w, h: size.h });
      request();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // ── data ──
    const sync = (gnodes: GNode[], glinks: GLink[]) => {
      const first = nodes.size === 0;
      const loc = isLocal();
      const nbOf = new Map<string, string[]>();
      const push = (k: string, v: string) => {
        const a = nbOf.get(k);
        if (a) a.push(v);
        else nbOf.set(k, [v]);
      };
      glinks.forEach((l) => {
        push(l.source, l.target);
        push(l.target, l.source);
      });
      let maxDeg = 1;
      gnodes.forEach((g) => (maxDeg = Math.max(maxDeg, g.deg)));

      const next = new Map<string, SNode>();
      gnodes.forEach((g) => {
        const old = nodes.get(g.id);
        const imp = Math.sqrt(g.deg / maxDeg);
        const labelZoom = loc ? 0 : g.type === 'highlight' ? 2.7 : 2.9 - 2.2 * imp - (g.type === 'tag' ? 0.2 : 0);
        if (old) {
          old.g = g;
          old.r = radiusOf(g, loc);
          old.labelZoom = labelZoom;
          next.set(g.id, old);
          return;
        }
        let sx = 0,
          sy = 0,
          c = 0;
        (nbOf.get(g.id) ?? []).forEach((id) => {
          const o = nodes.get(id);
          if (o) {
            sx += o.x;
            sy += o.y;
            c++;
          }
        });
        const a = Math.random() * Math.PI * 2;
        const spread = first ? Math.sqrt(gnodes.length) * 9 * Math.sqrt(Math.random()) : 40 * Math.random();
        const x = c ? sx / c + (Math.random() - 0.5) * 24 : Math.cos(a) * spread;
        const y = c ? sy / c + (Math.random() - 0.5) * 24 : Math.sin(a) * spread;
        next.set(g.id, { id: g.id, g, x, y, vx: 0, vy: 0, r: radiusOf(g, loc), alpha: 0, appear: 0, labelZoom, sx: 0, sy: 0, rs: 0 });
      });
      nodes = next;
      list = [...next.values()];
      const wantDpr = list.length > 250 ? 1.5 : 2;
      if (wantDpr !== maxDpr) {
        maxDpr = wantDpr;
        resize();
      }
      edges = [];
      adj = new Map();
      const simLinks: SLink[] = [];
      glinks.forEach((l) => {
        const a = next.get(l.source);
        const b = next.get(l.target);
        if (!a || !b) return;
        edges.push({ a, b });
        simLinks.push({ source: l.source, target: l.target });
        if (!adj.has(a.id)) adj.set(a.id, new Set());
        if (!adj.has(b.id)) adj.set(b.id, new Set());
        adj.get(a.id)!.add(b.id);
        adj.get(b.id)!.add(a.id);
      });
      const linkForce = sim.force('link') as ReturnType<typeof forceLink<SNode, SLink>>;
      linkForce.links([]);
      sim.nodes(list);
      linkForce.links(simLinks);

      if (hoverId && !nodes.has(hoverId)) {
        hoverId = null;
        setPreview(null);
      }
      if (first && list.length) {
        sim.stop();
        const ticks = list.length > 700 ? 70 : 130;
        for (let i = 0; i < ticks; i++) sim.tick();
        list.forEach((n) => (n.appear = 0));
        fit(false);
        sim.alpha(0.3).restart();
      } else {
        sim.alpha(Math.max(sim.alpha(), 0.45)).restart();
        if (isLocal()) setTimeout(() => fit(true), 500);
      }
      request();
    };

    // ── drawing ──
    function render(now: number) {
      raf = 0;
      const { w, h, dpr } = size;
      if (!w) return;
      const P = propsRef.current;
      const loc = P.variant === 'local';
      let busy = false;

      if (anim) {
        const t = Math.min(1, (now - anim.t0) / anim.ms);
        const e = ease(t);
        cam.x = anim.from.x + (anim.to.x - anim.from.x) * e;
        cam.y = anim.from.y + (anim.to.y - anim.from.y) * e;
        cam.k = Math.exp(Math.log(anim.from.k) + (Math.log(anim.to.k) - Math.log(anim.from.k)) * e);
        if (t < 1) busy = true;
        else anim = null;
      }
      const k = cam.k;

      // what the pointer is on decides what stands out
      const fId = hoverId ?? touchId ?? P.selectedId ?? null;
      if (fId !== focusKey) {
        focusKey = fId;
        focusNb = fId ? new Set([fId, ...(adj.get(fId) ?? [])]) : new Set();
      }
      const fTarget = fId && nodes.has(fId) ? 1 : 0;
      focus += (fTarget - focus) * 0.2;
      if (Math.abs(fTarget - focus) > 0.01) busy = true;
      else focus = fTarget;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);

      const zoomT = sm((k - 0.28) / 0.9); // 0 = fully zoomed out, 1 = comfortably in
      const showMode = P.highlightMode;
      const cx = w / 2,
        cy = h / 2;

      // positions, visibility and fades
      const counts: Record<string, number> = {};
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        n.sx = (n.x - cam.x) * k + cx;
        n.sy = (n.y - cam.y) * k + cy;
        n.rs = Math.max(1.3, n.r * Math.pow(k, 0.8));
        let t = 1;
        if (n.g.type === 'highlight') {
          let v = 1;
          if (showMode === 'off') v = 0;
          else if (showMode === 'auto' && !loc) {
            v = sm((k - 1.5) / 0.7);
            if (P.forceShow?.has(n.id) || n.id === P.selectedId || (fId && focusNb.has(n.id))) v = 1;
          }
          t *= v;
        }
        if (focus > 0.01 && !focusNb.has(n.id)) t *= 1 - focus * 0.88;
        n.alpha += (t - n.alpha) * 0.22;
        if (Math.abs(t - n.alpha) > 0.012) busy = true;
        else n.alpha = t;
        if (n.appear < 1) {
          n.appear = Math.min(1, n.appear + 0.06);
          busy = true;
        }
      }
      const eff = (n: SNode) => n.alpha * sm(n.appear);

      // lines: thin and soft, and they fade away as you zoom out
      const lineA = loc ? 0.34 : 0.04 + 0.2 * sm((k - 0.3) / 0.9);
      ctx.lineWidth = clamp(0.5 + k * 0.4, 0.6, 1.1);
      if (lineA > 0.02) {
        type Seg = [[number, number], [number, number]];
        const bins: Seg[][] = [[], [], []];
        const hot: Seg[] = [];
        for (let i = 0; i < edges.length; i++) {
          const { a, b } = edges[i];
          const ea = eff(a),
            eb = eff(b);
          const m = Math.min(ea, eb);
          if (m < 0.03) continue;
          if (
            (a.sx < -40 && b.sx < -40) ||
            (a.sx > w + 40 && b.sx > w + 40) ||
            (a.sy < -40 && b.sy < -40) ||
            (a.sy > h + 40 && b.sy > h + 40)
          )
            continue;
          const seg: Seg = [
            [a.sx, a.sy],
            [b.sx, b.sy],
          ];
          if (focus > 0.01 && (a.id === fId || b.id === fId)) hot.push(seg);
          else bins[m > 0.66 ? 0 : m > 0.33 ? 1 : 2].push(seg);
        }
        const alphas = [1, 0.55, 0.22];
        bins.forEach((segs, bi) => {
          if (!segs.length) return;
          ctx.strokeStyle = `rgba(165,175,210,${(lineA * alphas[bi]).toFixed(3)})`;
          ctx.beginPath();
          segs.forEach(([p, q]) => {
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(q[0], q[1]);
          });
          ctx.stroke();
        });
        if (hot.length) {
          ctx.strokeStyle = `rgba(215,222,250,${(0.55 * focus + lineA * (1 - focus)).toFixed(3)})`;
          ctx.beginPath();
          hot.forEach(([p, q]) => {
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(q[0], q[1]);
          });
          ctx.stroke();
        }
      }

      // glow: gets bigger and brighter when zoomed out, so the whole graph melts into one soft cluster.
      // It is blurry by nature, so it is painted at half size and stretched, which keeps it cheap on an iPad.
      const gw = Math.ceil(w / 2),
        gh = Math.ceil(h / 2);
      if (!glowCv || glowCv.width !== gw || glowCv.height !== gh) {
        glowCv = document.createElement('canvas');
        glowCv.width = gw;
        glowCv.height = gh;
        glowCtx = glowCv.getContext('2d');
      }
      const gx = glowCtx as CanvasRenderingContext2D;
      gx.setTransform(1, 0, 0, 1, 0, 0);
      gx.globalCompositeOperation = 'source-over';
      gx.globalAlpha = 1;
      gx.clearRect(0, 0, gw, gh);
      gx.globalCompositeOperation = 'lighter';
      const glowGain = 1.5 + 1.5 * (1 - zoomT);
      const glowAlpha = 0.2 + 0.5 * (1 - zoomT);
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        const e = eff(n);
        if (e < 0.03) continue;
        const R = (n.rs + 9) * glowGain;
        if (n.sx < -R || n.sx > w + R || n.sy < -R || n.sy > h + R) continue;
        gx.globalAlpha = Math.min(1, e * glowAlpha * (n.g.type === 'highlight' ? 0.8 : 1));
        gx.drawImage(sprites[n.g.type], (n.sx - R) / 2, (n.sy - R) / 2, R, R);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;
      ctx.drawImage(glowCv, 0, 0, w, h);

      // the dots themselves: flat and crisp
      ctx.globalCompositeOperation = 'source-over';
      const labelCands: SNode[] = [];
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        const e = eff(n);
        if (e < 0.03) continue;
        if (n.sx < -30 || n.sx > w + 30 || n.sy < -30 || n.sy > h + 30) continue;
        ctx.globalAlpha = e;
        ctx.fillStyle = TYPE_META[n.g.type].color;
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, n.rs, 0, Math.PI * 2);
        ctx.fill();
        counts[n.g.type] = (counts[n.g.type] ?? 0) + 1;
        if (e > 0.12) labelCands.push(n);
      }

      // rings: the centre of a local graph, the selected dot, and a pulse after "zoom to"
      const ring = (n: SNode, extra: number, a: number, wdt = 1.4) => {
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#f4f4fa';
        ctx.lineWidth = wdt;
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, n.rs + extra, 0, Math.PI * 2);
        ctx.stroke();
      };
      if (P.centerId && nodes.get(P.centerId)) ring(nodes.get(P.centerId)!, 4, 0.85);
      if (P.selectedId && nodes.get(P.selectedId)) ring(nodes.get(P.selectedId)!, 5, 0.9);
      if (hoverId && nodes.get(hoverId)) ring(nodes.get(hoverId)!, 4, 0.6, 1.2);
      if (pulse) {
        const t = (now - pulse.t0) / 1100;
        const n = nodes.get(pulse.id);
        if (t < 1 && n) {
          ring(n, 6 + t * 26, (1 - t) * 0.8, 1.6);
          busy = true;
        } else pulse = null;
      }

      // labels fade in as you zoom, important ones first, and never on top of each other
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      const placed: [number, number, number, number][] = [];
      const wants: { n: SNode; a: number; pr: number; must: boolean }[] = [];
      labelCands.forEach((n) => {
        let a = sm((k - n.labelZoom + 0.3) / 0.6);
        const related = fId ? focusNb.has(n.id) : false;
        if (related) a = 1;
        else if (focus > 0.01) a *= 1 - focus;
        const must = n.id === P.selectedId || n.id === P.centerId || n.id === hoverId;
        if (must) a = 1;
        if (a < 0.03) return;
        wants.push({ n, a, must, pr: (must ? 1e7 : 0) + (related ? 1e5 : 0) + n.g.deg * 10 + n.r });
      });
      wants.sort((p, q) => q.pr - p.pr);
      for (let i = 0; i < wants.length && i < 240; i++) {
        const { n, a, must } = wants[i];
        let text = n.g.label;
        if (text.length > 30) text = text.slice(0, 29) + '…';
        let tw = labelW.get(text);
        if (tw === undefined) {
          tw = ctx.measureText(text).width;
          labelW.set(text, tw);
        }
        const x0 = n.sx - tw / 2 - 3,
          y0 = n.sy + n.rs + 3,
          x1 = n.sx + tw / 2 + 3,
          y1 = y0 + 16;
        if (x1 < 0 || x0 > w || y1 < 0 || y0 > h) continue;
        let clash = false;
        for (let j = 0; j < placed.length; j++) {
          const p = placed[j];
          if (x0 < p[2] && x1 > p[0] && y0 < p[3] && y1 > p[1]) {
            clash = true;
            break;
          }
        }
        if (clash && !must) continue;
        placed.push([x0, y0, x1, y1]);
        ctx.globalAlpha = a * 0.94;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(8,8,11,0.85)';
        ctx.strokeText(text, n.sx, y0 + 12);
        ctx.fillStyle = '#e9e9f1';
        ctx.fillText(text, n.sx, y0 + 12);
      }
      ctx.globalAlpha = 1;

      const ds = `${k.toFixed(2)}|${Object.entries(counts).map(([t, c]) => `${t}:${c}`).sort().join(',')}`;
      if (ds !== lastDataset) {
        lastDataset = ds;
        wrap.dataset.k = k.toFixed(2);
        wrap.dataset.drawn = Object.entries(counts).map(([t, c]) => `${t}:${c}`).sort().join(',');
      }

      if (busy || sim.alpha() > sim.alphaMin()) request();
    }

    // ── pointer: hover, drag, pan, pinch, tap ──
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; k0: number; wx: number; wy: number } | null = null;
    let down: { x: number; y: number; t: number; node: SNode | null; type: string; moved: boolean; mode: 'node' | 'pan' } | null = null;

    const localPt = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const hit = (px: number, py: number): SNode | null => {
      let best: SNode | null = null;
      let bd = Infinity;
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        if (n.alpha * sm(n.appear) < 0.3) continue;
        const dx = n.sx - px,
          dy = n.sy - py;
        const rad = Math.max(n.rs, 6) + 4;
        const d2 = dx * dx + dy * dy;
        if (d2 <= rad * rad && d2 < bd) {
          bd = d2;
          best = n;
        }
      }
      return best;
    };
    const showPreview = (n: SNode | null, touch: boolean) => {
      if (!n) return setPreview(null);
      setPreview({ g: n.g, x: n.sx, y: n.sy, touch });
    };
    const toWorld = (px: number, py: number) => ({ x: (px - size.w / 2) / cam.k + cam.x, y: (py - size.h / 2) / cam.k + cam.y });

    const onDown = (e: PointerEvent) => {
      const p = localPt(e);
      pointers.set(e.pointerId, p);
      canvas.setPointerCapture(e.pointerId);
      stopAnim();
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const mx = (a.x + b.x) / 2,
          my = (a.y + b.y) / 2;
        const wp = toWorld(mx, my);
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), k0: cam.k, wx: wp.x, wy: wp.y };
        if (down?.node) {
          down.node.fx = down.node.fy = null;
          sim.alphaTarget(0);
        }
        down = null;
        hoverId = null;
        setPreview(null);
        return;
      }
      const node = hit(p.x, p.y);
      const draggable = !(isLocal() && e.pointerType === 'touch');
      down = { x: p.x, y: p.y, t: performance.now(), node, type: e.pointerType, moved: false, mode: node && draggable ? 'node' : 'pan' };
      if (down.mode === 'pan' && isLocal() && e.pointerType === 'touch') down = { ...down, mode: 'pan' };
    };

    const onMove = (e: PointerEvent) => {
      const p = localPt(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);

      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const mx = (a.x + b.x) / 2,
          my = (a.y + b.y) / 2;
        const k1 = clamp(pinch.k0 * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.dist)), KMIN, KMAX);
        cam.k = k1;
        cam.x = pinch.wx - (mx - size.w / 2) / k1;
        cam.y = pinch.wy - (my - size.h / 2) / k1;
        request();
        return;
      }

      if (down) {
        const dx = p.x - down.x,
          dy = p.y - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 5) {
          down.moved = true;
          hoverId = null;
          touchId = null;
          setPreview(null);
          if (down.mode === 'node' && down.node) sim.alphaTarget(0.25).restart();
        }
        if (down.moved) {
          if (down.mode === 'node' && down.node) {
            const w = toWorld(p.x, p.y);
            down.node.fx = w.x;
            down.node.fy = w.y;
          } else {
            const lastX = (down as unknown as { lx?: number }).lx ?? down.x;
            const lastY = (down as unknown as { ly?: number }).ly ?? down.y;
            cam.x -= (p.x - lastX) / cam.k;
            cam.y -= (p.y - lastY) / cam.k;
          }
          (down as unknown as { lx: number; ly: number }).lx = p.x;
          (down as unknown as { lx: number; ly: number }).ly = p.y;
          wrap.style.cursor = 'grabbing';
          request();
        }
        return;
      }

      if (e.pointerType === 'mouse') {
        const n = hit(p.x, p.y);
        const id = n ? n.id : null;
        wrap.style.cursor = n ? 'pointer' : 'grab';
        if (id !== hoverId) {
          hoverId = id;
          showPreview(n, false);
          request();
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      const p = localPt(e);
      pointers.delete(e.pointerId);
      if (pinch) {
        if (pointers.size < 2) pinch = null;
        return;
      }
      const d = down;
      down = null;
      if (!d) return;
      if (d.node && d.mode === 'node') {
        d.node.fx = d.node.fy = null;
        sim.alphaTarget(0);
      }
      wrap.style.cursor = 'grab';
      const tap = !d.moved && performance.now() - d.t < 600;
      if (!tap) return;
      const P = propsRef.current;
      const n = d.node;
      if (!n) {
        touchId = null;
        setPreview(null);
        P.onSelect?.(null);
        request();
        return;
      }
      const activate = () => {
        if (n.g.type === 'tag') {
          P.onSelect?.(n.g);
          const ids = [n.id, ...(adj.get(n.id) ?? [])];
          const set = ids.map((i) => nodes.get(i)).filter(Boolean) as SNode[];
          const t = fitTarget(set);
          if (t) animateTo({ ...t, k: Math.min(t.k, 2.4) });
        } else P.onOpen(n.g);
      };
      if (d.type === 'touch') {
        if (touchId === n.id) {
          touchId = null;
          setPreview(null);
          activate();
        } else {
          touchId = n.id;
          showPreview(n, true);
        }
        request();
      } else {
        activate();
      }
      void p;
    };

    const onLeave = () => {
      if (down) return;
      hoverId = null;
      setPreview((p) => (p && !p.touch ? null : p));
      request();
    };

    const onWheel = (e: WheelEvent) => {
      if (isLocal() && !e.ctrlKey && !e.metaKey) return; // let the page scroll
      e.preventDefault();
      stopAnim();
      const p = localPt(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018)));
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const handle: GraphHandle = {
      fit,
      zoomBy: (f) => {
        const k1 = clamp(cam.k * f, KMIN, KMAX);
        animateTo({ x: cam.x, y: cam.y, k: k1 }, 300);
      },
      focusNode: (id) => {
        const n = nodes.get(id);
        if (!n) return;
        animateTo({ x: n.x, y: n.y, k: Math.max(cam.k, 2.6) }, 700);
        pulse = { id, t0: performance.now() + 500 };
      },
      focusIds: (ids) => {
        const set = ids.map((i) => nodes.get(i)).filter(Boolean) as SNode[];
        const t = fitTarget(set);
        if (t) animateTo({ ...t, k: Math.min(t.k, 2.4) });
      },
    };
    engineRef.current = { sync, handle, request };
    // Test aid: with localStorage graph_debug=1, tests can ask where a dot is on screen.
    try {
      if (localStorage.getItem('graph_debug')) {
        (window as unknown as { __graph?: unknown }).__graph = {
          pos: (type: string, nth = 0) => {
            const c = list.filter((n) => n.g.type === type && n.alpha > 0.9 && n.sx > 40 && n.sx < size.w - 40 && n.sy > 40 && n.sy < size.h - 40).sort((a, b) => b.g.deg - a.g.deg);
            const n = c[nth];
            return n ? { id: n.id, ref: n.g.ref, x: n.sx, y: n.sy, label: n.g.label, deg: n.g.deg } : null;
          },
          k: () => cam.k,
        };
      }
    } catch {
      /* no storage: no debug hook */
    }
    request();

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      sim.stop();
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.sync(props.nodes, props.links);
  }, [props.nodes, props.links]);

  useEffect(() => {
    engineRef.current?.request();
  }, [props.highlightMode, props.forceShow, props.selectedId, props.centerId]);

  useEffect(() => {
    if (!props.fitToken) return;
    const t = setTimeout(() => engineRef.current?.handle.fit(true), 700);
    return () => clearTimeout(t);
  }, [props.fitToken]);

  const g = preview?.g;
  const cardW = 280;
  const left = preview ? (preview.x + 18 + cardW > box.w ? Math.max(8, preview.x - 18 - cardW) : preview.x + 18) : 0;
  const top = preview ? clamp(preview.y - 24, 8, Math.max(8, box.h - 190)) : 0;

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full overflow-hidden ${props.className ?? ''}`}
      style={{ background: 'radial-gradient(ellipse 75% 75% at 50% 50%, #121219 0%, #07070a 100%)', cursor: 'grab' }}
    >
      <canvas ref={canvasRef} className="block" style={{ touchAction: local ? 'pan-y' : 'none' }} />
      {g && preview && (
        <div className="g-card" style={{ left, top, width: cardW, pointerEvents: preview.touch ? 'auto' : 'none' }}>
          <div className="flex items-center gap-2">
            <span className="g-dot" style={{ background: TYPE_META[g.type].color, boxShadow: `0 0 10px ${TYPE_META[g.type].color}` }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'rgb(255 255 255 / 0.55)' }}>
              {g.type === 'tag' ? 'Tag' : g.type}
            </span>
          </div>
          <div className="mt-1.5 line-clamp-2 text-[14.5px] font-semibold leading-snug">{g.label}</div>
          <div className="mt-1 line-clamp-3 text-[12.5px] leading-snug" style={{ color: 'rgb(255 255 255 / 0.62)' }}>
            {g.preview}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11.5px]" style={{ color: 'rgb(255 255 255 / 0.45)' }}>
            <span>
              {g.deg} {g.deg === 1 ? 'connection' : 'connections'}
            </span>
            {g.type !== 'tag' && <span>{new Date(g.when).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          </div>
          {preview.touch && (
            <button
              type="button"
              className="g-open"
              onClick={() => {
                propsRef.current.onOpen(g);
                setPreview(null);
              }}
            >
              {g.type === 'tag' ? 'Focus' : 'Open'}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default GraphCanvas;