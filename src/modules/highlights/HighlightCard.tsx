import { Highlight } from '@/lib/types';
import { COLOR_HEX, readingTime, timeAgo } from './helpers';

interface Props {
  highlight: Highlight;
  pinned: boolean;
  onClick: () => void;
}

export default function HighlightCard({ highlight, pinned, onClick }: Props) {
  const color = COLOR_HEX[highlight.color] || COLOR_HEX.yellow;

  return (
    <div
      onClick={onClick}
      className="relative bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-5 pr-4 py-4 cursor-pointer hover:border-[var(--border-light)] hover:-translate-y-0.5 transition-all"
    >
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded"
        style={{ background: color }}
      />
      {pinned && (
        <div className="absolute top-3 right-4 text-[9px] tracking-wide text-[var(--text-faint)] font-mono">
          PINNED
        </div>
      )}
      <div className="text-sm text-[var(--text)] leading-relaxed max-h-28 overflow-hidden mb-3 whitespace-pre-wrap">
        {highlight.text}
      </div>
      <div className="flex items-center flex-wrap gap-2 pt-3 border-t border-[var(--border)]">
        {(highlight.tags || []).map((t) => (
          <span key={t} className="text-[11px] font-mono text-[var(--text-dim)]">
            #{t}
          </span>
        ))}
        <div className="ml-auto flex gap-2 text-[11px] font-mono text-[var(--text-faint)]">
          <span>{readingTime(highlight.text)}</span>
          <span>{timeAgo(highlight.created_at)}</span>
        </div>
      </div>
    </div>
  );
}