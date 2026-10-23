'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface SearchHit {
  page: number;
  index: number; // which match this is on its page, in reading order
  before: string;
  match: string;
  after: string;
}

// Turns what you typed into a pattern that ignores case and treats any run of
// spaces or line breaks as one space.
export function buildFindRegex(query: string): RegExp | null {
  const t = query.trim();
  if (t.length < 2) return null;
  const src = t
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return new RegExp(src, 'gi');
}

// Reads the text of every page once, in the background, then searches it instantly.
export function useBookSearch(pdf: PDFDocumentProxy | null, enabled: boolean) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [texts, setTexts] = useState<string[] | null>(null);
  const [progress, setProgress] = useState(0);
  const cache = useRef<{ pdf: PDFDocumentProxy; texts: string[] } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!enabled || !pdf) return;
    if (cache.current?.pdf === pdf) {
      setTexts(cache.current.texts);
      return;
    }
    let cancelled = false;
    setTexts(null);
    setProgress(0);
    (async () => {
      const out: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        if (cancelled) return;
        try {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          out.push(
            content.items
              .map((item) => ('str' in item ? item.str : ''))
              .join(' ')
              .replace(/\s+/g, ' ')
          );
        } catch {
          out.push('');
        }
        if (p % 4 === 0) setProgress(p / pdf.numPages);
      }
      if (cancelled) return;
      cache.current = { pdf, texts: out };
      setTexts(out);
      setProgress(1);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, pdf]);

  const regex = useMemo(() => buildFindRegex(debounced), [debounced]);

  const hits = useMemo(() => {
    if (!regex || !texts) return [] as SearchHit[];
    const out: SearchHit[] = [];
    for (let i = 0; i < texts.length && out.length < 600; i++) {
      const t = texts[i];
      const rx = new RegExp(regex.source, 'gi');
      let n = 0;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(t)) && out.length < 600) {
        if (!m[0]) {
          rx.lastIndex++;
          continue;
        }
        out.push({
          page: i + 1,
          index: n++,
          before: t.slice(Math.max(0, m.index - 40), m.index),
          match: m[0],
          after: t.slice(m.index + m[0].length, m.index + m[0].length + 60),
        });
      }
    }
    return out;
  }, [regex, texts]);

  const hasText = !!texts && texts.some((t) => t.trim().length > 0);

  return { query, setQuery, regex, hits, ready: !!texts, progress, hasText };
}