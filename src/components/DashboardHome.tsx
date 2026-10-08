'use client';

import { motion } from 'motion/react';
import { MODULES } from '@/lib/modules';
import { ModuleId } from '@/lib/types';

interface Props {
  onOpenModule: (id: ModuleId) => void;
}

export default function DashboardHome({ onOpenModule }: Props) {
  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-12 md:px-8 md:pt-16">
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.022em]">Welcome back</h1>
        <p className="mt-1.5 text-[15px]" style={{ color: 'var(--text-dim)' }}>
          Open a space to get started. Each one opens in its own tab.
        </p>

        <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <motion.button
                key={m.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onOpenModule(m.id)}
                className="tile"
                style={{ '--hue': `var(--hue-${m.hue})` } as React.CSSProperties}
              >
                <span className="tile-badge">
                  <Icon size={22} strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-[16px] font-semibold tracking-[-0.012em]">{m.label}</span>
                  <span className="mt-1 block text-[13.5px] leading-snug" style={{ color: 'var(--text-dim)' }}>
                    {m.description}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}