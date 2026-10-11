'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

interface Props {
  trigger: (api: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
}

// A small floating menu. It renders in a portal with fixed positioning so it
// is never clipped by a scrolling toolbar or a card with overflow hidden.
export default function Popover({ trigger, children, align = 'left' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const top = r.bottom + 8;
      setPos(
        align === 'right'
          ? { top, right: Math.max(8, window.innerWidth - r.right) }
          : { top, left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) }
      );
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <>
      <div ref={triggerRef} className="inline-flex">
        {trigger({ open, toggle })}
      </div>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                className="pop"
                style={{ top: pos.top, left: pos.left, right: pos.right }}
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                // Keep focus (and the text selection) in the editor while using the menu.
                onMouseDown={(e) => e.preventDefault()}
              >
                {children(() => setOpen(false))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}