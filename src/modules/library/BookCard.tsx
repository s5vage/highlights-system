'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpenText, Check, MoreHorizontal, Pencil, Trash2, TriangleAlert, X } from 'lucide-react';
import Popover from '@/components/Popover';
import { Book } from '@/lib/types';
import { UploadJob } from './useBooks';
import { formatSize, hueForTitle, isFinished, isStarted, progressOf } from './helpers';

interface Props {
  book: Book;
  coverUrl?: string;
  index: number;
  animateIn: boolean;
  onOpen: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

export default function BookCard({ book, coverUrl, index, animateIn, onOpen, onRename, onDelete }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(book.title);
  const [coverFailed, setCoverFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  function commitRename() {
    if (draft.trim() && draft.trim() !== book.title) onRename(draft);
    setRenaming(false);
  }

  const pct = progressOf(book);
  const finished = isFinished(book);
  const started = isStarted(book);

  return (
    <motion.div
      className="book-card"
      initial={animateIn ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: animateIn ? Math.min(index, 12) * 0.035 : 0, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={onOpen}
        aria-label={`Open ${book.title}`}
        className="block w-full text-left"
      >
        <div className="book-cover" style={{ '--hue': `var(--hue-${hueForTitle(book.title)})` } as React.CSSProperties}>
          {coverUrl && !coverFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" draggable={false} onError={() => setCoverFailed(true)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
              <BookOpenText size={26} strokeWidth={1.6} style={{ color: 'var(--hue)' }} />
              <span className="line-clamp-4 text-[12.5px] font-semibold leading-snug tracking-[-0.01em]">{book.title}</span>
            </div>
          )}
        </div>
      </motion.button>

      <div className="mt-3 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setDraft(book.title);
                  setRenaming(false);
                }
              }}
              aria-label="Book title"
              className="w-full rounded-md bg-[var(--fill)] px-1.5 py-0.5 text-[13.5px] font-semibold outline-none"
            />
          ) : (
            <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug tracking-[-0.008em]">{book.title}</div>
          )}
          <div className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {book.author || `${book.page_count} pages`}
          </div>

          <div className="mt-2 flex items-center gap-2">
            {finished ? (
              <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--text-dim)' }}>
                <Check size={13} strokeWidth={2.4} /> Finished
              </span>
            ) : started ? (
              <>
                <div className="progress flex-1">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="tnum text-[12px] font-medium" style={{ color: 'var(--text-dim)' }}>
                  {pct}%
                </span>
              </>
            ) : (
              <span className="text-[12px] font-medium" style={{ color: 'var(--accent)' }}>
                New
              </span>
            )}
          </div>
        </div>

        <Popover
          align="right"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              className="tool !h-7 !w-7"
              data-active={open ? 'true' : 'false'}
              aria-label={`Options for ${book.title}`}
              aria-expanded={open}
              onClick={toggle}
            >
              <MoreHorizontal size={16} strokeWidth={2} />
            </button>
          )}
        >
          {(close) => (
            <div className="flex min-w-[190px] flex-col">
              <div className="px-2.5 pb-1.5 pt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                {formatSize(book.size_bytes)}
              </div>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  close();
                  setDraft(book.title);
                  setRenaming(true);
                }}
              >
                <Pencil size={15} strokeWidth={1.9} /> Rename
              </button>
              <button
                type="button"
                className="menu-item hover:!text-[#e5484d]"
                onClick={() => {
                  close();
                  if (confirm(`Delete “${book.title}”? The PDF will be removed from your library.`)) onDelete();
                }}
              >
                <Trash2 size={15} strokeWidth={1.9} /> Delete
              </button>
            </div>
          )}
        </Popover>
      </div>
    </motion.div>
  );
}

// Shown in the grid while a book is being added (or if adding it failed).
export function UploadCard({ job, onDismiss }: { job: UploadJob; onDismiss: () => void }) {
  const failed = job.status === 'error';
  return (
    <div>
      <div
        className="book-cover grid place-items-center p-4 text-center"
        style={{ background: failed ? 'color-mix(in srgb, var(--hue-red) 12%, var(--surface))' : undefined }}
      >
        {failed ? (
          <div className="flex flex-col items-center gap-2">
            <TriangleAlert size={22} strokeWidth={1.8} style={{ color: 'var(--hue-red)' }} />
            <span className="text-[12px] leading-snug" style={{ color: 'var(--text-dim)' }}>
              {job.message}
            </span>
          </div>
        ) : (
          <div className="skeleton absolute inset-0 !h-full !rounded-none" aria-hidden />
        )}
      </div>
      <div className="mt-3 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{job.name.replace(/\.pdf$/i, '')}</div>
          <div className="mt-0.5 text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {failed ? 'Couldn’t add this book' : `Adding, ${formatSize(job.size)}`}
          </div>
          {!failed && (
            <div className="progress indeterminate mt-2">
              <span />
            </div>
          )}
        </div>
        {failed && (
          <button type="button" className="tool !h-7 !w-7" aria-label="Dismiss" onClick={onDismiss}>
            <X size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}