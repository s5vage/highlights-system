export const normTitle = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

// Which item does a typed [[link]] mean? The exact title, or (for long enough text)
// the start of one, so a link doesn't have to repeat a whole long book title.
export function bestTitleMatch<T>(items: T[], getTitle: (item: T) => string, target: string): T | null {
  const t = normTitle(target);
  if (!t) return null;
  let best: T | null = null;
  let bestDiff = Infinity;
  for (const item of items) {
    const title = normTitle(getTitle(item));
    if (title === t) return item;
    if (t.length >= 8 && title.length >= 8 && (title.startsWith(t) || t.startsWith(title))) {
      const diff = Math.abs(title.length - t.length);
      if (diff < bestDiff) {
        best = item;
        bestDiff = diff;
      }
    }
  }
  return best;
}