'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

interface Props {
  trigger: (api: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  closeOnScroll?: boolean;
  placement?: 'bottom' | 'top';
}

interface Anchor {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// A small floating menu. It renders in a portal with fixed positioning so it
// is never clipped by a scrolling toolbar or a card with overflow hidden, and
// it flips to the other side of its button when there isn't room.
export default function Popover({ trigger, children, align = 'left', closeOnScroll = true, placement = 'bottom' }: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [flip, setFlip] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setAnchor({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
      setFlip(false);
    }
    setOpen((o) => !o);
  }

  // Once the menu has a size, move it to the other side if it would run off the screen.
  useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) return;
    const h = panelRef.current.offsetHeight;
    const below = window.innerHeight - anchor.bottom - 12;
    const above = anchor.top - 12;
    const fits = placement === 'top' ? above >= h : below >= h;
    setFlip(!fits && (placement === 'top' ? below > above : above > below));
  }, [open, anchor, placement]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // A scroll that is still settling right after the menu opens shouldn't close it.
    const openedAt = performance.now();
    const onScroll = () => {
      if (performance.now() - openedAt > 250) setOpen(false);
    };
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Esc closes just this menu, not whatever mode is behind it.
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    if (closeOnScroll) window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, closeOnScroll]);

  const effective = flip ? (placement === 'top' ? 'bottom' : 'top') : placement;
  const style: React.CSSProperties = { maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' };
  if (anchor) {
    if (effective === 'top') style.bottom = window.innerHeight - anchor.top + 8;
    else style.top = anchor.bottom + 8;
    if (align === 'right') style.right = Math.max(8, window.innerWidth - anchor.right);
    else style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - 248));
  }

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
                style={style}
                initial={{ opacity: 0, scale: 0.96, y: effective === 'top' ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                // Keep focus (and the text selection) where it was while using the menu,
                // but let people click into text fields inside it.
                onMouseDown={(e) => {
                  if (!(e.target as HTMLElement).closest('input, textarea')) e.preventDefault();
                }}
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