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