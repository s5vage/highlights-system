'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, Plus, MoreHorizontal, Tag, Trash2, X } from 'lucide-react';
import Popover from '@/components/Popover';
import { Book, Collection, CollectionColor } from '@/lib/types';
import { COLLECTION_COLORS, STORAGE_LIMIT_BYTES, formatStorage } from './helpers';

export type CollectionFilter = 'all' | 'none' | string;

// "2.1 GB of 10 GB used", with a bar that turns amber, then red, as it fills.
export function StorageMeter({ used }: { used: number }) {
  const pct = Math.min(100, (used / STORAGE_LIMIT_BYTES) * 100);
  const color = pct >= 95 ? 'var(--hue-red, #e5655b)' : pct >= 80 ? 'var(--hue-yellow)' : 'var(--accent)';
  return (
    <div className="mt-3 flex items-center gap-3" title="Your free Backblaze storage">
      <div className="progress !h-[5px] w-[170px]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Storage used">
        <span style={{ width: `${used > 0 ? Math.max(pct, 1.5) : 0}%`, background: color }} />
      </div>
      <span className="tnum text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
        {formatStorage(used)} of 10 GB used
      </span>
    </div>
  );
}

function CollectionMenu({
  c,
  count,
  onRename,
  onRecolor,
  onDelete,
  close,
}: {
  c: Collection;
  count: number;
  onRename: (id: string, name: string) => void;
  onRecolor: (id: string, color: CollectionColor) => void;
  onDelete: (id: string) => void;
  close: () => void;
}) {
  const [name, setName] = useState(c.name);
  const nameRef = useRef(name);
  nameRef.current = name;
  const saved = useRef(c.name);

  function save() {
    const n = nameRef.current.trim();
    if (n && n !== saved.current) {
      saved.current = n;
      onRename(c.id, n);
    }
  }
  // Closing the menu any way at all keeps what you typed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => save(), []);

  return (
    <div className="w-[240px] p-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            save();
            close();
          }
        }}
        aria-label="Collection name"
        className="h-9 w-full rounded-lg bg-[var(--fill)] px-2.5 text-[13.5px] font-medium outline-none"
      />
      <div className="flex gap-2.5 px-1 py-3">
        {COLLECTION_COLORS.map((col) => (
          <button
            key={col}
            type="button"
            aria-label={`Color ${col}`}
            className="hl-swatch"
            style={{
              background: `var(--hue-${col})`,
              outline: c.color === col ? '2px solid var(--accent)' : 'none',
              outlineOffset: 2,
            }}
            onClick={() => onRecolor(c.id, col)}
          />
        ))}
      </div>
      <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
      <button
        type="button"
        className="menu-item hover:!text-[#e5484d]"
        onClick={() => {
          close();
          if (confirm(`Delete the collection “${c.name}”? Its ${count} ${count === 1 ? 'book stays' : 'books stay'} in your library.`)) {
            onDelete(c.id);
          }
        }}
      >
        <Trash2 size={15} strokeWidth={1.9} /> Delete collection
      </button>
    </div>
  );
}

// A row of collections to filter by: All, your collections, Unsorted, and "New collection".
export function CollectionBar({
  collections,
  books,
  value,
  onChange,
  onCreate,
  onRename,
  onRecolor,
  onDelete,
}: {
  collections: Collection[];
  books: Book[];
  value: CollectionFilter;
  onChange: (v: CollectionFilter) => void;
  onCreate: (name: string) => Promise<Collection | null>;
  onRename: (id: string, name: string) => void;
  onRecolor: (id: string, color: CollectionColor) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const counts = new Map<string, number>();
  let unsorted = 0;
  books.forEach((b) => {
    if (b.collection_id) counts.set(b.collection_id, (counts.get(b.collection_id) ?? 0) + 1);
    else unsorted++;
  });

  async function commit() {
    const name = draft.trim();
    setAdding(false);
    setDraft('');
    if (!name) return;
    const created = await onCreate(name);
    if (created) onChange(created.id);
  }

  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-5 pb-3 md:px-8" role="tablist" aria-label="Collections">
      <button type="button" role="tab" aria-selected={value === 'all'} className="coll-chip" data-active={value === 'all'} onClick={() => onChange('all')}>
        All <span className="tnum opacity-60">{books.length}</span>
      </button>

      {collections.map((c) => {
        const active = value === c.id;
        return (
          <div key={c.id} className="coll-chip !gap-0 !pr-1.5" data-active={active}>
            <button type="button" role="tab" aria-selected={active} className="flex items-center gap-2 pr-1" onClick={() => onChange(c.id)}>
              <span className="coll-dot" style={{ background: `var(--hue-${c.color})` }} />
              {c.name} <span className="tnum opacity-60">{counts.get(c.id) ?? 0}</span>
            </button>
            {active && (
              <Popover
                trigger={({ open, toggle }) => (
                  <button type="button" className="coll-more" aria-label={`Edit ${c.name}`} aria-expanded={open} onClick={toggle}>
                    <MoreHorizontal size={15} strokeWidth={2.2} />
                  </button>
                )}
              >
                {(close) => (
                  <CollectionMenu c={c} count={counts.get(c.id) ?? 0} onRename={onRename} onRecolor={onRecolor} onDelete={onDelete} close={close} />
                )}
              </Popover>
            )}
          </div>
        );
      })}

      {collections.length > 0 && (
        <button type="button" role="tab" aria-selected={value === 'none'} className="coll-chip" data-active={value === 'none'} onClick={() => onChange('none')}>
          Unsorted <span className="tnum opacity-60">{unsorted}</span>
        </button>
      )}

      {adding ? (
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
          placeholder="Collection name"
          aria-label="New collection name"
          className="h-8 w-[170px] shrink-0 rounded-full bg-[var(--fill)] px-3.5 text-[13px] font-medium outline-none"
        />
      ) : (
        <button type="button" className="coll-chip coll-chip-new" aria-label="New collection" onClick={() => setAdding(true)}>
          <Plus size={14} strokeWidth={2.4} /> New collection
        </button>
      )}
    </div>
  );
}

function TagList({
  tags,
  value,
  onChange,
  onRename,
  onDelete,
  close,
}: {
  tags: { tag: string; count: number }[];
  value: string | null;
  onChange: (t: string | null) => void;
  onRename: (from: string, to: string) => void;
  onDelete: (tag: string) => void;
  close: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (tags.length === 0) {
    return (
      <p className="w-[250px] px-4 py-5 text-center text-[13px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        No tags yet. Select some books and tap Tag to make your first one.
      </p>
    );
  }
  return (
    <div className="w-[270px] p-1.5">
      <div className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold" style={{ color: 'var(--text-faint)' }}>
        Filter by tag
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {tags.map(({ tag, count }) =>
          editing === tag ? (
            <div key={tag} className="px-1 py-1">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (draft.trim() && draft.trim() !== tag) onRename(tag, draft);
                    setEditing(null);
                  }
                  if (e.key === 'Escape') setEditing(null);
                }}
                onBlur={() => setEditing(null)}
                aria-label={`Rename tag ${tag}`}
                className="h-8 w-full rounded-lg bg-[var(--fill)] px-2.5 text-[13.5px] font-medium outline-none"
              />
            </div>
          ) : (
            <div key={tag} className="group flex items-center rounded-lg hover:bg-[var(--fill)]" style={{ background: value === tag ? 'var(--fill-strong)' : undefined }}>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-[13.5px] font-medium"
                onClick={() => {
                  onChange(value === tag ? null : tag);
                  close();
                }}
              >
                <span className="min-w-0 flex-1 truncate">{tag}</span>
                <span className="tnum text-[12px]" style={{ color: 'var(--text-faint)' }}>
                  {count}
                </span>
              </button>
              <div className="flex pr-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                <button
                  type="button"
                  className="tool !h-7 !w-7"
                  aria-label={`Rename tag ${tag}`}
                  title="Rename"
                  onClick={() => {
                    setDraft(tag);
                    setEditing(tag);
                  }}
                >
                  <Pencil size={13} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="tool !h-7 !w-7 hover:!text-[#e5484d]"
                  aria-label={`Delete tag ${tag}`}
                  title="Delete"
                  onClick={() => {
                    if (confirm(`Remove the tag “${tag}” from ${count} ${count === 1 ? 'book' : 'books'}? The books stay.`)) {
                      onDelete(tag);
                      if (value === tag) onChange(null);
                    }
                  }}
                >
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// "Tags" button: filter the shelf by a tag, and rename or delete tags everywhere.
export function TagFilter({
  tags,
  value,
  onChange,
  onRename,
  onDelete,
}: {
  tags: { tag: string; count: number }[];
  value: string | null;
  onChange: (t: string | null) => void;
  onRename: (from: string, to: string) => void;
  onDelete: (tag: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Popover
        trigger={({ open, toggle }) => (
          <button
            type="button"
            className={`btn ${value ? 'btn-primary' : ''}`}
            aria-label="Tags"
            aria-expanded={open}
            onClick={toggle}
          >
            <Tag size={15} strokeWidth={2} />
            {value ?? 'Tags'}
          </button>
        )}
      >
        {(close) => <TagList tags={tags} value={value} onChange={onChange} onRename={onRename} onDelete={onDelete} close={close} />}
      </Popover>
      {value && (
        <button type="button" className="tool" aria-label="Clear tag filter" title="Clear tag filter" onClick={() => onChange(null)}>
          <X size={16} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}