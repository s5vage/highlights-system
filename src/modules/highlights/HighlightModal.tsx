import { Highlight } from '@/lib/types';
import { COLOR_HEX, readingTime, timeAgo } from './helpers';

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
  const color = COLOR_HEX[highlight.color] || COLOR_HEX.yellow;

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
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div
          className="absolute left-0 top-0 w-1 h-16 rounded-tl-2xl"
          style={{ background: color }}
        />
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-800">
          <span className="text-xs font-mono text-neutral-500">
            {(host || 'saved') + ' · ' + timeAgo(highlight.created_at)}
          </span>
          <span className="text-xs font-mono text-neutral-600 ml-auto mr-2">
            {readingTime(highlight.text)}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-neutral-950 border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-neutral-200"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          <div className="text-[15px] leading-relaxed text-neutral-100 whitespace-pre-wrap">
            {highlight.text}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-neutral-800">
          {(highlight.tags || []).map((t) => (
            <span
              key={t}
              className="text-[11px] font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 rounded-full px-2.5 py-1"
            >
              #{t}
            </span>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              onClick={copyText}
              className="text-xs font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 hover:text-neutral-100"
            >
              Copy
            </button>
            <button
              onClick={onTogglePin}
              className="text-xs font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 hover:text-neutral-100"
            >
              {pinned ? 'Unpin' : 'Pin'}
            </button>
            {highlight.url && (
              <a
                href={highlight.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono bg-neutral-100 text-neutral-900 rounded-md px-3 py-2 hover:opacity-85"
              >
                Open
              </a>
            )}
            <button
              onClick={handleDelete}
              className="text-xs font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 hover:text-red-400 hover:border-red-900"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}