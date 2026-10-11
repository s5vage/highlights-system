import { Book } from '@/lib/types';

export function titleFromFilename(name: string): string {
  const t = name.replace(/\.pdf$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return t || 'Untitled book';
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// 0 to 100, based on the page you last left off at.
export function progressOf(b: Book): number {
  if (b.page_count <= 1) return 0;
  const pct = ((b.last_page - 1) / (b.page_count - 1)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export const isFinished = (b: Book) => b.page_count > 1 && b.last_page >= b.page_count;
export const isStarted = (b: Book) => b.last_page > 1;

const COVER_HUES = ['yellow', 'green', 'blue', 'pink', 'purple', 'gray'];

// A stable color for books that have no cover image.
export function hueForTitle(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return COVER_HUES[h % COVER_HUES.length];
}