'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Folder } from '@/lib/types';

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setFolders((data as Folder[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('folders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const createFolder = useCallback(async (name: string, color: string | null) => {
    const { data, error } = await supabase
      .from('folders')
      .insert({ name, color })
      .select()
      .single();
    if (!error && data) setFolders((prev) => [...prev, data as Folder]);
    return error ? null : (data as Folder);
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    await supabase.from('folders').delete().eq('id', id);
  }, []);

  return { folders, loading, createFolder, deleteFolder };
}