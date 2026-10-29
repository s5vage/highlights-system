'use client';

import { useEffect, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { CalendarDays, Folder as FolderIcon, Inbox, NotebookText, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from 'lucide-react';
import { Folder } from '@/lib/types';
import { hueVar } from './helpers';

interface Props {
  scope: string;
  folders: Folder[];
  counts: { all: number; unfiled: number; journal: number; byFolder: Record<string, number> };
  collapsed: boolean;
  onToggle: () => void;
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
  collapsed,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={`side-row${collapsed ? ' side-row-rail' : ''}`}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
    >
      {active && (
        <motion.span
          layoutId="notes-side-pill"
          className="side-pill"
          transition={{ type: 'spring', stiffness: 520, damping: 40 }}
        />
      )}
      <span className="relative flex min-w-0 items-center gap-2.5">
        {icon}
        {!collapsed && <span className="truncate">{label}</span>}
      </span>
      {!collapsed && count !== undefined && <span className="side-count tnum relative">{count}</span>}
    </button>
  );
}

export default function NotesSidebar({ scope, folders, counts, collapsed, onToggle, onScope, onCreateFolder, onDeleteFolder }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  // The folder box can't be used while the sidebar is a narrow strip.
  useEffect(() => {
    if (collapsed) setAdding(false);
  }, [collapsed]);

  function commit() {
    const name = draft.trim();
    if (name) onCreateFolder(name);
    setDraft('');
    setAdding(false);
  }

  const icon = { size: 15, strokeWidth: 1.9 } as const;
  const divider = <div className="mx-2 my-2.5 h-px" style={{ background: 'var(--hairline)' }} aria-hidden />;

  return (
    <aside
      className="hl-side notes-side hidden shrink-0 flex-col overflow-y-auto overflow-x-hidden p-3 lg:flex"
      data-collapsed={collapsed}
      aria-label="Notes sidebar"
    >
      <div className={`mb-1.5 flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          type="button"
          className="tool !h-7 !w-7"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          {collapsed ? <PanelLeftOpen size={16} strokeWidth={2} /> : <PanelLeftClose size={16} strokeWidth={2} />}
        </button>
      </div>

      <LayoutGroup id="notes-side">
        <Row
          active={scope === 'journal'}
          onClick={() => onScope('journal')}
          icon={<CalendarDays {...icon} />}
          label="Journal"
          count={counts.journal}
          collapsed={collapsed}
        />

        {collapsed ? divider : <div className="side-title">Notes</div>}
        <Row active={scope === 'all'} onClick={() => onScope('all')} icon={<NotebookText {...icon} />} label="All notes" count={counts.all} collapsed={collapsed} />
        <Row active={scope === 'unfiled'} onClick={() => onScope('unfiled')} icon={<Inbox {...icon} />} label="Unfiled" count={counts.unfiled} collapsed={collapsed} />

        {collapsed ? (
          divider
        ) : (
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
        )}

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
              collapsed={collapsed}
            />
            {!collapsed && (
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
            )}
          </div>
        ))}

        {adding && !collapsed && (
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

        {folders.length === 0 && !adding && !collapsed && (
          <p className="px-2.5 pt-1 text-[12.5px] leading-snug" style={{ color: 'var(--text-faint)' }}>
            Folders group related notes, like one per class.
          </p>
        )}
      </LayoutGroup>
    </aside>
  );
}