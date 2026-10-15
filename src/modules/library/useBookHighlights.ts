'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Book, BookHighlight, HighlightColor, HlRect } from '@/lib/types';
import { escapeHtml } from '@/modules/highlights/helpers';
import { bookTag } from './helpers';

// Highlights drawn on a book's pages. Each one is also saved into the main
// Highlights system (same id), tagged with the book's name.
export function useBookHighlights(book: Book, notify: (message: string) => void) {
  const [items, setItems] = useState<BookHighlight[]>([]);
  const bookId = book.id;

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('book_highlights')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          notify(
            /does not exist/i.test(error.message)
              ? 'Highlights need the latest Library setup SQL in Supabase.'
              : 'Couldn’t load your highlights for this book.'
          );
          return;
        }
        setItems((data as BookHighlight[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const create = useCallback(
    async (input: { color: HighlightColor; text: string; rects: HlRect[] }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const row: BookHighlight = {
        id,
        book_id: bookId,
        page: input.rects[0].page,
        color: input.color,
        text: input.text,
        rects: input.rects,
        created_at: now,
      };
      setItems((prev) => [...prev, row]);

      const { error } = await supabase.from('book_highlights').insert(row);
      if (error) {
        setItems((prev) => prev.filter((h) => h.id !== id));
        notify(
          /does not exist/i.test(error.message)
            ? 'Highlights need the latest Library setup SQL in Supabase.'
            : 'Couldn’t save that highlight.'
        );
        return;
      }

      const mirrored = await supabase.from('highlights').insert({
        id,
        text: input.text,
        html: `<p>${escapeHtml(input.text)}</p>`,
        tags: [bookTag(book.title)],
        color: input.color,
        url: '',
        created_at: now,
      });
      if (mirrored.error) console.warn('Saved on the page, but not into Highlights:', mirrored.error.message);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookId, book.title]
  );

  const recolor = useCallback(async (id: string, color: HighlightColor) => {
    setItems((prev) => prev.map((h) => (h.id === id ? { ...h, color } : h)));
    await supabase.from('book_highlights').update({ color }).eq('id', id);
    await supabase.from('highlights').update({ color }).eq('id', id);
  }, []);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((h) => h.id !== id));
    await supabase.from('book_highlights').delete().eq('id', id);
    await supabase.from('highlights').delete().eq('id', id);
  }, []);

  return { items, create, recolor, remove };
}