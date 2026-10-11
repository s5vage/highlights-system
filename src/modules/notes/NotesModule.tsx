'use client';

import { useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { DatabaseZap, NotebookPen, SquarePen, TriangleAlert } from 'lucide-react';
import { useNotes } from './useNotes';
import { useFolders } from './useFolders';
import NotesSidebar from './NotesSidebar';
import NoteList, { ScopeOption } from './NoteList';
import NoteEditor from './NoteEditor';
import StateMessage from '@/components/StateMessage';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Note } from '@/lib/types';
import { previewOf, toDateStr } from './helpers';

const FOLDER_HUES = ['blue', 'green', 'pink', 'yellow', 'gray'];

const byUpdated = (a: Note, b: Note) =>
  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

interface Props {
  pendingId?: string | null;
  onConsumedPending?: () => void;
}

export default function NotesModule({ pendingId, onConsumedPending }: Props = {}) {
  const {
    notes,
    loading,
    error,
    saveState,
    reload,
    createNote,
    updateNote,
    deleteNote,
    getOrCreateJournalEntry,
  } = useNotes();
  const { folders, createFolder, deleteFolder } = useFolders();

  // scope: 'all' | 'unfiled' | 'journal' | a folder id
  const [scope, setScope] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusTitle, setFocusTitle] = useState(false);

  const journal = scope === 'journal';
  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const scoped = useMemo(() => {
    if (journal) return notes.filter((n) => n.is_journal);
    const regular = notes.filter((n) => !n.is_journal);
    if (scope === 'all') return regular;
    if (scope === 'unfiled') return regular.filter((n) => !n.folder_id);
    return regular.filter((n) => n.folder_id === scope);
  }, [notes, scope, journal]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? scoped.filter((n) => n.title.toLowerCase().includes(q) || previewOf(n.content).toLowerCase().includes(q))
      : scoped;
    return [...list].sort(
      journal ? (a, b) => (b.journal_date || '').localeCompare(a.journal_date || '') : byUpdated
    );
  }, [scoped, query, journal]);

  const counts = useMemo(() => {
    const regular = notes.filter((n) => !n.is_journal);
    const byFolder: Record<string, number> = {};
    regular.forEach((n) => {
      if (n.folder_id) byFolder[n.folder_id] = (byFolder[n.folder_id] || 0) + 1;
    });
    return {
      all: regular.length,
      unfiled: regular.filter((n) => !n.folder_id).length,
      journal: notes.length - regular.length,
      byFolder,
    };
  }, [notes]);

  // On desktop, open the most recent note automatically.
  useEffect(() => {
    if (!loading && !selectedId && visible.length > 0) setSelectedId(visible[0].id);
  }, [loading, selectedId, visible]);

  // Deep links from global search.
  useEffect(() => {
    if (!pendingId) return;
    const match = notes.find((n) => n.id === pendingId);
    if (match) {
      setScope(match.is_journal ? 'journal' : 'all');
      setQuery('');
      setSelectedId(match.id);
      setMobileOpen(true);
      onConsumedPending?.();
    }
  }, [pendingId, notes, onConsumedPending]);

  async function openJournalDate(dateStr: string, openOnPhone = true) {
    const entry = await getOrCreateJournalEntry(dateStr);
    if (entry) {
      setSelectedId(entry.id);
      if (openOnPhone) setMobileOpen(true);
    }
  }

  function changeScope(next: string) {
    setScope(next);
    setQuery('');
    setMobileOpen(false);
    if (next === 'journal') {
      openJournalDate(toDateStr(new Date()), false);
      return;
    }
    const inScope = (n: Note) =>
      !n.is_journal && (next === 'all' || (next === 'unfiled' ? !n.folder_id : n.folder_id === next));
    if (!selected || !inScope(selected)) {
      setSelectedId(notes.filter(inScope).sort(byUpdated)[0]?.id ?? null);
    }
  }

  async function handleCreate() {
    if (journal) {
      await openJournalDate(toDateStr(new Date()));
      return;
    }
    const folderId = scope !== 'all' && scope !== 'unfiled' ? scope : null;
    const note = await createNote(folderId);
    if (note) {
      setQuery('');
      setSelectedId(note.id);
      setMobileOpen(true);
      setFocusTitle(true);
    }
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setMobileOpen(true);
  }

  function handleDelete() {
    if (!selected) return;
    const label = journal ? 'this journal entry' : `“${selected.title || 'Untitled'}”`;
    if (!confirm(`Delete ${label}? This can’t be undone.`)) return;
    const idx = visible.findIndex((n) => n.id === selected.id);
    const next = visible[idx + 1] ?? visible[idx - 1] ?? null;
    deleteNote(selected.id);
    setSelectedId(next?.id ?? null);
    setMobileOpen(false);
  }

  function navigateToTitle(title: string) {
    const match = notes.find((n) => !n.is_journal && n.title.trim().toLowerCase() === title.trim().toLowerCase());
    if (match) {
      setScope('all');
      setSelectedId(match.id);
      setMobileOpen(true);
    } else if (confirm(`There’s no note called “${title}” yet. Create it?`)) {
      createNote(null).then((note) => {
        if (note) {
          updateNote(note.id, { title });
          setScope('all');
          setSelectedId(note.id);
          setMobileOpen(true);
        }
      });
    }
  }

  function shiftJournalDay(delta: number) {
    if (!selected?.journal_date) return;
    const d = new Date(selected.journal_date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    openJournalDate(toDateStr(d));
  }

  async function handleCreateFolder(name: string) {
    const color = FOLDER_HUES[folders.length % FOLDER_HUES.length];
    const folder = await createFolder(name, color);
    if (folder) changeScope(folder.id);
  }

  function handleDeleteFolder(id: string) {
    const folder = folders.find((f) => f.id === id);
    if (!confirm(`Delete the folder “${folder?.name}”? Its notes won’t be deleted. They move to Unfiled.`)) return;
    deleteFolder(id);
    if (scope === id) changeScope('all');
  }

  const scopes: ScopeOption[] = [
    { id: 'journal', label: 'Journal' },
    { id: 'all', label: 'All notes' },
    { id: 'unfiled', label: 'Unfiled' },
    ...folders.map((f) => ({ id: f.id, label: f.name })),
  ];

  const scopeTitle =
    scope === 'journal'
      ? 'Journal'
      : scope === 'all'
      ? 'All notes'
      : scope === 'unfiled'
      ? 'Unfiled'
      : folders.find((f) => f.id === scope)?.name ?? 'Notes';
  const total = visible.length;
  const subtitle = query
    ? `${total} ${total === 1 ? 'result' : 'results'}`
    : journal
    ? `${total} ${total === 1 ? 'entry' : 'entries'}`
    : `${total} ${total === 1 ? 'note' : 'notes'}`;

  if (!isSupabaseConfigured) {
    return (
      <div className="h-full" style={{ background: 'var(--bg)' }}>
        <StateMessage
          icon={<DatabaseZap size={22} strokeWidth={1.8} />}
          title="Database not connected"
          body="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file, then restart the dev server."
        />
      </div>
    );
  }

  if (error && notes.length === 0) {
    return (
      <div className="h-full" style={{ background: 'var(--bg)' }}>
        <StateMessage
          icon={<TriangleAlert size={22} strokeWidth={1.8} />}
          title="Couldn’t load your notes"
          body={
            error.includes('relation')
              ? 'The notes table doesn’t exist in Supabase yet. Create it, then try again.'
              : error
          }
          action={
            <button type="button" className="btn btn-primary" onClick={() => reload()}>
              Try again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full" style={{ background: 'var(--bg)' }}>
        <NotesSidebar
          scope={scope}
          folders={folders}
          counts={counts}
          onScope={changeScope}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
        />

        {/* Note list: the whole screen on phones until a note is opened */}
        <div
          className={`${mobileOpen ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col md:flex md:w-[330px] md:flex-none md:shrink-0`}
          style={{ borderRight: '1px solid var(--hairline)' }}
        >
          <NoteList
            title={scopeTitle}
            subtitle={subtitle}
            notes={visible}
            loading={loading}
            selectedId={selectedId}
            query={query}
            onQuery={setQuery}
            onSelect={handleSelect}
            onCreate={handleCreate}
            journal={journal}
            folders={folders}
            showFolderLabel={scope === 'all'}
            scopes={scopes}
            scope={scope}
            onScope={changeScope}
          />
        </div>

        {/* Editor */}
        <div className={`${mobileOpen ? 'flex' : 'hidden'} min-w-0 flex-1 md:flex`} style={{ background: 'var(--surface)' }}>
          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              notes={notes}
              folders={folders}
              journal={journal}
              saveState={saveState}
              focusTitle={focusTitle}
              onTitleFocused={() => setFocusTitle(false)}
              onUpdate={(patch) => updateNote(selected.id, patch)}
              onDelete={handleDelete}
              onOpenNote={(id) => {
                setJournalModeOff();
                handleSelect(id);
              }}
              onNavigateTitle={navigateToTitle}
              onShiftDay={shiftJournalDay}
              onGoToday={() => openJournalDate(toDateStr(new Date()))}
              onBack={() => setMobileOpen(false)}
            />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <StateMessage
                icon={<NotebookPen size={22} strokeWidth={1.8} />}
                title={
                  notes.length === 0
                    ? 'Write your first note'
                    : visible.length === 0 && !query
                    ? journal
                      ? 'No journal entries yet'
                      : `Nothing in ${scopeTitle} yet`
                    : 'No note selected'
                }
                body={
                  notes.length === 0
                    ? 'Notes support headings, checklists, highlights, and links to other notes.'
                    : visible.length === 0 && !query
                    ? journal
                      ? 'Open today’s entry to start your journal.'
                      : 'Create a note here and it will be saved in this view.'
                    : 'Pick a note from the list, or start a new one.'
                }
                action={
                  <button type="button" className="btn btn-primary" onClick={handleCreate}>
                    <SquarePen size={15} strokeWidth={2} />
                    New note
                  </button>
                }
              />
            </div>
          )}
        </div>
      </div>
    </MotionConfig>
  );

  function setJournalModeOff() {
    if (journal) setScope('all');
  }
}