'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Collection, CollectionColor } from '@/lib/types';
import { COLLECTION_COLORS } from './helpers';

// Named groups of books (Money, Engineering, Psychology…). A book sits in at most one.
export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<Collection[]>([]);
  ref.current = collections;

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('book_collections')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setCollections((data as Collection[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const create = useCallback(async (name: string, color?: CollectionColor): Promise<Collection | null> => {
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!clean) return null;
    const existing = ref.current.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    const row: Collection = {
      id: crypto.randomUUID(),
      name: clean,
      color: color ?? COLLECTION_COLORS[ref.current.length % COLLECTION_COLORS.length],
      created_at: new Date().toISOString(),
    };
    setCollections((prev) => [...prev, row]);
    const { error } = await supabase.from('book_collections').insert(row);
    if (error) {
      setCollections((prev) => prev.filter((c) => c.id !== row.id));
      setError(error.message);
      return null;
    }
    return row;
  }, []);

  const rename = useCallback(async (id: string, name: string) => {
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!clean) return;
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name: clean } : c)));
    await supabase.from('book_collections').update({ name: clean }).eq('id', id);
  }, []);

  const recolor = useCallback(async (id: string, color: CollectionColor) => {
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
    await supabase.from('book_collections').update({ color }).eq('id', id);
  }, []);

  const remove = useCallback(async (id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('book_collections').delete().eq('id', id);
  }, []);

  return { collections, error, create, rename, recolor, remove };
}