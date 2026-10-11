'use client';

import { Editor, useEditorState } from '@tiptap/react';
import {
  Bold,
  Check,
  Code,
  Eraser,
  Heading,
  Highlighter,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Type,
  Undo2,
} from 'lucide-react';
import Popover from '@/components/Popover';
import { FONT_OPTIONS, HIGHLIGHT_MARKER_COLORS } from './helpers';

interface Props {
  editor: Editor;
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="tool"
      title={label}
      aria-label={label}
      data-active={active ? 'true' : 'false'}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="tool-sep" aria-hidden />;
const ICON = { size: 17, strokeWidth: 1.9 } as const;

export default function EditorToolbar({ editor }: Props) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            strike: editor.isActive('strike'),
            h1: editor.isActive('heading', { level: 1 }),
            h2: editor.isActive('heading', { level: 2 }),
            h3: editor.isActive('heading', { level: 3 }),
            bullet: editor.isActive('bulletList'),
            ordered: editor.isActive('orderedList'),
            task: editor.isActive('taskList'),
            quote: editor.isActive('blockquote'),
            code: editor.isActive('code'),
            codeBlock: editor.isActive('codeBlock'),
            highlight: (editor.getAttributes('highlight').color as string | undefined) ?? '',
            font: (editor.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
          }
        : null,
  });

  if (!s) return null;
  const chain = () => editor.chain().focus();

  const textStyles = [
    { label: 'Title', cls: 'text-[19px] font-bold', on: s.h1, run: () => chain().toggleHeading({ level: 1 }).run() },
    { label: 'Heading', cls: 'text-[16px] font-semibold', on: s.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
    { label: 'Subheading', cls: 'text-[14.5px] font-semibold', on: s.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    {
      label: 'Body',
      cls: 'text-[14px] font-normal',
      on: !s.h1 && !s.h2 && !s.h3,
      run: () => chain().setParagraph().run(),
    },
  ];

  return (
    <div
      className="flex items-center gap-0.5"
      // Clicking a tool must not steal focus from the editor.
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      }}
    >
      <Tool label="Undo" disabled={!s.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 {...ICON} />
      </Tool>
      <Tool label="Redo" disabled={!s.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 {...ICON} />
      </Tool>

      <Sep />

      <Popover
        trigger={({ open, toggle }) => (
          <button
            type="button"
            className="tool"
            title="Text style"
            aria-label="Text style"
            aria-expanded={open}
            data-active={open || s.h1 || s.h2 || s.h3 ? 'true' : 'false'}
            onClick={toggle}
          >
            <Heading {...ICON} />
          </button>
        )}
      >
        {(close) => (
          <div className="flex min-w-[200px] flex-col">
            {textStyles.map((st) => (
              <button
                key={st.label}
                type="button"
                className="menu-item"
                data-active={st.on}
                onClick={() => {
                  st.run();
                  close();
                }}
              >
                <span className={st.cls}>{st.label}</span>
                <Check size={14} strokeWidth={2.4} className="menu-check" />
              </button>
            ))}
          </div>
        )}
      </Popover>

      <Tool label="Bold" active={s.bold} onClick={() => chain().toggleBold().run()}>
        <Bold {...ICON} />
      </Tool>
      <Tool label="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic {...ICON} />
      </Tool>
      <Tool label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough {...ICON} />
      </Tool>

      <Sep />

      <Tool label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List {...ICON} />
      </Tool>
      <Tool label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered {...ICON} />
      </Tool>
      <Tool label="Checklist" active={s.task} onClick={() => chain().toggleTaskList().run()}>
        <ListChecks {...ICON} />
      </Tool>

      <Sep />

      <Tool label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote {...ICON} />
      </Tool>
      <Tool label="Inline code" active={s.code} onClick={() => chain().toggleCode().run()}>
        <Code {...ICON} />
      </Tool>
      <Tool label="Code block" active={s.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        <SquareCode {...ICON} />
      </Tool>

      <Sep />

      <Popover
        trigger={({ open, toggle }) => (
          <button
            type="button"
            className="tool"
            title="Highlighter"
            aria-label="Highlighter"
            aria-expanded={open}
            data-active={open || s.highlight ? 'true' : 'false'}
            onClick={toggle}
          >
            <Highlighter {...ICON} />
          </button>
        )}
      >
        {(close) => (
          <div className="flex items-center gap-2.5 p-2.5">
            {HIGHLIGHT_MARKER_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-label={`Highlight ${c.id}`}
                title={c.id}
                className="h-6 w-6 rounded-full"
                style={{
                  background: c.hex,
                  boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.14)',
                  outline: s.highlight === c.hex ? '2px solid var(--accent)' : 'none',
                  outlineOffset: 2,
                }}
                onClick={() => {
                  chain().setHighlight({ color: c.hex }).run();
                  close();
                }}
              />
            ))}
            <span className="tool-sep !mx-0.5" aria-hidden />
            <button
              type="button"
              className="tool !h-7 !w-7"
              title="Remove highlight"
              aria-label="Remove highlight"
              onClick={() => {
                chain().unsetHighlight().run();
                close();
              }}
            >
              <Eraser size={15} strokeWidth={1.9} />
            </button>
          </div>
        )}
      </Popover>

      <Popover
        trigger={({ open, toggle }) => (
          <button
            type="button"
            className="tool"
            title="Font"
            aria-label="Font"
            aria-expanded={open}
            data-active={open || s.font ? 'true' : 'false'}
            onClick={toggle}
          >
            <Type {...ICON} />
          </button>
        )}
      >
        {(close) => (
          <div className="flex min-w-[200px] flex-col">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.label}
                type="button"
                className="menu-item"
                data-active={s.font === f.value}
                onClick={() => {
                  if (f.value) chain().setFontFamily(f.value).run();
                  else chain().unsetFontFamily().run();
                  close();
                }}
              >
                <span style={{ fontFamily: f.value || 'inherit' }}>{f.label}</span>
                <Check size={14} strokeWidth={2.4} className="menu-check" />
              </button>
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}