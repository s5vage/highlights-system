'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { BookOpenText, DatabaseZap, ListChecks, Plus, Search, SearchX, TriangleAlert, UploadCloud, X } from 'lucide-react';
import SegmentedControl from '@/components/SegmentedControl';
import StateMessage from '@/components/StateMessage';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Book } from '@/lib/types';
import { useBooks } from './useBooks';
import { useCollections } from './useCollections';
import BookCard, { UploadCard } from './BookCard';
import PdfReader from './PdfReader';
import { BookDetailsDialog, BulkBar } from './BulkTools';
import { CollectionBar, CollectionFilter, StorageMeter, TagFilter } from './LibraryOrganize';
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

function friendlyDb(message: string): string {
  return /column|book_collections|schema cache|does not exist/i.test(message)
    ? 'Collections and tags need the latest Library setup SQL in Supabase.'
    : message;
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
    deleteBooks,
    saveProgress,
    markOpened,
    moveBooks,
    clearCollection,
    addTags,
    removeTags,
    renameTag,
    deleteTag,
    getBookUrl,
  } = useBooks();
  const collectionsApi = useCollections();
  const { collections } = collectionsApi;

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('added');
  const [collFilter, setCollFilter] = useState<CollectionFilter>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [intro, setIntro] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => setIntro(false), 1200);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (collectionsApi.error) setNotice(friendlyDb(collectionsApi.error));
  }, [collectionsApi.error]);


    // Opened from the Graph: jump straight into that book.
  useEffect(() => {
    function openFromGraph() {
      if (loading) return;
      let want: string | null = null;
      try {
        want = sessionStorage.getItem('lib_open_book');
      } catch {
        return;
      }
      if (!want) return;
      const book = books.find((b) => b.id === want);
      sessionStorage.removeItem('lib_open_book');
      if (book) openBook(book);
    }
    openFromGraph();
    window.addEventListener('lib-open-book', openFromGraph);
    return () => window.removeEventListener('lib-open-book', openFromGraph);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, books]);
  // Shows a message if a save to the database failed.
  const run = useCallback(async (job: Promise<string | null>) => {
    const err = await job;
    if (err) setNotice(friendlyDb(err));
  }, []);

  // Every tag in the library, with how many books use it.
  const allTags = useMemo(() => {
    const map = new Map<string, { tag: string; count: number }>();
    books.forEach((b) =>
      b.tags.forEach((t) => {
        const key = t.toLowerCase();
        const entry = map.get(key);
        if (entry) entry.count++;
        else map.set(key, { tag: t, count: 1 });
      })
    );
    return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [books]);

  // If the collection or tag you were filtering by goes away, go back to everything.
  useEffect(() => {
    if (collFilter !== 'all' && collFilter !== 'none' && !collections.some((c) => c.id === collFilter)) {
      setCollFilter('all');
    }
  }, [collections, collFilter]);
  useEffect(() => {
    if (tagFilter && !allTags.some((t) => t.tag.toLowerCase() === tagFilter.toLowerCase())) setTagFilter(null);
  }, [allTags, tagFilter]);

  const searching = query.trim().length > 0;
  const filtering = searching || collFilter !== 'all' || tagFilter !== null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...books];
    if (q) list = list.filter((b) => b.title.toLowerCase().includes(q) || (b.author ?? '').toLowerCase().includes(q));
    if (collFilter === 'none') list = list.filter((b) => !b.collection_id);
    else if (collFilter !== 'all') list = list.filter((b) => b.collection_id === collFilter);
    if (tagFilter) list = list.filter((b) => b.tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase()));
    const time = (s: string | null) => (s ? new Date(s).getTime() : 0);
    const byTitle = (a: Book, b: Book) => a.title.localeCompare(b.title, undefined, { numeric: true });
    if (sort === 'title') list.sort(byTitle);
    else if (sort === 'progress') list.sort((a, b) => progressOf(b) - progressOf(a) || byTitle(a, b));
    else list.sort((a, b) => time(b.created_at) - time(a.created_at));
    return list;
  }, [books, query, sort, collFilter, tagFilter]);

  // Books you've opened lately get their own shelf (only when you're looking at everything).
  const recent = useMemo(() => {
    if (filtering) return [];
    const cutoff = Date.now() - RECENT_DAYS * 86400000;
    return books
      .filter((b) => b.last_opened_at && new Date(b.last_opened_at).getTime() > cutoff)
      .sort((a, b) => new Date(b.last_opened_at as string).getTime() - new Date(a.last_opened_at as string).getTime());
  }, [books, filtering]);
  const rest = useMemo(() => {
    const ids = new Set(recent.map((b) => b.id));
    return visible.filter((b) => !ids.has(b.id));
  }, [visible, recent]);

  const collectionById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);
  const usedBytes = useMemo(() => books.reduce((sum, b) => sum + (b.size_bytes || 0), 0), [books]);
  const inProgress = books.filter((b) => isStarted(b) && !isFinished(b)).length;
  const open: Book | null = books.find((b) => b.id === openId) ?? null;
  const detailsBook = books.find((b) => b.id === detailsId) ?? null;
  const selectedBooks = useMemo(() => books.filter((b) => selected.has(b.id)), [books, selected]);

  // Keyed by id only, so saving your reading progress never re-opens the book.
  const openRef = useRef<Book | null>(open);
  openRef.current = open;
  const openKey = open?.id;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getUrl = useCallback(() => getBookUrl(openRef.current as Book), [getBookUrl, openKey]);

  // ── Selecting books ──
  function toggleSelect(id: string) {
    setSelectMode(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);
  const shownIds = (filtering ? visible : [...recent, ...rest]).map((b) => b.id);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selected.has(id));

  useEffect(() => {
    if (!selectMode || detailsId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') exitSelect();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectMode, detailsId, exitSelect]);

  // ── Bulk actions ──
  const ids = [...selected];
  function bulkDelete() {
    const n = ids.length;
    if (n === 0) return;
    if (confirm(`Delete ${n} ${n === 1 ? 'book' : 'books'}? The PDFs will be removed for good.`)) {
      deleteBooks(ids);
      exitSelect();
    }
  }
  async function createAndMove(name: string, targets: string[]) {
    const created = await collectionsApi.create(name);
    if (created) run(moveBooks(targets, created.id));
  }
  async function removeCollection(id: string) {
    await collectionsApi.remove(id);
    clearCollection(id);
    if (collFilter === id) setCollFilter('all');
  }

  function handleFiles(files: File[]) {
    if (files.length > 0) addFiles(files);
  }

  function openBook(book: Book) {
    markOpened(book.id);
    setOpenId(book.id);
  }

  function renderCard(b: Book, i: number) {
    return (
      <BookCard
        key={b.id}
        book={b}
        coverUrl={covers[b.id]}
        index={i}
        animateIn={intro}
        collection={b.collection_id ? collectionById.get(b.collection_id) : undefined}
        selectMode={selectMode}
        selected={selected.has(b.id)}
        onToggleSelect={() => toggleSelect(b.id)}
        onOpen={() => openBook(b)}
        onRename={(title) => renameBook(b.id, title)}
        onEditDetails={() => setDetailsId(b.id)}
        onDelete={() => deleteBooks([b.id])}
      />
    );
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
                {!loading && books.length > 0 && <StorageMeter used={usedBytes} />}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selectMode && shownIds.length > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSelected(allShownSelected ? new Set() : new Set(shownIds))}
                  >
                    {allShownSelected ? 'Clear' : 'Select all'}
                  </button>
                )}
                {books.length > 0 && (
                  <button type="button" className="btn" onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}>
                    <ListChecks size={16} strokeWidth={2} />
                    {selectMode ? 'Done' : 'Select'}
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>
                  <Plus size={16} strokeWidth={2.2} />
                  Add books
                </button>
              </div>
            </div>
          </div>

          <div className="hl-bar sticky top-0 z-10">
            <div className="mx-auto max-w-[1400px]">
              <div className="flex flex-wrap items-center gap-3 px-5 py-3 md:px-8">
                <div className="search min-w-[200px] max-w-[460px] flex-1" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
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
                <TagFilter
                  tags={allTags}
                  value={tagFilter}
                  onChange={setTagFilter}
                  onRename={(from, to) => {
                    run(renameTag(from, to));
                    if (tagFilter && tagFilter.toLowerCase() === from.toLowerCase()) setTagFilter(to.trim());
                  }}
                  onDelete={(tag) => run(deleteTag(tag))}
                />
                <div className="w-full md:ml-auto md:w-auto">
                  <SegmentedControl label="Sort books" options={SORT_OPTIONS} value={sort} onChange={setSort} />
                </div>
              </div>
              {books.length > 0 && (
                <CollectionBar
                  collections={collections}
                  books={books}
                  value={collFilter}
                  onChange={setCollFilter}
                  onCreate={(name) => collectionsApi.create(name)}
                  onRename={(id, name) => collectionsApi.rename(id, name)}
                  onRecolor={(id, color) => collectionsApi.recolor(id, color)}
                  onDelete={removeCollection}
                />
              )}
            </div>
          </div>

          <div className="mx-auto max-w-[1400px] px-5 pb-32 pt-8 md:px-8">
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
                title={searching ? 'No books match' : 'Nothing here yet'}
                body={
                  searching
                    ? 'Try a different title or author.'
                    : 'No books in this view. Select some books and use Move or Tag to add them.'
                }
                action={
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setQuery('');
                      setCollFilter('all');
                      setTagFilter(null);
                    }}
                  >
                    Show all books
                  </button>
                }
              />
            ) : (
              <div>
                {recent.length > 0 && (
                  <section className="mb-14">
                    <SectionHeader title="Continue reading" note={`Opened in the last ${RECENT_DAYS} days`} />
                    <div className="book-grid">{recent.map((b, i) => renderCard(b, i))}</div>
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
                      {rest.map((b, i) => renderCard(b, i + recent.length))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>

        {selectMode && selected.size > 0 && (
          <BulkBar
            books={selectedBooks}
            collections={collections}
            allTags={allTags}
            onAddTag={(tag) => run(addTags(ids, [tag]))}
            onRemoveTag={(tag) => run(removeTags(ids, [tag]))}
            onMove={(id) => run(moveBooks(ids, id))}
            onCreateAndMove={(name) => createAndMove(name, ids)}
            onDelete={bulkDelete}
            onClose={exitSelect}
          />
        )}

        {detailsBook && (
          <BookDetailsDialog
            book={detailsBook}
            collections={collections}
            allTags={allTags}
            onClose={() => setDetailsId(null)}
            onSetCollection={(id) => run(moveBooks([detailsBook.id], id))}
            onAddTag={(tag) => run(addTags([detailsBook.id], [tag]))}
            onRemoveTag={(tag) => run(removeTags([detailsBook.id], [tag]))}
            onCreateCollection={(name) => createAndMove(name, [detailsBook.id])}
          />
        )}

        {notice && (
          <div className="pop !min-w-0 !px-4 !py-2.5 text-[13px] font-medium" style={{ left: '50%', bottom: 88, top: 'auto', transform: 'translateX(-50%)' }} role="status">
            {notice}
          </div>
        )}

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