export type ModuleId =
  | 'highlights'
  | 'notes'
  | 'canvas'
  | 'graph'
  | 'settings'
  | 'trash';

export interface ModuleDef {
  id: ModuleId;
  label: string;
  icon: string;
  description: string;
  accent: string; // tailwind color class for the tile accent
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
