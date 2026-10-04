'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useNotes } from './useNotes';
import EditorToolbar from './EditorToolbar';
import { isSupabaseConfigured } from '@/lib/supabase';

function timeAgo(ts: string): string {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

export default function NotesModule() {
  const { notes, loading, error, createNote, updateNote, deleteNote } = useNotes();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = notes.find((n) => n.id === selectedId) || null;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (selectedId) updateNote(selectedId, { content: editor.getJSON() });
    },
  });

  useEffect(() => {
    if (!selectedId && notes.length > 0) {
      setSelectedId(notes[0].id);
    }
  }, [notes, selectedId]);

  useEffect(() => {
    if (!editor) return;
    if (selected) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.commands.setContent((selected.content as any) || '', { emitUpdate: false });
    } else {
      editor.commands.setContent('', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editor]);

  async function handleCreate() {
    const note = await createNote();
    if (note) setSelectedId(note.id);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return;
    deleteNote(id);
    if (selectedId === id) {
      const remaining = notes.filter((n) => n.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="h-full flex items-center justify-center text-center px-6" style={{ background: 'var(--bg)' }}>
        <div className="max-w-sm">
          <div className="text-2xl mb-3">⚠️</div>
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
            Database not connected
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            Add your Supabase env vars to <code>.env.local</code>, then restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm" style={{ background: 'var(--bg)', color: 'var(--text-dim)' }}>
        Loading notes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-center px-6" style={{ background: 'var(--bg)' }}>
        <div>
          <div className="text-red-400 text-sm mb-2">Couldn&apos;t load notes</div>
          <div className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>{error}</div>
          {error.includes('relation') && (
            <p className="text-xs mt-3 max-w-xs" style={{ color: 'var(--text-faint)' }}>
              This usually means the &quot;notes&quot; table hasn&apos;t been created in Supabase yet.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex" style={{ background: 'var(--bg)' }}>
      <div
        className="w-[230px] shrink-0 border-r flex flex-col hidden md:flex"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleCreate}
            className="w-full text-sm font-medium rounded-lg py-2"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
          >
            + New note
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {notes.length === 0 && (
            <div className="text-xs text-center py-10 px-3" style={{ color: 'var(--text-faint)' }}>
              No notes yet. Create your first one above.
            </div>
          )}
          {notes.map((n) => (
            <div
              key={n.id}
              onClick={() => setSelectedId(n.id)}
              className="group relative rounded-lg px-3 py-2.5 cursor-pointer mb-1"
              style={
                selectedId === n.id
                  ? { background: 'var(--surface)' }
                  : { background: 'transparent' }
              }
            >
              <div
                className="text-sm font-medium truncate pr-5"
                style={{ color: 'var(--text)' }}
              >
                {n.title || 'Untitled'}
              </div>
              <div className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>
                {timeAgo(n.updated_at)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(n.id);
                }}
                className="absolute top-2 right-2 w-5 h-5 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs"
                style={{ color: 'var(--text-faint)' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <div>
              <div className="text-2xl mb-3">📝</div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
                {notes.length === 0 ? 'No notes yet.' : 'Select a note or create one.'}
              </p>
              <button
                onClick={handleCreate}
                className="text-sm font-medium rounded-lg px-4 py-2"
                style={{ background: 'var(--text)', color: 'var(--bg)' }}
              >
                + New note
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              value={selected.title}
              onChange={(e) => updateNote(selected.id, { title: e.target.value })}
              placeholder="Untitled"
              className="text-xl font-semibold px-6 pt-6 pb-2 outline-none bg-transparent"
              style={{ color: 'var(--text)' }}
            />
            <EditorToolbar editor={editor} />
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <EditorContent editor={editor} className="tiptap-content" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}