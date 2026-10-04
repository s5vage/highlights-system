'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { useNotes } from './useNotes';
import { useFolders } from './useFolders';
import EditorToolbar from './EditorToolbar';
import { WikiLink } from './WikiLinkMark';
import {
  NOTE_COLORS,
  colorHex,
  timeAgo,
  toDateStr,
  formatJournalDate,
  extractWikiLinkTitles,
} from './helpers';
import { isSupabaseConfigured } from '@/lib/supabase';

interface Props {
  pendingId?: string | null;
  onConsumedPending?: () => void;
}

export default function NotesModule({ pendingId, onConsumedPending }: Props = {}) {
  const { notes, loading, error, createNote, updateNote, deleteNote, getOrCreateJournalEntry } = useNotes();
  const { folders, createFolder, deleteFolder } = useFolders();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null | 'all'>('all');
  const [journalMode, setJournalMode] = useState(false);
  const [journalDate, setJournalDate] = useState<string>(toDateStr(new Date()));

  const journalEntries = [...notes]
    .filter((n) => n.is_journal)
    .sort((a, b) => (b.journal_date || '').localeCompare(a.journal_date || ''));

  const selected = notes.find((n) => n.id === selectedId) || null;

  const backlinks = selected
    ? notes.filter(
        (n) =>
          n.id !== selected.id &&
          extractWikiLinkTitles(n.content).some(
            (t) => t.trim().toLowerCase() === selected.title.trim().toLowerCase()
          )
      )
    : [];

  function navigateToTitle(title: string) {
    const match = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
    if (match) {
      setJournalMode(false);
      setSelectedId(match.id);
    } else if (confirm(`No note titled "${title}" yet. Create it?`)) {
      createNote().then((note) => {
        if (note) {
          updateNote(note.id, { title });
          setJournalMode(false);
          setSelectedId(note.id);
        }
      });
    }
  }

  function handleEditorClick(e: React.MouseEvent) {
    const target = (e.target as HTMLElement).closest('[data-wiki-link]');
    if (!target) return;
    e.preventDefault();
    navigateToTitle(target.textContent || '');
  }

  const visibleNotes =
    activeFolder === 'all'
      ? notes
      : activeFolder === null
      ? notes.filter((n) => !n.folder_id)
      : notes.filter((n) => n.folder_id === activeFolder);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      WikiLink,
    ],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (selectedId) updateNote(selectedId, { content: editor.getJSON() });
    },
  });

  useEffect(() => {
    if (!selectedId && visibleNotes.length > 0) {
      setSelectedId(visibleNotes[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

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

    useEffect(() => {
    if (!pendingId) return;
    const match = notes.find((n) => n.id === pendingId);
    if (match) {
      setJournalMode(false);
      setActiveFolder('all');
      setSelectedId(match.id);
      onConsumedPending?.();
    }
  }, [pendingId, notes, onConsumedPending]);

  async function handleCreate() {
    const folderId = activeFolder === 'all' || activeFolder === null ? null : activeFolder;
    const note = await createNote(folderId);
    if (note) setSelectedId(note.id);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return;
    deleteNote(id);
    if (selectedId === id) {
      const remaining = visibleNotes.filter((n) => n.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }
  }

  async function openJournalDate(dateStr: string) {
    setJournalDate(dateStr);
    const entry = await getOrCreateJournalEntry(dateStr);
    if (entry) setSelectedId(entry.id);
  }

  function openJournal() {
    setJournalMode(true);
    openJournalDate(toDateStr(new Date()));
  }

  function exitJournal(toFolder: string | null | 'all') {
    setJournalMode(false);
    setActiveFolder(toFolder);
  }

  function shiftJournalDay(delta: number) {
    const d = new Date(journalDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    openJournalDate(toDateStr(d));
  }

  async function handleNewFolder() {
    const name = prompt('Folder name');
    if (!name) return;
    await createFolder(name, 'blue');
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="h-full flex items-center justify-center text-center px-6" style={{ background: 'var(--bg)' }}>
        <div className="max-w-sm">
          <div className="text-2xl mb-3">⚠️</div>
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Database not connected</div>
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
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex" style={{ background: 'var(--bg)' }}>
      {/* Folders rail */}
      <div
        className="w-[150px] shrink-0 border-r p-3 overflow-y-auto hidden lg:block"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="text-[10px] uppercase tracking-wider font-mono mb-2 px-1" style={{ color: 'var(--text-faint)' }}>
          Folders
        </div>
        <button
          onClick={openJournal}
          className="w-full text-left px-2 py-1.5 rounded-md text-[13px] mb-2"
          style={journalMode ? { background: 'var(--surface)', color: 'var(--text)' } : { color: 'var(--text-dim)' }}
        >
          📅 Journal
        </button>
        <button
          onClick={() => exitJournal('all')}
          className="w-full text-left px-2 py-1.5 rounded-md text-[13px] mb-0.5"
          style={!journalMode && activeFolder === 'all' ? { background: 'var(--surface)', color: 'var(--text)' } : { color: 'var(--text-dim)' }}
        >
          All notes
        </button>
        <button
          onClick={() => exitJournal(null)}
          className="w-full text-left px-2 py-1.5 rounded-md text-[13px] mb-2"
          style={!journalMode && activeFolder === null ? { background: 'var(--surface)', color: 'var(--text)' } : { color: 'var(--text-dim)' }}
        >
          Unfiled
        </button>
        {folders.map((f) => (
          <div key={f.id} className="group relative">
            <button
              onClick={() => exitJournal(f.id)}
              className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-md text-[13px] mb-0.5 pr-6"
              style={!journalMode && activeFolder === f.id ? { background: 'var(--surface)', color: 'var(--text)' } : { color: 'var(--text-dim)' }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: colorHex(f.color) || 'var(--text-faint)' }}
              />
              <span className="truncate">{f.name}</span>
            </button>
            <button
              onClick={() => deleteFolder(f.id)}
              className="absolute top-1.5 right-1.5 w-4 h-4 rounded opacity-0 group-hover:opacity-100 text-[10px]"
              style={{ color: 'var(--text-faint)' }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={handleNewFolder}
          className="w-full text-left px-2 py-1.5 rounded-md text-[13px] mt-1"
          style={{ color: 'var(--text-faint)' }}
        >
          + New folder
        </button>
      </div>

      {/* Note list */}
      <div
        className="w-[230px] shrink-0 border-r flex flex-col hidden md:flex"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
          {journalMode ? (
            <button
              onClick={() => openJournalDate(toDateStr(new Date()))}
              className="w-full text-sm font-medium rounded-lg py-2"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
            >
              Jump to today
            </button>
          ) : (
            <button
              onClick={handleCreate}
              className="w-full text-sm font-medium rounded-lg py-2"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
            >
              + New note
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {journalMode ? (
            <>
              {journalEntries.length === 0 && (
                <div className="text-xs text-center py-10 px-3" style={{ color: 'var(--text-faint)' }}>
                  No journal entries yet.
                </div>
              )}
              {journalEntries.map((n) => (
                <div
                  key={n.id}
                  onClick={() => n.journal_date && openJournalDate(n.journal_date)}
                  className="rounded-lg px-3 py-2.5 cursor-pointer mb-1"
                  style={
                    journalDate === n.journal_date
                      ? { background: 'var(--surface)' }
                      : { background: 'transparent' }
                  }
                >
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                    {n.journal_date ? formatJournalDate(n.journal_date) : n.title}
                  </div>
                  <div className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    {timeAgo(n.updated_at)}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
          {visibleNotes.length === 0 && (
            <div className="text-xs text-center py-10 px-3" style={{ color: 'var(--text-faint)' }}>
              No notes here yet.
            </div>
          )}
          {visibleNotes.map((n) => {
            const hex = colorHex(n.color);
            return (
              <div
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className="group relative rounded-lg pl-3.5 pr-3 py-2.5 cursor-pointer mb-1 overflow-hidden"
                style={selectedId === n.id ? { background: 'var(--surface)' } : { background: 'transparent' }}
              >
                {hex && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded"
                    style={{ background: hex }}
                  />
                )}
                <div className="text-sm font-medium truncate pr-5" style={{ color: 'var(--text)' }}>
                  {n.title || 'Untitled'}
                </div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {timeAgo(n.updated_at)}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                  className="absolute top-2 right-2 w-5 h-5 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs"
                  style={{ color: 'var(--text-faint)' }}
                >
                  ✕
                </button>
              </div>
            );
          })}
            </>
          )}
        </div>
      </div>

      {/* Editor */}
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
            {journalMode && (
              <div
                className="flex items-center gap-3 px-6 pt-5 pb-3 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  onClick={() => shiftJournalDay(-1)}
                  className="w-7 h-7 rounded-md border flex items-center justify-center"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                >
                  ←
                </button>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {formatJournalDate(journalDate)}
                </div>
                <button
                  onClick={() => shiftJournalDay(1)}
                  className="w-7 h-7 rounded-md border flex items-center justify-center"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                >
                  →
                </button>
                {journalDate !== toDateStr(new Date()) && (
                  <button
                    onClick={() => openJournalDate(toDateStr(new Date()))}
                    className="text-xs font-mono ml-1"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    Today
                  </button>
                )}
              </div>
            )}
            <div className="flex items-start gap-3 px-6 pt-6 pb-1">
              <input
                value={selected.title}
                onChange={(e) => updateNote(selected.id, { title: e.target.value })}
                placeholder="Untitled"
                className="flex-1 text-xl font-semibold outline-none bg-transparent"
                style={{ color: 'var(--text)' }}
              />
              <div className="flex items-center gap-1.5 pt-2">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    title={c.label}
                    onClick={() => updateNote(selected.id, { color: selected.color === c.id ? null : c.id })}
                    className="w-4 h-4 rounded-full border-2"
                    style={{
                      background: c.hex,
                      borderColor: selected.color === c.id ? 'var(--text)' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            {folders.length > 0 && (
              <div className="px-6 pb-3">
                <select
                  value={selected.folder_id || ''}
                  onChange={(e) => updateNote(selected.id, { folder_id: e.target.value || null })}
                  className="text-xs rounded-md border px-2 py-1 bg-transparent"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id} style={{ color: '#000' }}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
                        <EditorToolbar editor={editor} />
            <div className="flex-1 overflow-y-auto px-6 py-4" onClick={handleEditorClick}>
              <EditorContent editor={editor} className="tiptap-content" />

              {backlinks.length > 0 && (
                <div className="mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div
                    className="text-[10px] uppercase tracking-wider font-mono mb-2"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    Linked from
                  </div>
                  <div className="flex flex-col gap-1">
                    {backlinks.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setJournalMode(false);
                          setSelectedId(n.id);
                        }}
                        className="text-left text-sm rounded-md px-2.5 py-1.5"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        {n.title || 'Untitled'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}