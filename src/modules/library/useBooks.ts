'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Book } from '@/lib/types';
import { readPdfMeta } from './pdf';
import { formatSize, titleFromFilename } from './helpers';

export const BUCKET = 'books';
const MAX_BYTES = 50 * 1024 * 1024; // the Supabase free plan limit per file

export interface UploadJob {
  id: string;
  name: string;
  size: number;
  status: 'working' | 'error';
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
    return 'That file is over your storage limit. The free plan allows up to 50 MB per file.';
  }
  return message;
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  // Only the first load (or a retry) shows the loading state; realtime updates are quiet.
  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setBooks((data as Book[]) ?? []);
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

  // Covers live in a private bucket, so each one needs a signed link. One request signs them all.
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

  const processFile = useCallback(async (file: File) => {
    const jobId = crypto.randomUUID();
    setJobs((j) => [...j, { id: jobId, name: file.name, size: file.size, status: 'working' }]);
    const fail = (message: string) =>
      setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, status: 'error', message } : x)));

    try {
      if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
        throw new Error('Only PDF files can be added.');
      }
      if (file.size > MAX_BYTES) {
        throw new Error(`This file is ${formatSize(file.size)}. The free plan allows up to 50 MB per file.`);
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

      const up = await supabase.storage.from(BUCKET).upload(filePath, file, { contentType: 'application/pdf' });
      if (up.error) {
        if (coverUploaded) await supabase.storage.from(BUCKET).remove([coverPath]);
        throw new Error(friendly(up.error.message));
      }

      const { data, error } = await supabase
        .from('books')
        .insert({
          id,
          title: titleFromFilename(file.name),
          author: meta.author,
          file_path: filePath,
          cover_path: coverUploaded ? coverPath : null,
          size_bytes: file.size,
          page_count: meta.pageCount,
          last_page: 1,
        })
        .select()
        .single();

      if (error) {
        await supabase.storage.from(BUCKET).remove([filePath, ...(coverUploaded ? [coverPath] : [])]);
        throw new Error(/relation .* does not exist/i.test(error.message)
          ? 'The “books” table doesn’t exist yet. Run the Library setup SQL in Supabase, then try again.'
          : error.message);
      }

      if (meta.cover && coverUploaded) {
        const local = URL.createObjectURL(meta.cover);
        setCovers((prev) => ({ ...prev, [id]: local }));
      }
      setBooks((prev) => [data as Book, ...prev]);
      setJobs((j) => j.filter((x) => x.id !== jobId));
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Something went wrong while adding this book.');
    }
  }, []);

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

  const deleteBook = useCallback(
    async (book: Book) => {
      setBooks((prev) => prev.filter((b) => b.id !== book.id));
      await supabase.storage.from(BUCKET).remove([book.file_path, ...(book.cover_path ? [book.cover_path] : [])]);
      const { error } = await supabase.from('books').delete().eq('id', book.id);
      if (error) load();
    },
    [load]
  );

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

  const getBookUrl = useCallback(async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 2 * 3600);
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
    saveProgress,
    markOpened,
    getBookUrl,
  };
}