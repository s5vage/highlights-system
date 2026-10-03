import { OpenTab } from '@/lib/types';
import { MODULES } from '@/lib/modules';
import { useTheme } from '@/lib/useTheme';

interface Props {
  tabs: OpenTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

function iconFor(tab: OpenTab) {
  if (tab.moduleId === 'home') return '✦';
  return MODULES.find((m) => m.id === tab.moduleId)?.icon ?? '•';
}

export default function TabBar({ tabs, activeTabId, onSelect, onClose }: Props) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-stretch bg-[var(--bg)] border-b border-[var(--border)]">
      <div className="flex items-stretch overflow-x-auto flex-1 min-w-0">
        {tabs.map((tab) => {
          const active = tab.tabId === activeTabId;
          return (
            <div
              key={tab.tabId}
              onClick={() => onSelect(tab.tabId)}
              className={`group flex items-center gap-2 px-4 py-2.5 border-r border-[var(--border)] cursor-pointer select-none whitespace-nowrap text-sm transition-colors ${
                active
                  ? 'bg-[var(--surface)] text-[var(--text)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <span className="text-xs">{iconFor(tab)}</span>
              <span>{tab.title}</span>
              {tab.closable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.tabId);
                  }}
                  className="ml-1 text-[var(--text-faint)] hover:text-[var(--text)] w-4 h-4 flex items-center justify-center rounded"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={toggleTheme}
        title="Toggle theme"
        className="shrink-0 w-10 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] border-l border-[var(--border)]"
      >
        {theme === 'light' ? '◑' : '◐'}
      </button>
    </div>
  );
}