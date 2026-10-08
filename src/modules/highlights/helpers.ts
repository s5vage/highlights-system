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
  const d = new Date(ts);
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'Now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function fullDate(ts: string): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const KNOWN_HUES: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'gray'];

export function hueOf(color: string | null | undefined): HighlightColor {
  return KNOWN_HUES.includes(color as HighlightColor) ? (color as HighlightColor) : 'yellow';
}

// Highlights are captured as raw HTML from the page they came from. That HTML
// often carries inline colors (white text copied from a dark site, for
// example) that become unreadable on our cards, and it can contain scripts.
// Strip styling and anything unsafe, keep the structure (bold, lists, tables).
const DROP_TAGS =
  'script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,svg,canvas,video,audio';

export function cleanHtml(html: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/\s(style|class|on\w+)="[^"]*"/gi, '');
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(DROP_TAGS).forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const keep = ['href', 'src', 'alt', 'colspan', 'rowspan'].includes(attr.name.toLowerCase());
      if (!keep) el.removeAttribute(attr.name);
    }
    if (el.tagName === 'A') {
      if (/^\s*javascript:/i.test(el.getAttribute('href') || '')) el.removeAttribute('href');
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noreferrer');
    }
    if (el.tagName === 'IMG' && /^\s*javascript:/i.test(el.getAttribute('src') || '')) {
      el.removeAttribute('src');
    }
  });
  return doc.body.innerHTML;
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