'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Highlight, Note, ModuleId } from '@/lib/types';

interface Props {
  onClose: () => void;
  onOpenModule: (id: ModuleId, focusId?: string) => void;
}

export default function GlobalSearch({ onClose, onOpenModule }: Props) {
  const [query, setQuery] = useState('');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setHighlights([]);
      setNotes([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();

      const [hlRes, noteRes] = await Promise.all([
        supabase
          .from('highlights')
          .select('*')
          .ilike('text', `%${q}%`)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('notes')
          .select('*')
          .or(`title.ilike.%${q}%,search_text.ilike.%${q}%`)
          .order('updated_at', { ascending: false })
          .limit(6),
      ]);

      setHighlights((hlRes.data as Highlight[]) ?? []);
      setNotes((noteRes.data as Note[]) ?? []);
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function openHighlight(h: Highlight) {
    onOpenModule('highlights', h.id);
    onClose();
  }

  function openNote(n: Note) {
    onOpenModule('notes', n.id);
    onClose();
  }

  const hasResults = highlights.length > 0 || notes.length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 backdrop-blur-sm"
      style={{ background: 'var(--overlay)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <span style={{ color: 'var(--text-faint)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Search highlights and notes…"
            className="flex-1 bg-transparent outline-none text-sm py-3.5"
            style={{ color: 'var(--text)' }}
          />
          <kbd className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
            esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length < 2 && (
            <div className="text-center text-xs py-8" style={{ color: 'var(--text-faint)' }}>
              Type at least 2 characters to search.
            </div>
          )}

          {query.trim().length >= 2 && !loading && !hasResults && (
            <div className="text-center text-xs py-8" style={{ color: 'var(--text-faint)' }}>
              No results for &quot;{query}&quot;.
            </div>
          )}

          {highlights.length > 0 && (
            <div className="mb-2">
              <div
                className="text-[10px] uppercase tracking-wider font-mono px-2 py-1"
                style={{ color: 'var(--text-faint)' }}
              >
                Highlights
              </div>
              {highlights.map((h) => (
                <button
                  key={h.id}
                  onClick={() => openHighlight(h)}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-sm hover:opacity-80"
                  style={{ color: 'var(--text)' }}
                >
                  <div className="truncate">{h.text}</div>
                </button>
              ))}
            </div>
          )}

          {notes.length > 0 && (
            <div>
              <div
                className="text-[10px] uppercase tracking-wider font-mono px-2 py-1"
                style={{ color: 'var(--text-faint)' }}
              >
                Notes
              </div>
              {notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNote(n)}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-sm hover:opacity-80"
                  style={{ color: 'var(--text)' }}
                >
                  <div className="font-medium truncate">{n.title || 'Untitled'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}