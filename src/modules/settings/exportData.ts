import { supabase } from '@/lib/supabase';

interface Row {
  [key: string]: unknown;
}
interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: DocNode[];
}

async function all(table: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) return rows; // an optional table, e.g. no books yet
      throw new Error(`Couldn’t read your ${table}: ${error.message}`);
    }
    rows.push(...((data as Row[]) ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export interface Everything {
  notes: Row[];
  folders: Row[];
  highlights: Row[];
  books: Row[];
  collections: Row[];
  pageHighlights: Row[];
}

export async function fetchEverything(): Promise<Everything> {
  const [notes, folders, highlights, books, collections, pageHighlights] = await Promise.all([
    all('notes'),
    all('folders'),
    all('highlights'),
    all('books'),
    all('book_collections'),
    all('book_highlights'),
  ]);
  return { notes, folders, highlights, books, collections, pageHighlights };
}

// ── Notes: their editor format, turned into Markdown ──

const bare = (s: string) => s.replace(/^\[\[|\]\]$/g, '');

function inline(nodes: DocNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '  \n';
      let t = n.text ?? inline(n.content);
      (n.marks ?? []).forEach((m) => {
        if (m.type === 'bold') t = `**${t}**`;
        else if (m.type === 'italic') t = `*${t}*`;
        else if (m.type === 'strike') t = `~~${t}~~`;
        else if (m.type === 'code') t = '`' + t + '`';
        else if (m.type === 'highlight') t = `==${t}==`;
        else if (/wiki/i.test(m.type)) t = `[[${bare(String(m.attrs?.title ?? t))}]]`;
      });
      return t;
    })
    .join('');
}

function listItems(n: DocNode, depth: number): string {
  const pad = '  '.repeat(depth);
  return (n.content ?? [])
    .map((item, i) => {
      const prefix =
        n.type === 'orderedList' ? `${i + 1}. ` : n.type === 'taskList' ? (item.attrs?.checked ? '- [x] ' : '- [ ] ') : '- ';
      const parts = (item.content ?? []).map((c) => (c.type && /List$/.test(c.type) ? '\n' + listItems(c, depth + 1).replace(/\n$/, '') : inline(c.content)));
      return pad + prefix + parts.join('').replace(/^\n/, '').replace(/\n+$/, '') + '\n';
    })
    .join('');
}

function block(n: DocNode): string {
  switch (n.type) {
    case 'heading':
      return '#'.repeat(Math.min(6, Number(n.attrs?.level) || 1)) + ' ' + inline(n.content) + '\n\n';
    case 'paragraph':
      return inline(n.content) + '\n\n';
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return listItems(n, 0) + '\n';
    case 'blockquote':
      return (
        (n.content ?? [])
          .map(block)
          .join('')
          .trim()
          .split('\n')
          .map((l) => '> ' + l)
          .join('\n') + '\n\n'
      );
    case 'codeBlock':
      return '```' + (n.attrs?.language ?? '') + '\n' + inline(n.content) + '\n```\n\n';
    case 'horizontalRule':
      return '---\n\n';
    default:
      return (n.content ?? []).map(block).join('');
  }
}

export function toMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  return block(doc as DocNode).trim();
}

// ── Building the two files ──

const day = (s: unknown) => (typeof s === 'string' && s ? s.slice(0, 10) : '');

export function buildJson(d: Everything, email: string): string {
  const folderName = new Map(d.folders.map((f) => [String(f.id), String(f.name)]));
  const bookTitle = new Map(d.books.map((b) => [String(b.id), String(b.title)]));
  const collectionName = new Map(d.collections.map((c) => [String(c.id), String(c.name)]));
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      account: email,
      notes: d.notes.map((n) => ({
        title: n.title,
        folder: n.folder_id ? folderName.get(String(n.folder_id)) ?? null : null,
        tags: n.tags,
        journal_date: n.is_journal ? n.journal_date : null,
        created_at: n.created_at,
        updated_at: n.updated_at,
        text: toMarkdown(n.content),
        content: n.content,
      })),
      highlights: d.highlights.map((h) => ({ text: h.text, tags: h.tags, color: h.color, source: h.url || null, saved_at: h.created_at })),
      books: d.books.map((b) => ({
        title: b.title,
        author: b.author,
        pages: b.page_count,
        last_page_read: b.last_page,
        collection: b.collection_id ? collectionName.get(String(b.collection_id)) ?? null : null,
        tags: b.tags,
        added_at: b.created_at,
      })),
      page_highlights: d.pageHighlights.map((p) => ({ book: bookTitle.get(String(p.book_id)) ?? null, page: p.page, color: p.color, text: p.text, saved_at: p.created_at })),
      folders: d.folders.map((f) => f.name),
      collections: d.collections.map((c) => c.name),
    },
    null,
    2
  );
}

export function buildMarkdown(d: Everything, email: string): string {
  const folderName = new Map(d.folders.map((f) => [String(f.id), String(f.name)]));
  const out: string[] = [`# My notes and highlights`, '', `Exported ${new Date().toLocaleDateString()} for ${email}.`, '', `${d.notes.length} notes · ${d.highlights.length} highlights`, ''];

  out.push('---', '', '# Notes', '');
  const notes = [...d.notes].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  for (const n of notes) {
    const meta = [n.is_journal ? `Journal ${day(n.journal_date)}` : '', n.folder_id ? folderName.get(String(n.folder_id)) : '', Array.isArray(n.tags) && n.tags.length ? (n.tags as string[]).map((t) => '#' + t).join(' ') : '', day(n.updated_at) ? `edited ${day(n.updated_at)}` : '']
      .filter(Boolean)
      .join(' · ');
    out.push(`## ${n.title || 'Untitled'}`, '');
    if (meta) out.push(`*${meta}*`, '');
    const body = toMarkdown(n.content);
    if (body) out.push(body, '');
  }

  out.push('---', '', '# Highlights', '');
  const hl = [...d.highlights].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  for (const h of hl) {
    out.push(String(h.text ?? '').split('\n').map((l) => '> ' + l).join('\n'));
    const meta = [Array.isArray(h.tags) && h.tags.length ? (h.tags as string[]).map((t) => '#' + t).join(' ') : '', h.url ? String(h.url) : '', day(h.created_at)].filter(Boolean).join(' · ');
    if (meta) out.push('', `— ${meta}`);
    out.push('');
  }
  return out.join('\n');
}

export function download(filename: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}