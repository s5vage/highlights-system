import type { LucideIcon } from 'lucide-react';
export type ModuleId =
  | 'highlights'
  | 'notes'
  | 'library'
  | 'canvas'
  | 'graph'
  | 'settings'
  | 'trash';


export interface ModuleDef {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  description: string;
   hue: 'yellow' | 'green' | 'blue' | 'pink' | 'gray' | 'red' | 'purple';
}


export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'gray';

export interface Highlight {
  id: string;
  text: string;
  html?: string;
  tags: string[];
  color: HighlightColor;
  url?: string;
  created_at: string;
} 

export interface Folder {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: unknown; // Tiptap JSON document
  tags: string[];
  color: string | null;
  folder_id: string | null;
  is_journal: boolean;
  journal_date: string | null; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export type TabModuleId = ModuleId | 'home';

export interface OpenTab {
  tabId: string; // unique instance id, so the same module can be opened twice if ever needed
  moduleId: TabModuleId;
  title: string;
  closable: boolean;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  file_path: string;
  cover_path: string | null;
  size_bytes: number;
  page_count: number;
  last_page: number;
  created_at: string;
  last_opened_at: string | null;
    storage: 'supabase' | 'r2';
      collection_id: string | null;
  tags: string[];
}

// A rectangle on a PDF page, as fractions (0 to 1) of the page's width and
// height, so it stays in the right place at any zoom level.
export interface HlRect {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BookHighlight {
  id: string;
  book_id: string;
  page: number;
  color: HighlightColor;
  text: string;
  rects: HlRect[];
  created_at: string;
}

export type CollectionColor = 'blue' | 'green' | 'yellow' | 'pink' | 'purple' | 'gray';

export interface Collection {
  id: string;
  name: string;
  color: CollectionColor;
  created_at: string;
}