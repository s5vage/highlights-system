'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Note } from '@/lib/types';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setNotes((data as Note[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('notes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const createNote = useCallback(async (folderId: string | null = null): Promise<Note | null> => {
    const { data, error } = await supabase
      .from('notes')
      .insert({ title: 'Untitled', content: null, tags: [], folder_id: folderId })
      .select()
      .single();

    if (error) {
      setError(error.message);
      return null;
    }
    setNotes((prev) => [data as Note, ...prev]);
    return data as Note;
  }, []);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'color' | 'folder_id'>>) => {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n))
      );

      if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
      saveTimers.current[id] = setTimeout(async () => {
        await supabase
          .from('notes')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', id);
      }, 600);
    },
    []
  );

  const getOrCreateJournalEntry = useCallback(async (dateStr: string): Promise<Note | null> => {
    const { data: existing } = await supabase
      .from('notes')
      .select('*')
      .eq('journal_date', dateStr)
      .eq('is_journal', true)
      .maybeSingle();

    if (existing) return existing as Note;

    const title = new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const { data, error } = await supabase
      .from('notes')
      .insert({
        title,
        content: null,
        tags: [],
        is_journal: true,
        journal_date: dateStr,
      })
      .select()
      .single();

    if (error) {
      const { data: fallback } = await supabase
        .from('notes')
        .select('*')
        .eq('journal_date', dateStr)
        .eq('is_journal', true)
        .maybeSingle();
      if (fallback) return fallback as Note;
      setError(error.message);
      return null;
    }

    setNotes((prev) => [data as Note, ...prev]);
    return data as Note;
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) load();
  }, [load]);

  return { notes, loading, error, createNote, updateNote, deleteNote, getOrCreateJournalEntry };
}