'use client';

import { useMemo } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { Folder as FolderIcon, Search, SquarePen, CalendarPlus, X } from 'lucide-react';
import { Folder, Note } from '@/lib/types';
import { groupByRecency, hueVar, previewOf, rowDate, formatJournalDate } from './helpers';

export interface ScopeOption {
  id: string;
  label: string;
}

interface Props {
  title: string;
  subtitle: string;
  notes: Note[];
  loading: boolean;
  selectedId: string | null;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  journal: boolean;
  folders: Folder[];
  showFolderLabel: boolean;
  scopes: ScopeOption[];
  scope: string;
  onScope: (id: string) => void;
}

function NoteRow({
  note,
  selected,
  journal,
  folder,
  onSelect,
}: {
  note: Note;
  selected: boolean;
  journal: boolean;
  folder: Folder | null;
  onSelect: () => void;
}) {
  const preview = useMemo(() => previewOf(note.content), [note.content]);
  const hue = hueVar(note.color);
  const title = journal && note.journal_date ? formatJournalDate(note.journal_date) : note.title || 'Untitled';

  return (
    <motion.button
      layout="position"
      type="button"
      onClick={onSelect}
      data-colored={!!hue}
      aria-current={selected}
      className="note-row"
      style={hue ? ({ '--hue': hue } as React.CSSProperties) : undefined}
    >
      {selected && (
        <motion.span
          layoutId="note-pill"
          className="note-pill"
          transition={{ type: 'spring', stiffness: 520, damping: 42 }}
        />
      )}
      <span className="relative block min-w-0">
        <span className="block truncate text-[14.5px] font-semibold tracking-[-0.01em]">{title}</span>
        <span className="mt-0.5 flex min-w-0 items-baseline gap-2 text-[12.5px]">
          <span className="shrink-0 font-medium" style={{ color: 'var(--text-dim)' }}>
            {rowDate(note.updated_at)}
          </span>
          <span className="truncate" style={{ color: 'var(--text-faint)' }}>
            {preview || 'No additional text'}
          </span>
        </span>
        {folder && (
          <span className="mt-1 flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
            <FolderIcon size={11} strokeWidth={2} style={{ color: hueVar(folder.color) || 'currentColor' }} />
            <span className="truncate">{folder.name}</span>
          </span>
        )}
      </span>
    </motion.button>
  );
}

export default function NoteList({
  title,
  subtitle,
  notes,
  loading,
  selectedId,
  query,
  onQuery,
  onSelect,
  onCreate,
  journal,
  folders,
  showFolderLabel,
  scopes,
  scope,
  onScope,
}: Props) {
  const groups = useMemo(
    () => (journal ? [{ label: '', items: notes }] : groupByRecency(notes)),
    [journal, notes]
  );
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pb-3 pt-5 md:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[24px] font-semibold leading-8 tracking-[-0.022em]">{title}</h2>
            <p className="text-[12.5px] tnum" style={{ color: 'var(--text-dim)' }}>
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            className="btn !h-9 !w-9 shrink-0 !justify-center !px-0"
            onClick={onCreate}
            title={journal ? 'Open today’s entry' : 'New note'}
            aria-label={journal ? 'Open today’s entry' : 'New note'}
          >
            {journal ? <CalendarPlus size={17} strokeWidth={1.9} /> : <SquarePen size={17} strokeWidth={1.9} />}
          </button>
        </div>

        <div className="search mt-4" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
          <Search size={15} strokeWidth={2} style={{ color: 'var(--text-faint)' }} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search notes"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onQuery('')}
              className="grid h-5 w-5 place-items-center rounded-full"
              style={{ background: 'var(--fill-strong)', color: 'var(--text-dim)' }}
            >
              <X size={12} strokeWidth={2.4} />
            </button>
          )}
        </div>

        {/* Phones and tablets: folders live here instead of the sidebar */}
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 lg:hidden">
          {scopes.map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip !px-3.5 !py-1.5 !text-[13px] shrink-0"
              style={
                s.id === scope
                  ? { background: 'var(--text)', color: 'var(--bg)' }
                  : { background: 'var(--fill)', color: 'var(--text-dim)' }
              }
              onClick={() => onScope(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div layoutScroll className="min-h-0 flex-1 overflow-y-auto px-2 pb-24">
        {loading ? (
          <div className="space-y-2 px-2 pt-1" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="px-6 py-16 text-center text-[13.5px]" style={{ color: 'var(--text-faint)' }}>
            {query ? 'No notes match your search.' : journal ? 'No journal entries yet.' : 'No notes here yet.'}
          </div>
        ) : (
          <LayoutGroup id="note-list">
            {groups.map((g) => (
              <div key={g.label || 'all'} className="mb-3">
                {g.label && (
                  <div className="px-3 pb-1.5 pt-3 text-[12px] font-semibold" style={{ color: 'var(--text-faint)' }}>
                    {g.label}
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  {g.items.map((n) => (
                    <NoteRow
                      key={n.id}
                      note={n}
                      selected={n.id === selectedId}
                      journal={journal}
                      folder={showFolderLabel && n.folder_id ? folderById.get(n.folder_id) ?? null : null}
                      onSelect={() => onSelect(n.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </LayoutGroup>
        )}
      </motion.div>
    </div>
  );
}