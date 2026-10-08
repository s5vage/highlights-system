'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Pin } from 'lucide-react';
import { Highlight } from '@/lib/types';
import { cleanHtml, escapeHtml, hueOf, readingTime, timeAgo } from './helpers';

interface Props {
  highlight: Highlight;
  pinned: boolean;
  index: number;
  animateIn: boolean;
  onClick: () => void;
}

export default function HighlightCard({ highlight, pinned, index, animateIn, onClick }: Props) {
  const html = useMemo(
    () => cleanHtml(highlight.html || escapeHtml(highlight.text)),
    [highlight.html, highlight.text]
  );
  const tags = highlight.tags || [];

  return (
    <motion.article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      initial={animateIn ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.985 }}
      transition={{
        duration: 0.35,
        delay: animateIn ? Math.min(index, 14) * 0.03 : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="hl-card"
      style={{ '--hue': `var(--hue-${hueOf(highlight.color)})` } as React.CSSProperties}
    >
      <div className="hl-card-body hl-content" dangerouslySetInnerHTML={{ __html: html }} />

      <div className="hl-card-foot">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {tags.slice(0, 3).map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
          {tags.length > 3 && <span className="chip">+{tags.length - 3}</span>}
        </div>
        <div className="hl-meta">
          {pinned && <Pin size={12} strokeWidth={2} fill="currentColor" aria-label="Pinned" />}
          <span>{readingTime(highlight.text)}</span>
          <span>{timeAgo(highlight.created_at)}</span>
        </div>
      </div>
    </motion.article>
  );
}