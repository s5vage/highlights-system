'use client';

import { useEffect, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { CalendarDays, Folder as FolderIcon, Inbox, NotebookText, Plus, Trash2 } from 'lucide-react';
import { Folder } from '@/lib/types';
import { hueVar } from './helpers';

interface Props {
  scope: string;
  folders: Folder[];
  counts: { all: number; unfiled: number; journal: number; byFolder: Record<string, number> };
  onScope: (scope: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
}

function Row({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button type="button" onClick={onClick} data-active={active} className="side-row">
      {active && (
        <motion.span
          layoutId="notes-side-pill"
          className="side-pill"
          transition={{ type: 'spring', stiffness: 520, damping: 40 }}
        />
      )}
      <span className="relative flex min-w-0 items-center gap-2.5">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined && <span className="side-count tnum relative">{count}</span>}
    </button>
  );
}

export default function NotesSidebar({ scope, folders, counts, onScope, onCreateFolder, onDeleteFolder }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function commit() {
    const name = draft.trim();
    if (name) onCreateFolder(name);
    setDraft('');
    setAdding(false);
  }

  const icon = { size: 15, strokeWidth: 1.9 } as const;

  return (
    <aside className="hl-side hidden w-[232px] shrink-0 flex-col overflow-y-auto p-3 lg:flex">
      <LayoutGroup id="notes-side">
        <Row
          active={scope === 'journal'}
          onClick={() => onScope('journal')}
          icon={<CalendarDays {...icon} />}
          label="Journal"
          count={counts.journal}
        />

        <div className="side-title">Notes</div>
        <Row active={scope === 'all'} onClick={() => onScope('all')} icon={<NotebookText {...icon} />} label="All notes" count={counts.all} />
        <Row active={scope === 'unfiled'} onClick={() => onScope('unfiled')} icon={<Inbox {...icon} />} label="Unfiled" count={counts.unfiled} />

        <div className="side-title flex items-center justify-between">
          Folders
          <button
            type="button"
            className="tool !h-6 !w-6 !rounded-md"
            aria-label="New folder"
            title="New folder"
            onClick={() => setAdding(true)}
          >
            <Plus size={14} strokeWidth={2.2} />
          </button>
        </div>

        {folders.map((f) => (
          <div key={f.id} className="group relative">
            <Row
              active={scope === f.id}
              onClick={() => onScope(f.id)}
              icon={
                <FolderIcon
                  {...icon}
                  fill="currentColor"
                  fillOpacity={0.18}
                  style={{ color: hueVar(f.color) || 'var(--text-faint)' }}
                />
              }
              label={f.name}
              count={counts.byFolder[f.id] ?? 0}
            />
            <button
              type="button"
              aria-label={`Delete folder ${f.name}`}
              title="Delete folder"
              onClick={() => onDeleteFolder(f.id)}
              className="tool !h-6 !w-6 !rounded-md absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              style={{ background: 'var(--bg)' }}
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          </div>
        ))}

        {adding && (
          <div className="side-row" style={{ background: 'var(--fill)', cursor: 'text' }}>
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <FolderIcon {...icon} style={{ color: 'var(--text-faint)' }} />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') {
                    setDraft('');
                    setAdding(false);
                  }
                }}
                placeholder="Folder name"
                aria-label="New folder name"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] font-medium outline-none placeholder:text-[var(--text-faint)]"
              />
            </span>
          </div>
        )}

        {folders.length === 0 && !adding && (
          <p className="px-2.5 pt-1 text-[12.5px] leading-snug" style={{ color: 'var(--text-faint)' }}>
            Folders group related notes, like one per class.
          </p>
        )}
      </LayoutGroup>
    </aside>
  );
}