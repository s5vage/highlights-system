'use client';

import { useEffect, useRef } from 'react';
import { bestTitleMatch, normTitle } from './linkResolve';
import { useGraphData } from './graphData';

type OpenFn = (module: 'notes' | 'highlights' | 'library' | 'graph', id?: string) => void;

// Put this once in your page. When you click a [[link]] in a note whose text is a book's title
// (and not a note that has writing in it), it opens that book in the Library instead of
// making a new empty note.
export default function BookLinkHandler({ onOpenModule }: { onOpenModule: OpenFn }) {
  const { graph } = useGraphData();
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const openRef = useRef(onOpenModule);
  openRef.current = onOpenModule;

  useEffect(() => {
    // Returns the book id if this link should open a book.
    function bookFor(el: HTMLElement): string | null {
      const g = graphRef.current;
      if (!g) return null;
      const attr = el.getAttribute('data-wiki-link');
      const raw = attr && attr !== 'true' ? attr : el.textContent || '';
      const title = normTitle(raw.replace(/^\[\[|\]\]$/g, ''));
      if (!title) return null;
      const notes = g.nodes.filter((n) => n.type === 'note');
      if (notes.some((n) => normTitle(n.label) === title && n.preview !== 'Empty note')) return null;
      const book = bestTitleMatch(g.nodes.filter((n) => n.type === 'book'), (n) => n.label, title);
      return book ? book.ref : null;
    }
    const linkOf = (e: Event) => (e.target as HTMLElement | null)?.closest?.('[data-wiki-link]') as HTMLElement | null;

    // The editor reacts to the mouse button going down, so stop it there for book links…
    function onDown(e: MouseEvent) {
      const el = linkOf(e);
      if (el && bookFor(el)) e.stopPropagation();
    }
    // …and open the book when the click completes.
    function onClick(e: MouseEvent) {
      const el = linkOf(e);
      if (!el) return;
      const id = bookFor(el);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        sessionStorage.setItem('lib_open_book', id);
      } catch {
        /* the Library just opens normally */
      }
      openRef.current('library');
      setTimeout(() => window.dispatchEvent(new Event('lib-open-book')), 150);
    }
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return null;
}