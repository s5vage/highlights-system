import { OpenTab } from '@/lib/types';
import { MODULES } from '@/lib/modules';

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
  return (
    <div className="flex items-stretch bg-neutral-950 border-b border-neutral-800 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.tabId === activeTabId;
        return (
          <div
            key={tab.tabId}
            onClick={() => onSelect(tab.tabId)}
            className={`group flex items-center gap-2 px-4 py-2.5 border-r border-neutral-800 cursor-pointer select-none whitespace-nowrap text-sm transition-colors ${
              active
                ? 'bg-neutral-900 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/50'
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
                className="ml-1 text-neutral-600 hover:text-neutral-200 w-4 h-4 flex items-center justify-center rounded"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
