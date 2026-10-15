'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Copy, Trash2 } from 'lucide-react';
import { HighlightColor } from '@/lib/types';

export const HL_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

function Swatches({ active, onPick }: { active?: HighlightColor; onPick: (c: HighlightColor) => void }) {
  return (
    <div className="flex items-center gap-2.5">
      {HL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Highlight ${c}`}
          title={c}
          className="hl-swatch"
          style={{
            background: `var(--hue-${c})`,
            outline: active === c ? '2px solid var(--accent)' : 'none',
            outlineOffset: 2,
          }}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}

const keepSelection = (e: React.SyntheticEvent) => e.preventDefault();

// Appears next to selected text, like Apple Books.
export function SelectionBar({
  x,
  y,
  below,
  onPick,
  onCopy,
}: {
  x: number;
  y: number;
  below: boolean;
  onPick: (c: HighlightColor) => void;
  onCopy: () => void;
}) {
  const left = Math.min(Math.max(x, 100), window.innerWidth - 100);
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left,
        top: y,
        zIndex: 70,
        transform: below ? 'translate(-50%, 12px)' : 'translate(-50%, calc(-100% - 12px))',
      }}
    >
      <motion.div
        className="pop !min-w-0 flex items-center gap-3 !p-2.5"
        style={{ position: 'static' }}
        initial={{ opacity: 0, scale: 0.94, y: below ? -4 : 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        onMouseDown={keepSelection}
        onPointerDown={keepSelection}
        role="toolbar"
        aria-label="Highlight selected text"
      >
        <Swatches onPick={onPick} />
        <span className="tool-sep !mx-0" aria-hidden />
        <button type="button" className="tool !h-7 !w-7" aria-label="Copy" title="Copy" onClick={onCopy}>
          <Copy size={15} strokeWidth={1.9} />
        </button>
      </motion.div>
    </div>,
    document.body
  );
}

// Opens when you click a highlight that is already on the page.
export function HighlightMenu({
  x,
  y,
  color,
  onColor,
  onCopy,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  color: HighlightColor;
  onColor: (c: HighlightColor) => void;
  onCopy: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  const left = Math.min(Math.max(x - 100, 8), window.innerWidth - 208);
  return createPortal(
    <motion.div
      ref={ref}
      className="pop !min-w-0 w-[200px]"
      style={{ left, top: y + 12 }}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.14 }}
    >
      <div className="px-2.5 pb-2 pt-2">
        <Swatches active={color} onPick={onColor} />
      </div>
      <div className="mx-1 my-1 h-px" style={{ background: 'var(--border)' }} />
      <button type="button" className="menu-item" onClick={onCopy}>
        <Copy size={15} strokeWidth={1.9} /> Copy text
      </button>
      <button type="button" className="menu-item hover:!text-[#e5484d]" onClick={onDelete}>
        <Trash2 size={15} strokeWidth={1.9} /> Remove highlight
      </button>
    </motion.div>,
    document.body
  );
}