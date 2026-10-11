import { Note } from '@/lib/types';

export const NOTE_COLORS: { id: string; hex: string; label: string }[] = [
  { id: 'yellow', hex: '#d4b106', label: 'Yellow' },
  { id: 'green', hex: '#3f9142', label: 'Green' },
  { id: 'blue', hex: '#3b6fb6', label: 'Blue' },
  { id: 'pink', hex: '#b6437e', label: 'Pink' },
  { id: 'gray', hex: '#7a7a76', label: 'Gray' },
];

export const HIGHLIGHT_MARKER_COLORS: { id: string; hex: string }[] = [
  { id: 'yellow', hex: '#fef08a' },
  { id: 'green', hex: '#bbf7d0' },
  { id: 'blue', hex: '#bfdbfe' },
  { id: 'pink', hex: '#fbcfe8' },
];

export const FONT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: "'SF Mono', Menlo, Consolas, monospace" },
  { label: 'Rounded', value: "'SF Pro Rounded', ui-rounded, sans-serif" },
];

export function colorHex(id: string | null | undefined): string | null {
  if (!id) return null;
  return NOTE_COLORS.find((c) => c.id === id)?.hex ?? null;
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatJournalDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractPlainText(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(extractPlainText).join(' ');
  }
  return '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractWikiLinkTitles(node: any, acc: string[] = []): string[] {
  if (!node) return acc;
  if (
    typeof node.text === 'string' &&
    Array.isArray(node.marks) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node.marks.some((m: any) => m.type === 'wikiLink')
  ) {
    acc.push(node.text);
  }
  if (Array.isArray(node.content)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node.content.forEach((child: any) => extractWikiLinkTitles(child, acc));
  }
  return acc;
}

export function timeAgo(ts: string): string {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

// ─── Notes UI helpers ───

const HUE_IDS = ['yellow', 'green', 'blue', 'pink', 'gray'];

export function hueVar(id: string | null | undefined): string | null {
  return id && HUE_IDS.includes(id) ? `var(--hue-${id})` : null;
}

export function previewOf(content: unknown): string {
  return extractPlainText(content).replace(/\s+/g, ' ').trim();
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function editedLabel(ts: string): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
}

// Apple Notes style: time for today, weekday for this week, short date after.
export function rowDate(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (d.getTime() >= startOfToday - 6 * 86400000) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: '2-digit' }),
  });
}

export function groupByRecency(notes: Note[]): { label: string; items: Note[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();
  const day = 86400000;
  const buckets = [
    { label: 'Today', min: t0 },
    { label: 'Yesterday', min: t0 - day },
    { label: 'Previous 7 days', min: t0 - 7 * day },
    { label: 'Previous 30 days', min: t0 - 30 * day },
    { label: 'Earlier', min: -Infinity },
  ];
  const groups = buckets.map((b) => ({ label: b.label, items: [] as Note[] }));
  notes.forEach((n) => {
    const t = new Date(n.updated_at).getTime();
    groups[buckets.findIndex((b) => t >= b.min)].items.push(n);
  });
  return groups.filter((g) => g.items.length > 0);
}