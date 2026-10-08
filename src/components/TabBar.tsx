'use client';

import { useEffect, useState } from 'react';
import { LayoutGroup, MotionConfig, motion } from 'motion/react';
import { LayoutGrid, Moon, Search, Sun, X } from 'lucide-react';
import { OpenTab } from '@/lib/types';
import { MODULES } from '@/lib/modules';
import { useTheme } from '@/lib/useTheme';

interface Props {
  tabs: OpenTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onOpenSearch: () => void;
}

function TabIcon({ tab }: { tab: OpenTab }) {
  if (tab.moduleId === 'home') return <LayoutGrid size={15} strokeWidth={1.9} />;
  const Icon = MODULES.find((m) => m.id === tab.moduleId)?.icon;
  return Icon ? <Icon size={15} strokeWidth={1.9} /> : null;
}

export default function TabBar({ tabs, activeTabId, onSelect, onClose, onOpenSearch }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [modKey, setModKey] = useState('Ctrl');

  useEffect(() => {
    if (/Mac|iPhone|iPad/i.test(navigator.userAgent)) setModKey('⌘');
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="hl-bar flex items-center gap-2 px-2.5"
        style={{ paddingTop: 'var(--safe-top)', minHeight: 'calc(46px + var(--safe-top))' }}
      >
        <LayoutGroup id="tabbar">
          <div role="tablist" className="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const active = tab.tabId === activeTabId;
              return (
                <div
                  key={tab.tabId}
                  role="tab"
                  aria-selected={active}
                  tabIndex={0}
                  onClick={() => onSelect(tab.tabId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(tab.tabId);
                    }
                  }}
                  className="relative flex h-8 shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg pl-3 pr-2.5 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--fill)]"
                  style={{ color: active ? 'var(--text)' : 'var(--text-dim)' }}
                >
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: 'var(--tab-active)',
                        boxShadow: '0 1px 2px rgb(0 0 0 / 0.1), inset 0 0 0 1px var(--hairline)',
                      }}
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <TabIcon tab={tab} />
                    {tab.title}
                  </span>
                  {tab.closable && (
                    <button
                      type="button"
                      aria-label={`Close ${tab.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose(tab.tabId);
                      }}
                      className="tab-close relative"
                    >
                      <X size={12} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </LayoutGroup>

        <button type="button" onClick={onOpenSearch} className="btn hidden sm:inline-flex" aria-label="Search">
          <Search size={15} strokeWidth={2} style={{ color: 'var(--text-dim)' }} />
          <span style={{ color: 'var(--text-dim)' }}>Search</span>
          <span className="kbd">{modKey} K</span>
        </button>
        <button type="button" onClick={onOpenSearch} className="icon-btn sm:hidden" aria-label="Search">
          <Search size={17} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="icon-btn"
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          <motion.span
            key={theme}
            initial={{ rotate: -70, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="grid place-items-center"
          >
            {theme === 'light' ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
          </motion.span>
        </button>
      </div>
    </MotionConfig>
  );
}