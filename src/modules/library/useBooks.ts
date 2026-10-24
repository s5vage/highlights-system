'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Book } from '@/lib/types';
import { readPdfMeta } from './pdf';
import { STORAGE_LIMIT_BYTES, canonicalTag, formatSize, formatStorage, parseFilename } from './helpers';
import { R2NotConfigured, putWithProgress, r2 } from './r2';

export const BUCKET = 'books'; // Supabase bucket: covers, plus any books added before cloud storage
const MAX_CLOUD_BYTES = 300 * 1024 * 1024;
const MAX_SUPABASE_BYTES = 50 * 1024 * 1024; // the Supabase free plan limit per file

export interface UploadJob {
  id: string;
  name: string;
  size: number;
  status: 'working' | 'error';
  phase: 'preparing' | 'uploading';
  progress: number; // 0 to 1, while uploading
  message?: string;
}

function friendly(message: string): string {
  if (/bucket not found/i.test(message)) {
    return 'The “books” storage bucket doesn’t exist yet. Run the Library setup SQL in Supabase, then try again.';
  }
  if (/row-level security|policy|not authorized|unauthorized/i.test(message)) {
    return 'Storage permissions are missing. Run the Library setup SQL in Supabase, then try again.';
  }
  if (/exceeded the maximum allowed size|payload too large|too large/i.test(message)) {
    return 'That file is over your storage limit.';
  }
  return message;
}

// Older rows (or a database that hasn't had the latest setup SQL) may lack the newer fields.
const normalize = (b: Book): Book => ({ ...b, tags: b.tags ?? [], collection_id: b.collection_id ?? null });

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const booksRef = useRef<Book[]>([]);
  booksRef.current = books;

  // Only the first load (or a retry) shows the loading state; realtime updates are quiet.
  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setBooks(((data as Book[]) ?? []).map(normalize));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(true);
    const channel = supabase
      .channel('books-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  // Covers live in a private Supabase bucket, so each one needs a signed link. One request signs them all.
  const coverKey = books.map((b) => b.cover_path ?? '').join('|');
  useEffect(() => {
    const withCover = books.filter((b) => b.cover_path);
    if (withCover.length === 0) {
      setCovers({});
      return;
    }
    let cancelled = false;
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(
        withCover.map((b) => b.cover_path as string),
        6 * 3600
      )
      .then(({ data }) => {
        if (cancelled || !data) return;
        const byPath = new Map(data.map((d) => [d.path, d.signedUrl]));
        setCovers((prev) => {
          const next: Record<string, string> = {};
          withCover.forEach((b) => {
            const url = prev[b.id] ?? byPath.get(b.cover_path as string);
            if (url) next[b.id] = url;
          });
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverKey]);

  const patchJob = useCallback((jobId: string, patch: Partial<UploadJob>) => {
    setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, ...patch } : x)));
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      const jobId = crypto.randomUUID();
      setJobs((j) => [
        ...j,
        { id: jobId, name: file.name, size: file.size, status: 'working', phase: 'preparing', progress: 0 },
      ]);

      try {
        if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
          throw new Error('Only PDF files can be added.');
        }
        if (file.size > MAX_CLOUD_BYTES) {
          throw new Error(`This file is ${formatSize(file.size)}. Books can be up to 300 MB each.`);
        }
        const used = booksRef.current.reduce((sum, b) => sum + (b.size_bytes || 0), 0);
        if (used + file.size > STORAGE_LIMIT_BYTES) {
          throw new Error(
            `Not enough space: ${formatStorage(used)} of 10 GB used, and this book is ${formatStorage(file.size)}. Delete some books first.`
          );
        }

        const id = crypto.randomUUID();
        const filePath = `${id}.pdf`;
        const coverPath = `covers/${id}.jpg`;

        let meta;
        try {
          meta = await readPdfMeta(file);
        } catch {
          throw new Error('This PDF couldn’t be opened. It may be damaged or password-protected.');
        }

        let coverUploaded = false;
        if (meta.cover) {
          const res = await supabase.storage.from(BUCKET).upload(coverPath, meta.cover, { contentType: 'image/jpeg' });
          coverUploaded = !res.error;
        }
        const removeCover = async () => {
          if (coverUploaded) await supabase.storage.from(BUCKET).remove([coverPath]);
        };

        // The big PDF goes to cloud storage. If that isn't set up yet, small books fall back to Supabase.
        let storage: 'r2' | 'supabase' = 'r2';
        try {
          const { url } = await r2('put', id);
          patchJob(jobId, { phase: 'uploading', progress: 0 });
          await putWithProgress(url as string, file, (p) => patchJob(jobId, { progress: p }));
        } catch (e) {
          if (e instanceof R2NotConfigured && file.size <= MAX_SUPABASE_BYTES) {
            storage = 'supabase';
            patchJob(jobId, { phase: 'uploading', progress: 0 });
            const up = await supabase.storage.from(BUCKET).upload(filePath, file, { contentType: 'application/pdf' });
            if (up.error) {
              await removeCover();
              throw new Error(friendly(up.error.message));
            }
          } else {
            await removeCover();
            if (e instanceof R2NotConfigured) {
              throw new Error(`${e.message} Until then, only books up to 50 MB can be added.`);
            }
            throw e;
          }
        }

        const parsed = parseFilename(file.name);
        const { data, error } = await supabase
          .from('books')
          .insert({
            id,
            title: parsed.title,
            author: meta.author ?? parsed.author,
            file_path: filePath,
            cover_path: coverUploaded ? coverPath : null,
            size_bytes: file.size,
            page_count: meta.pageCount,
            last_page: 1,
            storage,
          })
          .select()
          .single();

        if (error) {
          if (storage === 'r2') await r2('delete', id).catch(() => null);
          else await supabase.storage.from(BUCKET).remove([filePath]);
          await removeCover();
          throw new Error(
            /relation .* does not exist|column .* does not exist/i.test(error.message)
              ? 'The Library tables need updating. Run the Library setup SQL in Supabase, then try again.'
              : error.message
          );
        }

        if (meta.cover && coverUploaded) {
          const local = URL.createObjectURL(meta.cover);
          setCovers((prev) => ({ ...prev, [id]: local }));
        }
        setBooks((prev) => [normalize(data as Book), ...prev]);
        setJobs((j) => j.filter((x) => x.id !== jobId));
      } catch (e) {
        patchJob(jobId, {
          status: 'error',
          message: e instanceof Error ? e.message : 'Something went wrong while adding this book.',
        });
      }
    },
    [patchJob]
  );

  // Books are added one at a time so a big batch doesn't flood the connection.
  const addFiles = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        queue.current = queue.current.then(() => processFile(file));
      });
    },
    [processFile]
  );

  const dismissJob = useCallback((id: string) => setJobs((j) => j.filter((x) => x.id !== id)), []);

  const renameBook = useCallback(async (id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, title: clean } : b)));
    await supabase.from('books').update({ title: clean }).eq('id', id);
  }, []);

  // Removes the files (PDF + cover) for these books, wherever they are stored.
  const removeFiles = useCallback(async (targets: Book[]) => {
    await Promise.all(
      targets.map(async (book) => {
        if (book.storage === 'r2') {
          await r2('delete', book.id).catch(() => null);
          if (book.cover_path) await supabase.storage.from(BUCKET).remove([book.cover_path]);
        } else {
          await supabase.storage.from(BUCKET).remove([book.file_path, ...(book.cover_path ? [book.cover_path] : [])]);
        }
      })
    );
  }, []);

  // Delete one or many books. Their highlights on the pages go with them; the copies saved in Highlights stay.
  const deleteBooks = useCallback(
    async (ids: string[]) => {
      const targets = booksRef.current.filter((b) => ids.includes(b.id));
      if (targets.length === 0) return;
      setBooks((prev) => prev.filter((b) => !ids.includes(b.id)));
      await removeFiles(targets);
      const { error } = await supabase.from('books').delete().in('id', ids);
      if (error) load();
    },
    [load, removeFiles]
  );

  const deleteBook = useCallback((book: Book) => deleteBooks([book.id]), [deleteBooks]);

  const saveProgress = useCallback(async (id: string, page: number) => {
    const now = new Date().toISOString();
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, last_page: page, last_opened_at: now } : b)));
    await supabase.from('books').update({ last_page: page, last_opened_at: now }).eq('id', id);
  }, []);

  const markOpened = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, last_opened_at: now } : b)));
    await supabase.from('books').update({ last_opened_at: now }).eq('id', id);
  }, []);

  // ── Collections and tags ──
  // Each of these returns an error message, or null when it worked.

  const moveBooks = useCallback(
    async (ids: string[], collectionId: string | null): Promise<string | null> => {
      if (ids.length === 0) return null;
      setBooks((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, collection_id: collectionId } : b)));
      const { error } = await supabase.from('books').update({ collection_id: collectionId }).in('id', ids);
      if (error) {
        load();
        return error.message;
      }
      return null;
    },
    [load]
  );

  // When a collection is deleted, its books stay and simply become "Unsorted".
  const clearCollection = useCallback((collectionId: string) => {
    setBooks((prev) => prev.map((b) => (b.collection_id === collectionId ? { ...b, collection_id: null } : b)));
  }, []);

  const writeTags = useCallback(
    async (changes: { id: string; tags: string[] }[]): Promise<string | null> => {
      if (changes.length === 0) return null;
      const byId = new Map(changes.map((c) => [c.id, c.tags]));
      setBooks((prev) => prev.map((b) => (byId.has(b.id) ? { ...b, tags: byId.get(b.id) as string[] } : b)));
      const results = await Promise.all(
        changes.map((c) => supabase.from('books').update({ tags: c.tags }).eq('id', c.id))
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        load();
        return failed.error.message;
      }
      return null;
    },
    [load]
  );

  const addTags = useCallback(
    (ids: string[], tags: string[]) => {
      const known = booksRef.current.flatMap((b) => b.tags);
      const clean: string[] = [];
      tags.forEach((t) => {
        const c = canonicalTag(t, [...known, ...clean]);
        if (c && !clean.some((x) => x.toLowerCase() === c.toLowerCase())) clean.push(c);
      });
      const changes = booksRef.current
        .filter((b) => ids.includes(b.id))
        .flatMap((b) => {
          const add = clean.filter((t) => !b.tags.some((x) => x.toLowerCase() === t.toLowerCase()));
          return add.length ? [{ id: b.id, tags: [...b.tags, ...add] }] : [];
        });
      return writeTags(changes);
    },
    [writeTags]
  );

  const removeTags = useCallback(
    (ids: string[], tags: string[]) => {
      const drop = tags.map((t) => t.toLowerCase());
      const changes = booksRef.current
        .filter((b) => ids.includes(b.id) && b.tags.some((t) => drop.includes(t.toLowerCase())))
        .map((b) => ({ id: b.id, tags: b.tags.filter((t) => !drop.includes(t.toLowerCase())) }));
      return writeTags(changes);
    },
    [writeTags]
  );

  const renameTag = useCallback(
    (from: string, to: string) => {
      const target = to.trim().replace(/\s+/g, ' ').slice(0, 32);
      if (!target) return Promise.resolve(null);
      const changes = booksRef.current
        .filter((b) => b.tags.some((t) => t.toLowerCase() === from.toLowerCase()))
        .map((b) => {
          const next: string[] = [];
          b.tags.forEach((t) => {
            const mapped = t.toLowerCase() === from.toLowerCase() ? target : t;
            if (!next.some((x) => x.toLowerCase() === mapped.toLowerCase())) next.push(mapped);
          });
          return { id: b.id, tags: next };
        });
      return writeTags(changes);
    },
    [writeTags]
  );

  const deleteTag = useCallback(
    (tag: string) =>
      removeTags(
        booksRef.current.map((b) => b.id),
        [tag]
      ),
    [removeTags]
  );

  const getBookUrl = useCallback(async (book: Book): Promise<string> => {
    if (book.storage === 'r2') {
      const { url } = await r2('get', book.id);
      if (!url) throw new Error('Couldn’t get a link to this book.');
      return url;
    }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(book.file_path, 2 * 3600);
    if (error || !data) throw new Error(error?.message || 'Couldn’t get a link to this book.');
    return data.signedUrl;
  }, []);

  return {
    books,
    loading,
    error,
    covers,
    jobs,
    reload: () => load(true),
    addFiles,
    dismissJob,
    renameBook,
    deleteBook,
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
  };
}