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
      className="relative bg-neutral-900 border border-neutral-800 rounded-xl pl-5 pr-4 py-4 cursor-pointer hover:border-neutral-700 hover:-translate-y-0.5 transition-all"
    >
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded"
        style={{ background: color }}
      />
      {pinned && (
        <div className="absolute top-3 right-4 text-[9px] tracking-wide text-neutral-600 font-mono">
          PINNED
        </div>
      )}
      <div className="text-sm text-neutral-200 leading-relaxed max-h-28 overflow-hidden mb-3 whitespace-pre-wrap">
        {highlight.text}
      </div>
      <div className="flex items-center flex-wrap gap-2 pt-3 border-t border-neutral-800">
        {(highlight.tags || []).map((t) => (
          <span key={t} className="text-[11px] font-mono text-neutral-500">
            #{t}
          </span>
        ))}
        <div className="ml-auto flex gap-2 text-[11px] font-mono text-neutral-600">
          <span>{readingTime(highlight.text)}</span>
          <span>{timeAgo(highlight.created_at)}</span>
        </div>
      </div>
    </div>
  );
}