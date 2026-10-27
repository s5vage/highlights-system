'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { bestTitleMatch } from './linkResolve';
export type NodeType = 'note' | 'book' | 'tag' | 'highlight';

export const TYPE_META: Record<NodeType, { label: string; color: string; rgb: [number, number, number] }> = {
  note: { label: 'Notes', color: '#5e9bef', rgb: [94, 155, 239] },
  book: { label: 'Books', color: '#4fc07a', rgb: [79, 192, 122] },
  highlight: { label: 'Highlights', color: '#f0c43a', rgb: [240, 196, 58] },
  tag: { label: 'Tags', color: '#a3a3b2', rgb: [163, 163, 178] },
};

export interface GNode {
  id: string; // "n:…" note, "b:…" book, "h:…" highlight, "t:…" tag
  type: NodeType;
  ref: string; // the id in its own table (for tags: the tag name)
  label: string;
  preview: string;
  when: number; // last edited (notes) or created, in ms
  deg: number; // connections in the whole graph
  journal?: boolean;
}
export interface GLink {
  source: string;
  target: string;
}
export interface Graph {
  nodes: GNode[];
  links: GLink[];
  adj: Map<string, Set<string>>;
}

interface RawNote {
  id: string;
  title: string | null;
  tags: string[] | null;
  is_journal: boolean | null;
  created_at: string;
  updated_at: string | null;
  search_text: string | null;
  content: unknown;
}
interface RawBook {
  id: string;
  title: string;
  author: string | null;
  tags: string[] | null;
  created_at: string;
  page_count: number | null;
}
interface RawHighlight {
  id: string;
  text: string | null;
  tags: string[] | null;
  created_at: string;
}
interface RawBH {
  id: string;
  book_id: string;
}
export interface Raw {
  notes: RawNote[];
  books: RawBook[];
  highlights: RawHighlight[];
  bookHighlights: RawBH[];
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

// Finds the [[Titles]] a note links to, whether they are stored as marks or as plain text.
function wikiTargets(content: unknown): string[] {
  const out: string[] = [];
  let text = '';
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; text?: string; marks?: { type?: string; attrs?: Record<string, unknown> }[]; content?: unknown[] };
    if (typeof n.text === 'string') {
      text += n.text;
      n.marks?.forEach((m) => {
        if (/wiki/i.test(m?.type ?? '')) {
          const t = m.attrs?.title ?? m.attrs?.target ?? m.attrs?.href ?? n.text;
          out.push(String(t));
        }
      });
    }
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
      text += '\n';
    }
  };
  walk(content);
  for (const m of text.matchAll(/\[\[([^\[\]]+)\]\]/g)) out.push(m[1]);
  return out.map((t) => norm(t.replace(/^\[\[|\]\]$/g, ''))).filter(Boolean);
}

export function buildGraph(raw: Raw): Graph {
  const nodes: GNode[] = [];
  const links: GLink[] = [];
  const seen = new Set<string>();
  const addLink = (a: string, b: string) => {
    if (a === b) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ source: a, target: b });
  };

  // Notes with real writing win a title; a book is next; an empty note with the same title comes last
  // (that is usually just a leftover from clicking a link).
  const noteByTitle = new Map<string, string>();
  const emptyNoteByTitle = new Map<string, string>();
  const bookList: { id: string; title: string }[] = raw.books.map((b) => ({ id: b.id, title: b.title }));
  const tagLabel = new Map<string, string>();
  const tagId = (raw: string): string | null => {
    const clean = raw.trim().replace(/^#+/, '').trim();
    if (!clean) return null;
    const id = `t:${clean.toLowerCase()}`;
    if (!tagLabel.has(id)) tagLabel.set(id, clean);
    return id;
  };

  raw.notes.forEach((n) => {
    const title = (n.title || 'Untitled').trim() || 'Untitled';
    const text = (n.search_text || '').replace(/\s+/g, ' ').trim();
    (text ? noteByTitle : emptyNoteByTitle).set(norm(title), `n:${n.id}`);
    nodes.push({
      id: `n:${n.id}`,
      type: 'note',
      ref: n.id,
      label: title,
      preview: text ? clip(text, 170) : 'Empty note',
      when: new Date(n.updated_at || n.created_at).getTime(),
      deg: 0,
      journal: !!n.is_journal,
    });
  });
  raw.books.forEach((b) => {

    nodes.push({
      id: `b:${b.id}`,
      type: 'book',
      ref: b.id,
      label: b.title,
      preview: [b.author, b.page_count ? `${b.page_count} pages` : null].filter(Boolean).join(' · ') || 'Book',
      when: new Date(b.created_at).getTime(),
      deg: 0,
    });
  });
  raw.highlights.forEach((h) => {
    const text = (h.text || '').replace(/\s+/g, ' ').trim();
    nodes.push({
      id: `h:${h.id}`,
      type: 'highlight',
      ref: h.id,
      label: clip(text || 'Highlight', 60),
      preview: clip(text, 230),
      when: new Date(h.created_at).getTime(),
      deg: 0,
    });
  });

  // Links between notes, and from notes to books, written as [[Title]].
  raw.notes.forEach((n) => {
    wikiTargets(n.content).forEach((t) => {
      const book = noteByTitle.has(t) ? null : bestTitleMatch(bookList, (x) => x.title, t);
      const target = noteByTitle.get(t) ?? (book ? `b:${book.id}` : null) ?? emptyNoteByTitle.get(t);
      if (target) addLink(`n:${n.id}`, target);
    });
    (n.tags ?? []).forEach((t) => {
      const id = tagId(t);
      if (id) addLink(`n:${n.id}`, id);
    });
  });
  raw.books.forEach((b) =>
    (b.tags ?? []).forEach((t) => {
      const id = tagId(t);
      if (id) addLink(`b:${b.id}`, id);
    })
  );
  raw.highlights.forEach((h) =>
    (h.tags ?? []).forEach((t) => {
      const id = tagId(t);
      if (id) addLink(`h:${h.id}`, id);
    })
  );
  // A highlight made inside a book belongs to that book.
  const bookIds = new Set(raw.books.map((b) => b.id));
  const hlIds = new Set(raw.highlights.map((h) => h.id));
  raw.bookHighlights.forEach((bh) => {
    if (bookIds.has(bh.book_id) && hlIds.has(bh.id)) addLink(`h:${bh.id}`, `b:${bh.book_id}`);
  });

  // Tag nodes, and who is connected to whom.
  const adj = new Map<string, Set<string>>();
  const touch = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  links.forEach((l) => {
    touch(l.source, l.target);
    touch(l.target, l.source);
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  tagLabel.forEach((label, id) => {
    const nb = [...(adj.get(id) ?? [])].map((x) => byId.get(x)).filter(Boolean) as GNode[];
    const count = (t: NodeType) => nb.filter((n) => n.type === t).length;
    const parts = [
      count('note') ? `${count('note')} ${count('note') === 1 ? 'note' : 'notes'}` : '',
      count('book') ? `${count('book')} ${count('book') === 1 ? 'book' : 'books'}` : '',
      count('highlight') ? `${count('highlight')} ${count('highlight') === 1 ? 'highlight' : 'highlights'}` : '',
    ].filter(Boolean);
    const node: GNode = {
      id,
      type: 'tag',
      ref: label,
      label: `#${label}`,
      preview: parts.join(' · ') || 'Tag',
      when: nb.reduce((m, n) => Math.max(m, n.when), 0),
      deg: 0,
    };
    nodes.push(node);
    byId.set(id, node);
  });
  nodes.forEach((n) => (n.deg = adj.get(n.id)?.size ?? 0));
  return { nodes, links, adj };
}

// ── Filters ──

export interface Filters {
  types: Record<NodeType, boolean>;
  highlightMode: 'auto' | 'on' | 'off';
  tags: string[]; // tag node ids
  from: number | null;
  to: number | null;
  orphans: 'show' | 'hide' | 'only';
  journal: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  types: { note: true, book: true, tag: true, highlight: true },
  highlightMode: 'auto',
  tags: [],
  from: null,
  to: null,
  orphans: 'show',
  journal: false,
};

export function filtersActive(f: Filters): boolean {
  return (
    f.tags.length > 0 ||
    f.from !== null ||
    f.to !== null ||
    f.orphans !== 'show' ||
    f.journal ||
    f.highlightMode !== 'auto' ||
    (Object.values(f.types) as boolean[]).some((v) => !v)
  );
}

// `pinned` nodes (from search) are always shown, whatever the filters say.
export function filterGraph(g: Graph, f: Filters, pinned: Set<string>): { nodes: GNode[]; links: GLink[] } {
  const dateOn = f.from !== null || f.to !== null;
  const keep = new Set<string>();

  g.nodes.forEach((n) => {
    if (n.type === 'tag') return;
    if (pinned.has(n.id)) return void keep.add(n.id);
    if (!f.types[n.type]) return;
    if (n.type === 'highlight' && f.highlightMode === 'off') return;
    if (n.journal && !f.journal) return;
    if (dateOn && ((f.from !== null && n.when < f.from) || (f.to !== null && n.when > f.to))) return;
    const orphan = n.deg === 0;
    if (f.orphans === 'hide' && orphan) return;
    if (f.orphans === 'only' && !orphan) return;
    keep.add(n.id);
  });

  if (f.tags.length) {
    const sel = new Set(f.tags);
    [...keep].forEach((id) => {
      if (pinned.has(id)) return;
      const nb = g.adj.get(id);
      if (!nb || ![...nb].some((x) => sel.has(x))) keep.delete(id);
    });
  }

  g.nodes.forEach((n) => {
    if (n.type !== 'tag') return;
    if (!f.types.tag && !pinned.has(n.id)) return;
    if (f.tags.length && !f.tags.includes(n.id) && !pinned.has(n.id)) return;
    const nb = g.adj.get(n.id);
    if (nb && [...nb].some((x) => keep.has(x))) keep.add(n.id);
  });

  return {
    nodes: g.nodes.filter((n) => keep.has(n.id)),
    links: g.links.filter((l) => keep.has(l.source) && keep.has(l.target)),
  };
}

export function searchNodes(g: Graph, q: string, limit = 8): GNode[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const scored: { n: GNode; score: number }[] = [];
  g.nodes.forEach((n) => {
    const label = n.label.toLowerCase();
    let score = 0;
    if (label.startsWith(s) || label.startsWith('#' + s)) score = 3;
    else if (label.includes(s)) score = 2;
    else if (n.preview.toLowerCase().includes(s)) score = 1;
    if (score) scored.push({ n, score: score * 1000 + Math.min(n.deg, 99) });
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.n);
}

// The neighbourhood of one node, for the small graph inside a note.
export function localSubgraph(g: Graph, centerId: string, depth: 1 | 2, cap = 90): { nodes: GNode[]; links: GLink[] } {
  if (!g.adj.has(centerId) && !g.nodes.some((n) => n.id === centerId)) return { nodes: [], links: [] };
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const keep = new Set<string>([centerId]);
  let frontier = [centerId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    frontier.forEach((id) =>
      g.adj.get(id)?.forEach((nb) => {
        if (!keep.has(nb)) {
          keep.add(nb);
          next.push(nb);
        }
      })
    );
    frontier = next;
  }
  let ids = [...keep];
  if (ids.length > cap) {
    ids = [centerId, ...ids.filter((i) => i !== centerId).sort((a, b) => (byId.get(b)?.deg ?? 0) - (byId.get(a)?.deg ?? 0)).slice(0, cap - 1)];
  }
  const set = new Set(ids);
  return {
    nodes: ids.map((i) => byId.get(i)).filter(Boolean) as GNode[],
    links: g.links.filter((l) => set.has(l.source) && set.has(l.target)),
  };
}

// ── Loading ──

async function fetchAll<T>(table: string, columns: string): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) return { rows, error: error.message };
    rows.push(...((data as unknown as T[]) ?? []));
    if (!data || data.length < 1000) break;
  }
  return { rows, error: null };
}

let cache: { at: number; raw: Raw } | null = null;

export function useGraphData() {
  const [raw, setRaw] = useState<Raw | null>(cache?.raw ?? null);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.at < 30_000) {
      setRaw(cache.raw);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [notes, books, highlights, bh] = await Promise.all([
      fetchAll<RawNote>('notes', 'id,title,tags,is_journal,created_at,updated_at,search_text,content'),
      fetchAll<RawBook>('books', 'id,title,author,tags,created_at,page_count'),
      fetchAll<RawHighlight>('highlights', 'id,text,tags,created_at'),
      fetchAll<RawBH>('book_highlights', 'id,book_id'),
    ]);
    // A missing optional table (for example no books yet) just means fewer dots.
    if (notes.error && books.error && highlights.error) {
      setError(notes.error);
    } else {
      const next: Raw = { notes: notes.rows, books: books.rows, highlights: highlights.rows, bookHighlights: bh.rows };
      cache = { at: Date.now(), raw: next };
      setRaw(next);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const graph = useMemo(() => (raw ? buildGraph(raw) : null), [raw]);
  return { graph, loading, error, reload: () => load(true) };
}