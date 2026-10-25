'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder as FolderIcon,
  Inbox,
  Link2,
  Trash2,
} from 'lucide-react';
import Popover from '@/components/Popover';
import LocalGraph from '@/modules/graph/LocalGraph';
import { Folder, Note } from '@/lib/types';
import { WikiLink } from './WikiLinkMark';
import EditorToolbar from './EditorToolbar';
import type { SaveState } from './useNotes';
import {
  NOTE_COLORS,
  countWords,
  editedLabel,
  extractWikiLinkTitles,
  formatJournalDate,
  hueVar,
  previewOf,
  toDateStr,
} from './helpers';

interface Props {
  note: Note;
  notes: Note[];
  folders: Folder[];
  journal: boolean;
  saveState: SaveState;
  focusTitle: boolean;
  onTitleFocused: () => void;
  onUpdate: (patch: Partial<Pick<Note, 'title' | 'content' | 'color' | 'folder_id'>>) => void;
  onDelete: () => void;
  onOpenNote: (id: string) => void;
  onOpenModule?: (module: 'notes' | 'highlights' | 'library', id?: string) => void;
  onNavigateTitle: (title: string) => void;
  onShiftDay: (delta: number) => void;
  onGoToday: () => void;
  onBack: () => void;
}

function SaveStatus({ state }: { state: SaveState }) {
  return (
    <AnimatePresence mode="wait">
      {state !== 'idle' && (
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2 text-[12px]"
          style={{ color: state === 'error' ? '#e5484d' : 'var(--text-faint)' }}
        >
          {state === 'saving' && 'Saving…'}
          {state === 'saved' && (
            <>
              <Check size={13} strokeWidth={2.4} /> Saved
            </>
          )}
          {state === 'error' && 'Couldn’t save'}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export default function NoteEditor({
  note,
  notes,
  folders,
  journal,
  saveState,
  focusTitle,
  onTitleFocused,
  onUpdate,
  onDelete,
  onOpenNote,
 onOpenModule, 
  onNavigateTitle,
  onShiftDay,
  onGoToday,
  onBack,
}: Props) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const [words, setWords] = useState(() => countWords(previewOf(note.content)));

  // The parent keys this component by note id, so every note gets a fresh
  // editor (and a fresh undo history — Cmd+Z never reaches into another note).
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing, or link another note with [[Title]]' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      WikiLink,
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: (note.content as any) || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onUpdateRef.current({ content: editor.getJSON() });
      setWords(countWords(editor.getText()));
    },
  });

  // Grow the title field with its content so long titles wrap instead of clipping.
  // On phones this editor is mounted while still hidden behind the list, where a
  // measurement would read zero — so also re-fit whenever its width changes,
  // which includes the moment it becomes visible.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    };
    fit();
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [note.title]);

  useEffect(() => {
    if (focusTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
      onTitleFocused();
    }
  }, [focusTitle, onTitleFocused]);

  const backlinks = useMemo(
    () =>
      notes.filter(
        (n) =>
          n.id !== note.id &&
          extractWikiLinkTitles(n.content).some(
            (t) => t.trim().toLowerCase() === note.title.trim().toLowerCase()
          )
      ),
    [notes, note.id, note.title]
  );

  function handleEditorClick(e: React.MouseEvent) {
    const target = (e.target as HTMLElement).closest('[data-wiki-link]');
    if (!target) return;
    e.preventDefault();
    onNavigateTitle(target.textContent || '');
  }

  const hue = hueVar(note.color);
  const folder = folders.find((f) => f.id === note.folder_id) || null;
  const isToday = note.journal_date === toDateStr(new Date());
  const paper = hue ? `color-mix(in srgb, ${hue} 7%, var(--surface))` : 'var(--surface)';

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full min-w-0 flex-1 flex-col"
      style={{ background: paper }}
    >
      {/* Formatting bar */}
      <div className="hl-bar flex h-[52px] shrink-0 items-center gap-1 px-2.5">
        <button
          type="button"
          onClick={onBack}
          className="tool hidden max-md:inline-flex !w-auto items-center gap-0.5 pl-1.5 pr-2.5 text-[14px] font-medium"
          aria-label="Back to notes"
        >
          <ChevronLeft size={20} strokeWidth={2} />
          Notes
        </button>
        <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
          {editor && <EditorToolbar editor={editor} />}
        </div>
        <SaveStatus state={saveState} />
        <button
          type="button"
          className="tool hover:!text-[#e5484d]"
          title="Delete note"
          aria-label="Delete note"
          onClick={onDelete}
        >
          <Trash2 size={17} strokeWidth={1.9} />
        </button>
      </div>

      {/* Writing surface */}
      <div className="min-h-0 flex-1 overflow-y-auto" onClick={handleEditorClick}>
        <div className="mx-auto w-full max-w-[740px] px-6 pb-40 pt-8 md:px-10 md:pt-12">
          {journal ? (
            <>
              <div className="mb-3 flex items-center gap-1">
                <button type="button" className="tool" aria-label="Previous day" onClick={() => onShiftDay(-1)}>
                  <ChevronLeft size={18} strokeWidth={2} />
                </button>
                <button type="button" className="tool" aria-label="Next day" onClick={() => onShiftDay(1)}>
                  <ChevronRight size={18} strokeWidth={2} />
                </button>
                {!isToday && (
                  <button type="button" className="prop ml-1" onClick={onGoToday}>
                    Today
                  </button>
                )}
              </div>
              <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.026em]">
                {note.journal_date ? formatJournalDate(note.journal_date) : note.title}
              </h1>
            </>
          ) : (
            <>
              <textarea
                ref={titleRef}
                rows={1}
                value={note.title}
                onChange={(e) => onUpdate({ title: e.target.value.replace(/\n/g, ' ') })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    editor?.commands.focus('start');
                  }
                }}
                placeholder="Untitled"
                aria-label="Note title"
                className="block w-full resize-none overflow-hidden bg-transparent text-[28px] font-semibold leading-tight tracking-[-0.026em] outline-none placeholder:text-[var(--text-faint)] md:text-[34px]"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Popover
                  trigger={({ open, toggle }) => (
                    <button type="button" className="prop" aria-expanded={open} onClick={toggle}>
                      {folder ? (
                        <FolderIcon
                          size={14}
                          strokeWidth={1.9}
                          style={{ color: hueVar(folder.color) || 'var(--text-faint)' }}
                        />
                      ) : (
                        <Inbox size={14} strokeWidth={1.9} />
                      )}
                      {folder ? folder.name : 'Unfiled'}
                      <ChevronDown size={13} strokeWidth={2.2} />
                    </button>
                  )}
                >
                  {(close) => (
                    <div className="flex min-w-[210px] flex-col">
                      <button
                        type="button"
                        className="menu-item"
                        data-active={!note.folder_id}
                        onClick={() => {
                          onUpdate({ folder_id: null });
                          close();
                        }}
                      >
                        <Inbox size={15} strokeWidth={1.9} /> Unfiled
                        <Check size={14} strokeWidth={2.4} className="menu-check" />
                      </button>
                      {folders.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className="menu-item"
                          data-active={note.folder_id === f.id}
                          onClick={() => {
                            onUpdate({ folder_id: f.id });
                            close();
                          }}
                        >
                          <FolderIcon size={15} strokeWidth={1.9} style={{ color: hueVar(f.color) || 'var(--text-faint)' }} />
                          <span className="truncate">{f.name}</span>
                          <Check size={14} strokeWidth={2.4} className="menu-check" />
                        </button>
                      ))}
                    </div>
                  )}
                </Popover>

                <Popover
                  trigger={({ open, toggle }) => (
                    <button type="button" className="prop" aria-expanded={open} onClick={toggle}>
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: hue || 'var(--text-faint)' }}
                      />
                      {NOTE_COLORS.find((c) => c.id === note.color)?.label ?? 'No color'}
                      <ChevronDown size={13} strokeWidth={2.2} />
                    </button>
                  )}
                >
                  {(close) => (
                    <div className="flex min-w-[180px] flex-col">
                      <button
                        type="button"
                        className="menu-item"
                        data-active={!note.color}
                        onClick={() => {
                          onUpdate({ color: null });
                          close();
                        }}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--text-faint)' }} />
                        No color
                        <Check size={14} strokeWidth={2.4} className="menu-check" />
                      </button>
                      {NOTE_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="menu-item"
                          data-active={note.color === c.id}
                          onClick={() => {
                            onUpdate({ color: c.id });
                            close();
                          }}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: hueVar(c.id) || '' }} />
                          {c.label}
                          <Check size={14} strokeWidth={2.4} className="menu-check" />
                        </button>
                      ))}
                    </div>
                  )}
                </Popover>
              </div>
            </>
          )}

          <div className="mb-7 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
            <span>Edited {editedLabel(note.updated_at)}</span>
            <span className="tnum">
              {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
            </span>
          </div>

          <EditorContent editor={editor} className="tiptap-content" />

          {backlinks.length > 0 && (
            <div className="mt-14">
              <div className="mb-2.5 text-[12px] font-semibold" style={{ color: 'var(--text-faint)' }}>
                Linked from
              </div>
              <div className="flex flex-wrap gap-2">
                {backlinks.map((n) => (
                  <button key={n.id} type="button" className="prop" onClick={() => onOpenNote(n.id)}>
                    <Link2 size={13} strokeWidth={2} />
                    {n.title || 'Untitled'}
                  </button>
                ))}
              </div>
            </div>
          )}
                    <LocalGraph
            noteId={note.id}
            onOpenNote={onOpenNote}
            onOpenModule={onOpenModule}
          />
        </div>
      </div>
    </motion.section>
  );
}