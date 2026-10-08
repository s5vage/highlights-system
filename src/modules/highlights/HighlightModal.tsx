'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, ExternalLink, Pin, PinOff, Trash2, X } from 'lucide-react';
import { Highlight } from '@/lib/types';
import { cleanHtml, escapeHtml, fullDate, hueOf, readingTime } from './helpers';

interface Props {
  highlight: Highlight;
  pinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

export default function HighlightModal({ highlight, pinned, onClose, onTogglePin, onDelete }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const html = useMemo(
    () => cleanHtml(highlight.html || escapeHtml(highlight.text)),
    [highlight.html, highlight.text]
  );
  const hue = hueOf(highlight.color);
  const mobile = typeof window !== 'undefined' && window.innerWidth <= 760;

  let host = '';
  try {
    host = highlight.url ? new URL(highlight.url).hostname.replace('www.', '') : '';
  } catch {
    host = '';
  }

  // Escape closes the sheet.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Desktop: drag the sheet by its header. Resizing uses the native corner handle.
  useEffect(() => {
    const modal = modalRef.current;
    const header = headerRef.current;
    if (!modal || !header) return;
    if (window.innerWidth <= 760) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    function toFixed() {
      if (!modal) return;
      const rect = modal.getBoundingClientRect();
      modal.style.position = 'fixed';
      modal.style.left = rect.left + 'px';
      modal.style.top = rect.top + 'px';
      modal.style.width = rect.width + 'px';
      modal.style.height = rect.height + 'px';
      modal.style.margin = '0';
    }

    function onMouseDown(e: MouseEvent) {
      if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
      if (!modal) return;
      if (modal.style.position !== 'fixed') toFixed();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(modal.style.left || '0', 10);
      startTop = parseInt(modal.style.top || '0', 10);
      document.body.style.userSelect = 'none';
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragging || !modal) return;
      const maxLeft = window.innerWidth - modal.offsetWidth;
      const maxTop = window.innerHeight - modal.offsetHeight;
      modal.style.left = Math.max(0, Math.min(maxLeft, startLeft + e.clientX - startX)) + 'px';
      modal.style.top = Math.max(0, Math.min(maxTop, startTop + e.clientY - startY)) + 'px';
    }

    function onMouseUp() {
      dragging = false;
      document.body.style.userSelect = '';
    }

    header.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      header.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  function copyText() {
    navigator.clipboard.writeText(highlight.text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function handleDelete() {
    if (confirm('Delete this highlight? This can’t be undone.')) {
      onDelete();
      onClose();
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
      style={{
        background: 'var(--overlay)',
        backdropFilter: 'blur(14px) saturate(130%)',
        WebkitBackdropFilter: 'blur(14px) saturate(130%)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Highlight"
        className="hl-sheet w-full h-[88dvh] md:h-auto md:max-h-[86vh] md:min-h-[260px] md:w-[min(620px,92vw)] md:min-w-[340px] md:max-w-[94vw] md:resize"
        style={
          {
            '--hue': `var(--hue-${hue})`,
            paddingBottom: 'var(--safe-bottom)',
          } as React.CSSProperties
        }
        initial={mobile ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 10 }}
        animate={mobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={mobile ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 6 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full md:hidden" style={{ background: 'var(--fill-strong)' }} />

        <div
          ref={headerRef}
          className="flex shrink-0 select-none items-center gap-3 px-5 pb-3 pt-4 md:cursor-grab md:active:cursor-grabbing"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold tracking-[-0.006em]">
              {host || `Saved ${fullDate(highlight.created_at)}`}
            </div>
            {host && (
              <div className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
                Saved {fullDate(highlight.created_at)}
              </div>
            )}
          </div>
          <span className="text-[12px] tnum" style={{ color: 'var(--text-faint)' }}>
            {readingTime(highlight.text)} read
          </span>
          <button data-no-drag type="button" onClick={onClose} className="icon-btn !h-8 !w-8" aria-label="Close">
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1">
          <div className="hl-content hl-content-lg" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <div
          data-no-drag
          className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3"
          style={{ borderTop: '1px solid color-mix(in srgb, var(--hue) 14%, var(--hairline))' }}
        >
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {(highlight.tags || []).map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <button type="button" onClick={copyText} className="btn">
              {copied ? <Check size={15} strokeWidth={2.2} /> : <Copy size={15} strokeWidth={2} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={onTogglePin} className="btn">
              {pinned ? <PinOff size={15} strokeWidth={2} /> : <Pin size={15} strokeWidth={2} />}
              {pinned ? 'Unpin' : 'Pin'}
            </button>
            {highlight.url && (
              <a href={highlight.url} target="_blank" rel="noreferrer" className="btn btn-primary">
                <ExternalLink size={15} strokeWidth={2} />
                Open
              </a>
            )}
            <button type="button" onClick={handleDelete} className="btn btn-danger" aria-label="Delete highlight">
              <Trash2 size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}