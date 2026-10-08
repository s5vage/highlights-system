'use client';

import { Children, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface Props {
  children: ReactNode;
  minWidth?: number;
  gap?: number;
}

// Lays children out in as many columns as fit, dealing them out left to right
// so the reading order stays the same, while each card keeps its natural height.
export default function Masonry({ children, minWidth = 300, gap = 16 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setCols(Math.max(1, Math.floor((el.clientWidth + gap) / (minWidth + gap))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minWidth, gap]);

  const columns: ReactNode[][] = Array.from({ length: cols }, () => []);
  Children.toArray(children).forEach((child, i) => columns[i % cols].push(child));

  return (
    <div
      ref={ref}
      className="grid items-start"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}
    >
      {columns.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-col" style={{ gap }}>
          {col}
        </div>
      ))}
    </div>
  );
}