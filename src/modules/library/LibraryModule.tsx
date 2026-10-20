'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { BookOpenText, DatabaseZap, Plus, Search, SearchX, TriangleAlert, UploadCloud, X } from 'lucide-react';
import SegmentedControl from '@/components/SegmentedControl';
import StateMessage from '@/components/StateMessage';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Book } from '@/lib/types';
import { useBooks } from './useBooks';
import BookCard, { UploadCard } from './BookCard';
import PdfReader from './PdfReader';
import { isFinished, isStarted, progressOf } from './helpers';

type SortMode = 'added' | 'title' | 'progress';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'added', label: 'Added' },
  { value: 'title', label: 'Title' },
  { value: 'progress', label: 'Progress' },
];

// Books you opened within this many days appear in "Continue reading".
const RECENT_DAYS = 3;

function SectionHeader({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-3">
      <h2 className="text-[19px] font-semibold tracking-[-0.016em]">{title}</h2>
      <span className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
        {note}
      </span>
    </div>
  );
}

export default function LibraryModule() {
  const {
    books,
    loading,
    error,
    covers,
    jobs,
    reload,
    addFiles,
    dismissJob,
    renameBook,
    deleteBook,
    saveProgress,
    markOpened,
    getBookUrl,
  } = useBooks();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('added');
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [intro, setIntro] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => setIntro(false), 1200);
    return () => clearTimeout(t);
  }, [loading]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? books.filter((b) => b.title.toLowerCase().includes(q) || (b.author ?? '').toLowerCase().includes(q))
      : [...books];
    const time = (s: string | null) => (s ? new Date(s).getTime() : 0);
    const byTitle = (a: Book, b: Book) => a.title.localeCompare(b.title, undefined, { numeric: true });
    if (sort === 'title') list.sort(byTitle);
    else if (sort === 'progress') list.sort((a, b) => progressOf(b) - progressOf(a) || byTitle(a, b));
    else list.sort((a, b) => time(b.created_at) - time(a.created_at));
    return list;
  }, [books, query, sort]);

  // Books you've opened lately get their own shelf, so reading never gets lost in a big library.
  const searching = query.trim().length > 0;
  const recent = useMemo(() => {
    if (searching) return [];
    const cutoff = Date.now() - RECENT_DAYS * 86400000;
    return books
      .filter((b) => b.last_opened_at && new Date(b.last_opened_at).getTime() > cutoff)
      .sort((a, b) => new Date(b.last_opened_at as string).getTime() - new Date(a.last_opened_at as string).getTime());
  }, [books, searching]);
  const rest = useMemo(() => {
    const ids = new Set(recent.map((b) => b.id));
    return visible.filter((b) => !ids.has(b.id));
  }, [visible, recent]);

  const inProgress = books.filter((b) => isStarted(b) && !isFinished(b)).length;
  const open: Book | null = books.find((b) => b.id === openId) ?? null;

  // Keyed by id only, so saving your reading progress never re-opens the book.
  const openRef = useRef<Book | null>(open);
  openRef.current = open;
  const openKey = open?.id;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getUrl = useCallback(() => getBookUrl(openRef.current as Book), [getBookUrl, openKey]);

  function handleFiles(files: File[]) {
    if (files.length > 0) addFiles(files);
  }

  function openBook(book: Book) {
    markOpened(book.id);
    setOpenId(book.id);
  }

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

  if (error && books.length === 0) {
    return (
      <div className="h-full" style={{ background: 'var(--bg)' }}>
        <StateMessage
          icon={<TriangleAlert size={22} strokeWidth={1.8} />}
          title="Couldn’t load your library"
          body={
            /relation .* does not exist/i.test(error)
              ? 'The books table doesn’t exist in Supabase yet. Run the Library setup SQL, then try again.'
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

  if (open) {
    return (
      <PdfReader
        key={open.id}
        book={open}
        getUrl={getUrl}
        onClose={() => setOpenId(null)}
        onProgress={(page) => saveProgress(open.id, page)}
      />
    );
  }

  const summary =
    books.length === 0
      ? 'Add PDF books to read them here.'
      : `${books.length} ${books.length === 1 ? 'book' : 'books'}` +
        (inProgress > 0 ? `, ${inProgress} in progress.` : '.');

  const showEmpty = !loading && books.length === 0 && jobs.length === 0;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative h-full"
        style={{ background: 'var(--bg)' }}
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          handleFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />

        <div className="h-full overflow-y-auto">
          <div className="mx-auto max-w-[1400px]">
            <div className="flex items-end justify-between gap-4 px-5 pb-5 pt-8 md:px-8 md:pt-10">
              <div className="min-w-0">
                <h1 className="text-[30px] font-semibold leading-9 tracking-[-0.022em]">Library</h1>
                {!loading && (
                  <p className="mt-1 text-[14.5px]" style={{ color: 'var(--text-dim)' }}>
                    {summary}
                  </p>
                )}
              </div>
              <button type="button" className="btn btn-primary shrink-0" onClick={() => fileInput.current?.click()}>
                <Plus size={16} strokeWidth={2.2} />
                Add books
              </button>
            </div>
          </div>

          <div className="hl-bar sticky top-0 z-10">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-5 py-3 md:px-8">
              <div className="search min-w-[220px] max-w-[460px] flex-1" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
                <Search size={16} strokeWidth={2} style={{ color: 'var(--text-faint)' }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title or author"
                  aria-label="Search books"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery('')}
                    className="grid h-5 w-5 place-items-center rounded-full"
                    style={{ background: 'var(--fill-strong)', color: 'var(--text-dim)' }}
                  >
                    <X size={12} strokeWidth={2.4} />
                  </button>
                )}
              </div>
              <div className="w-full md:ml-auto md:w-auto">
                <SegmentedControl label="Sort books" options={SORT_OPTIONS} value={sort} onChange={setSort} />
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-[1400px] px-5 pb-24 pt-8 md:px-8">
            {loading ? (
              <div className="book-grid" aria-busy="true" aria-label="Loading library">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 'auto', aspectRatio: '2 / 3', borderRadius: 9 }} />
                ))}
              </div>
            ) : showEmpty ? (
              <StateMessage
                icon={<BookOpenText size={22} strokeWidth={1.8} />}
                title="Your library is empty"
                body="Add PDF books to read them here. Your place in each one is saved, so you can pick up where you left off."
                action={
                  <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>
                    <Plus size={16} strokeWidth={2.2} />
                    Add books
                  </button>
                }
              />
            ) : visible.length === 0 && jobs.length === 0 ? (
              <StateMessage
                icon={<SearchX size={22} strokeWidth={1.8} />}
                title="No books match"
                body="Try a different title or author."
                action={
                  <button type="button" className="btn" onClick={() => setQuery('')}>
                    Clear search
                  </button>
                }
              />
            ) : (
              <div>
                {recent.length > 0 && (
                  <section className="mb-14">
                    <SectionHeader title="Continue reading" note={`Opened in the last ${RECENT_DAYS} days`} />
                    <div className="book-grid">
                      {recent.map((b, i) => (
                        <BookCard
                          key={b.id}
                          book={b}
                          coverUrl={covers[b.id]}
                          index={i}
                          animateIn={intro}
                          onOpen={() => openBook(b)}
                          onRename={(title) => renameBook(b.id, title)}
                          onDelete={() => deleteBook(b)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {(rest.length > 0 || jobs.length > 0) && (
                  <section>
                    {recent.length > 0 && (
                      <SectionHeader title="All books" note={`${rest.length} ${rest.length === 1 ? 'book' : 'books'}`} />
                    )}
                    <div className="book-grid">
                      {jobs.map((j) => (
                        <UploadCard key={j.id} job={j} onDismiss={() => dismissJob(j.id)} />
                      ))}
                      {rest.map((b, i) => (
                        <BookCard
                          key={b.id}
                          book={b}
                          coverUrl={covers[b.id]}
                          index={i + recent.length}
                          animateIn={intro}
                          onOpen={() => openBook(b)}
                          onRename={(title) => renameBook(b.id, title)}
                          onDelete={() => deleteBook(b)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>

        {dragging && (
          <div
            className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-3xl"
            style={{
              background: 'color-mix(in srgb, var(--accent) 8%, var(--bg))',
              boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--accent) 60%, transparent)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <UploadCloud size={34} strokeWidth={1.6} style={{ color: 'var(--accent)' }} />
              <div className="text-[17px] font-semibold tracking-[-0.012em]">Drop PDFs to add them</div>
              <div className="text-[13.5px]" style={{ color: 'var(--text-dim)' }}>
                They’ll be added to your library.
              </div>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}