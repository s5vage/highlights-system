'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Check, FolderInput, Minus, Plus, Tag, Trash2, X } from 'lucide-react';
import Popover from '@/components/Popover';
import { Book, Collection } from '@/lib/types';

type TagCount = { tag: string; count: number };

const hasTag = (b: Book, tag: string) => b.tags.some((t) => t.toLowerCase() === tag.toLowerCase());

function TagPicker({
  books,
  allTags,
  onAdd,
  onRemove,
}: {
  books: Book[];
  allTags: TagCount[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const n = books.length;
  const stateOf = (tag: string) => {
    const c = books.filter((b) => hasTag(b, tag)).length;
    return c === 0 ? 'none' : c === n ? 'all' : 'some';
  };

  return (
    <div className="w-[264px] p-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            onAdd(draft);
            setDraft('');
          }
        }}
        placeholder="New tag, then Enter"
        aria-label="New tag"
        className="h-9 w-full rounded-lg bg-[var(--fill)] px-2.5 text-[13.5px] font-medium outline-none"
      />
      <div className="mt-1.5 max-h-[260px] overflow-y-auto">
        {allTags.map(({ tag }) => {
          const st = stateOf(tag);
          return (
            <button key={tag} type="button" className="menu-item" onClick={() => (st === 'all' ? onRemove(tag) : onAdd(tag))}>
              <span className="tag-check" data-state={st} aria-hidden>
                {st === 'all' && <Check size={12} strokeWidth={3.2} />}
                {st === 'some' && <Minus size={12} strokeWidth={3.2} />}
              </span>
              <span className="min-w-0 flex-1 truncate">{tag}</span>
            </button>
          );
        })}
        {allTags.length === 0 && (
          <p className="px-3 py-4 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
            Type a name above to make your first tag.
          </p>
        )}
      </div>
    </div>
  );
}

function MovePicker({
  collections,
  onMove,
  onCreateAndMove,
  close,
}: {
  collections: Collection[];
  onMove: (id: string | null) => void;
  onCreateAndMove: (name: string) => void;
  close: () => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className="w-[244px] p-2">
      <div className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold" style={{ color: 'var(--text-faint)' }}>
        Move to
      </div>
      <div className="max-h-[260px] overflow-y-auto">
        {collections.map((c) => (
          <button
            key={c.id}
            type="button"
            className="menu-item"
            onClick={() => {
              onMove(c.id);
              close();
            }}
          >
            <span className="coll-dot" style={{ background: `var(--hue-${c.color})` }} />
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
          </button>
        ))}
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            onMove(null);
            close();
          }}
        >
          <span className="coll-dot" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--text-faint)' }} />
          No collection
        </button>
      </div>
      <div className="my-1.5 h-px" style={{ background: 'var(--border)' }} />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            onCreateAndMove(draft);
            close();
          }
        }}
        placeholder="New collection, then Enter"
        aria-label="New collection"
        className="h-9 w-full rounded-lg bg-[var(--fill)] px-2.5 text-[13.5px] font-medium outline-none"
      />
    </div>
  );
}

// Appears at the bottom while books are selected.
export function BulkBar({
  books,
  collections,
  allTags,
  onAddTag,
  onRemoveTag,
  onMove,
  onCreateAndMove,
  onDelete,
  onClose,
}: {
  books: Book[];
  collections: Collection[];
  allTags: TagCount[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onMove: (id: string | null) => void;
  onCreateAndMove: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-3">
      <motion.div
        role="toolbar"
        aria-label="Selected books"
        className="pop pointer-events-auto flex !min-w-0 items-center gap-0.5 !p-1.5"
        style={{ position: 'static' }}
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        <span className="tnum whitespace-nowrap px-3 text-[13.5px] font-semibold">{books.length} selected</span>
        <span className="tool-sep" aria-hidden />

        <Popover
          placement="top"
          trigger={({ open, toggle }) => (
            <button type="button" className="btn !bg-transparent" aria-expanded={open} onClick={toggle}>
              <Tag size={15} strokeWidth={2} /> Tag
            </button>
          )}
        >
          {() => <TagPicker books={books} allTags={allTags} onAdd={onAddTag} onRemove={onRemoveTag} />}
        </Popover>

        <Popover
          placement="top"
          trigger={({ open, toggle }) => (
            <button type="button" className="btn !bg-transparent" aria-expanded={open} onClick={toggle}>
              <FolderInput size={15} strokeWidth={2} /> Move
            </button>
          )}
        >
          {(close) => <MovePicker collections={collections} onMove={onMove} onCreateAndMove={onCreateAndMove} close={close} />}
        </Popover>

        <button type="button" className="btn !bg-transparent hover:!text-[#e5484d]" onClick={onDelete}>
          <Trash2 size={15} strokeWidth={2} /> Delete
        </button>

        <span className="tool-sep" aria-hidden />
        <button type="button" className="tool" aria-label="Done selecting" title="Done" onClick={onClose}>
          <X size={17} strokeWidth={2.2} />
        </button>
      </motion.div>
    </div>
  );
}

// Edit one book's collection and tags, from the "…" menu on its card.
export function BookDetailsDialog({
  book,
  collections,
  allTags,
  onClose,
  onSetCollection,
  onAddTag,
  onRemoveTag,
  onCreateCollection,
}: {
  book: Book;
  collections: Collection[];
  allTags: TagCount[];
  onClose: () => void;
  onSetCollection: (id: string | null) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onCreateCollection: (name: string) => void;
}) {
  const [tagDraft, setTagDraft] = useState('');
  const [collDraft, setCollDraft] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const suggestions = allTags.filter(({ tag }) => !hasTag(book, tag)).slice(0, 8);

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <motion.div
        role="dialog"
        aria-label="Tags and collection"
        className="relative max-h-[88vh] w-full max-w-[440px] overflow-y-auto rounded-3xl p-5"
        style={{ background: 'var(--surface)', boxShadow: '0 30px 80px -20px rgb(0 0 0 / 0.5), inset 0 0 0 1px var(--hairline)' }}
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold" style={{ color: 'var(--text-faint)' }}>
              Tags &amp; collection
            </div>
            <div className="mt-0.5 line-clamp-2 text-[16px] font-semibold leading-snug tracking-[-0.012em]">{book.title}</div>
          </div>
          <button type="button" className="tool" aria-label="Close" onClick={onClose}>
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>

        <div className="pb-2 pt-5 text-[12px] font-semibold" style={{ color: 'var(--text-faint)' }}>
          Collection
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="coll-chip" data-active={book.collection_id === null} onClick={() => onSetCollection(null)}>
            None
          </button>
          {collections.map((c) => (
            <button key={c.id} type="button" className="coll-chip" data-active={book.collection_id === c.id} onClick={() => onSetCollection(c.id)}>
              <span className="coll-dot" style={{ background: `var(--hue-${c.color})` }} />
              {c.name}
            </button>
          ))}
          <input
            value={collDraft}
            onChange={(e) => setCollDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && collDraft.trim()) {
                onCreateCollection(collDraft);
                setCollDraft('');
              }
            }}
            placeholder="+ New collection"
            aria-label="New collection"
            className="h-8 w-[150px] rounded-full bg-[var(--fill)] px-3.5 text-[13px] font-medium outline-none"
          />
        </div>

        <div className="pb-2 pt-5 text-[12px] font-semibold" style={{ color: 'var(--text-faint)' }}>
          Tags
        </div>
        <div className="flex flex-wrap gap-2">
          {book.tags.map((t) => (
            <span key={t} className="tag-chip !h-7 !pl-3 !pr-1.5 !text-[13px]">
              {t}
              <button type="button" className="grid h-5 w-5 place-items-center rounded-full hover:bg-[var(--fill-strong)]" aria-label={`Remove tag ${t}`} onClick={() => onRemoveTag(t)}>
                <X size={12} strokeWidth={2.6} />
              </button>
            </span>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tagDraft.trim()) {
                onAddTag(tagDraft);
                setTagDraft('');
              }
            }}
            placeholder="+ Add a tag"
            aria-label="Add a tag"
            className="h-7 w-[130px] rounded-full bg-[var(--fill)] px-3 text-[13px] font-medium outline-none"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
              Your tags:
            </span>
            {suggestions.map(({ tag }) => (
              <button key={tag} type="button" className="tag-chip hover:!bg-[var(--fill-strong)]" onClick={() => onAddTag(tag)}>
                <Plus size={11} strokeWidth={2.6} /> {tag}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}