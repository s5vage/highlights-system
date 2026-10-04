'use client';

import { useEffect, useRef } from 'react';
import { Highlight } from '@/lib/types';
import { COLOR_HEX, readingTime, timeAgo, escapeHtml } from './helpers';

interface Props {
  highlight: Highlight;
  pinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

export default function HighlightModal({
  highlight,
  pinned,
  onClose,
  onTogglePin,
  onDelete,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const color = COLOR_HEX[highlight.color] || COLOR_HEX.yellow;

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
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const maxLeft = window.innerWidth - modal.offsetWidth;
      const maxTop = window.innerHeight - modal.offsetHeight;
      modal.style.left = Math.max(0, Math.min(maxLeft, startLeft + dx)) + 'px';
      modal.style.top = Math.max(0, Math.min(maxTop, startTop + dy)) + 'px';
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

  let host = '';
  try {
    host = highlight.url ? new URL(highlight.url).hostname.replace('www.', '') : '';
  } catch {
    host = '';
  }

  function copyText() {
    navigator.clipboard.writeText(highlight.text || '');
  }

  function handleDelete() {
    if (confirm('Remove this highlight?')) {
      onDelete();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm"
      style={{ background: 'var(--overlay)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative flex flex-col overflow-hidden border resize-none md:resize
          w-full md:w-[min(580px,92vw)]
          h-[85dvh] md:h-[min(600px,85vh)]
          md:min-w-[320px] md:min-h-[280px]
          md:max-w-[94vw] md:max-h-[90vh]
          rounded-t-2xl md:rounded-2xl"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        <div
          className="absolute left-0 top-0 w-1 h-16 rounded-tl-2xl"
          style={{ background: color }}
        />
        <div
          ref={headerRef}
          className="flex items-center gap-3 px-6 py-4 border-b cursor-grab active:cursor-grabbing select-none"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
            {(host || 'saved') + ' · ' + timeAgo(highlight.created_at)}
          </span>
          <span
            className="text-xs font-mono ml-auto mr-2"
            style={{ color: 'var(--text-faint)' }}
          >
            {readingTime(highlight.text)}
          </span>
          <button
            data-no-drag
            onClick={onClose}
            className="w-7 h-7 rounded-md border flex items-center justify-center hover:opacity-80"
            style={{
              background: 'var(--bg)',
              borderColor: 'var(--border)',
              color: 'var(--text-dim)',
            }}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          <div
            className="hl-content text-[15px] leading-relaxed"
            style={{ color: 'var(--text)' }}
            dangerouslySetInnerHTML={{ __html: highlight.html || escapeHtml(highlight.text) }}
          />
        </div>

        <div
          data-no-drag
          className="flex flex-wrap items-center gap-2 px-5 py-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          {(highlight.tags || []).map((t) => (
            <span
              key={t}
              className="text-[11px] font-mono rounded-full px-2.5 py-1 border"
              style={{
                color: 'var(--text-dim)',
                background: 'var(--bg)',
                borderColor: 'var(--border)',
              }}
            >
              #{t}
            </span>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              onClick={copyText}
              className="text-xs font-mono rounded-md px-3 py-2 border hover:opacity-80"
              style={{
                color: 'var(--text-dim)',
                background: 'var(--bg)',
                borderColor: 'var(--border)',
              }}
            >
              Copy
            </button>
            <button
              onClick={onTogglePin}
              className="text-xs font-mono rounded-md px-3 py-2 border hover:opacity-80"
              style={{
                color: 'var(--text-dim)',
                background: 'var(--bg)',
                borderColor: 'var(--border)',
              }}
            >
              {pinned ? 'Unpin' : 'Pin'}
            </button>
            {highlight.url && (
              <a
                href={highlight.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono rounded-md px-3 py-2 hover:opacity-85"
                style={{ background: 'var(--text)', color: 'var(--bg)' }}
              >
                Open
              </a>
            )}
            <button
              onClick={handleDelete}
              className="text-xs font-mono rounded-md px-3 py-2 border hover:text-red-400 hover:border-red-900"
              style={{
                color: 'var(--text-dim)',
                background: 'var(--bg)',
                borderColor: 'var(--border)',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}