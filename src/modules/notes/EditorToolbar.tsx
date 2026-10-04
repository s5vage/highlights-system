import { Editor } from '@tiptap/react';
import { HIGHLIGHT_MARKER_COLORS, FONT_OPTIONS } from './helpers';

interface Props {
  editor: Editor | null;
}

function ToolBtn({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-8 h-8 rounded-md flex items-center justify-center text-sm border"
      style={
        active
          ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' }
          : { color: 'var(--text-dim)', borderColor: 'var(--border)' }
      }
    >
      {children}
    </button>
  );
}

export default function EditorToolbar({ editor }: Props) {
  if (!editor) return null;

  return (
    <div
      className="flex items-center flex-wrap gap-1.5 px-4 py-2.5 border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      <ToolBtn
        title="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolBtn>
      <ToolBtn
        title="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">i</span>
      </ToolBtn>
      <ToolBtn
        title="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolBtn>

      <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

      <ToolBtn
        title="Heading"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H
      </ToolBtn>
      <ToolBtn
        title="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •≡
      </ToolBtn>
      <ToolBtn
        title="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolBtn>
      <ToolBtn
        title="Checklist"
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        ☑
      </ToolBtn>

      <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

      <ToolBtn
        title="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        &ldquo;
      </ToolBtn>
            <ToolBtn
        title="Code block"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        {'</>'}
      </ToolBtn>

      <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

      <div className="flex items-center gap-1">
        {HIGHLIGHT_MARKER_COLORS.map((c) => {
          const active = editor.isActive('highlight', { color: c.hex });
          return (
            <button
              key={c.id}
              type="button"
              title={`Highlight ${c.id}`}
              onClick={() =>
                active
                  ? editor.chain().focus().unsetHighlight().run()
                  : editor.chain().focus().toggleHighlight({ color: c.hex }).run()
              }
              className="w-6 h-6 rounded-full border-2"
              style={{
                background: c.hex,
                borderColor: active ? 'var(--text)' : 'transparent',
              }}
            />
          );
        })}
        <ToolBtn
          title="Remove highlight"
          onClick={() => editor.chain().focus().unsetHighlight().run()}
        >
          ⊘
        </ToolBtn>
      </div>

      <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

      <select
        title="Font"
        onChange={(e) => {
          const val = e.target.value;
          if (val) editor.chain().focus().setFontFamily(val).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        className="h-8 rounded-md border text-xs px-2 bg-transparent"
        style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        defaultValue=""
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f.label} value={f.value} style={{ color: '#000' }}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}