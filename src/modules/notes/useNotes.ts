'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Note } from '@/lib/types';
import { extractPlainText } from './helpers';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Only the very first load (or an explicit retry) shows the loading state.
  // Realtime refreshes happen quietly in the background.
  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
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
    load(true);

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

  // Debounced per-note save so we're not hitting the DB on every keystroke.
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Set<string>>(new Set());
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'color' | 'folder_id'>>) => {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n))
      );

      pending.current.add(id);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      setSaveState('saving');

      if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
      saveTimers.current[id] = setTimeout(async () => {
        const dbPatch: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
        if ('content' in patch) {
          dbPatch.search_text = extractPlainText(patch.content);
        }
        const { error } = await supabase.from('notes').update(dbPatch).eq('id', id);
        pending.current.delete(id);

        if (error) {
          setSaveState('error');
          return;
        }
        if (pending.current.size === 0) {
          setSaveState('saved');
          idleTimer.current = setTimeout(() => setSaveState('idle'), 1800);
        }
      }, 600);
    },
    []
  );

  // Journal entries are just notes with is_journal=true and a journal_date.
  // One per calendar day, enforced by a unique index in the DB — this
  // fetches today's (or any date's) entry, creating it if it doesn't exist.
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
      // Likely a race from the unique index if opened in two tabs at once —
      // fall back to fetching whatever got created.
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

  const deleteNote = useCallback(
    async (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) load();
    },
    [load]
  );

  return {
    notes,
    loading,
    error,
    saveState,
    reload: () => load(true),
    createNote,
    updateNote,
    deleteNote,
    getOrCreateJournalEntry,
  };
}