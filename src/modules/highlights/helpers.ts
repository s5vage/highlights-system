import { Highlight, HighlightColor } from '@/lib/types';

export const COLOR_HEX: Record<HighlightColor, string> = {
  yellow: '#d4b106',
  green: '#3f9142',
  blue: '#3b6fb6',
  pink: '#b6437e',
  gray: '#7a7a76',
};

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

export function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

export function readingTime(text: string): string {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min`;
}

export function exportMarkdown(items: Highlight[]) {
  const tagMap: Record<string, Highlight[]> = {};
  items.forEach((h) => {
    (h.tags || []).forEach((t) => {
      if (!tagMap[t]) tagMap[t] = [];
      tagMap[t].push(h);
    });
  });

  let md = `# My Highlights\n_Exported ${new Date().toLocaleDateString()}_\n\n`;

  const untagged = items.filter((h) => !(h.tags || []).length);
  if (untagged.length) {
    md += `## Untagged\n\n`;
    untagged.forEach((h) => {
      md += `> ${(h.text || '').replace(/\n/g, '\n> ')}\n\n_${timeAgo(h.created_at)} · ${h.url || ''}_\n\n---\n\n`;
    });
  }

  Object.entries(tagMap)
    .sort()
    .forEach(([tag, hs]) => {
      md += `## #${tag}\n\n`;
      hs.forEach((h) => {
        md += `> ${(h.text || '').replace(/\n/g, '\n> ')}\n\n_${timeAgo(h.created_at)} · ${h.url || ''}_\n\n---\n\n`;
      });
    });

  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `highlights-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}