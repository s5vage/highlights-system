'use client';

import { useEffect, useState } from 'react';
import TabBar from '@/components/TabBar';
import DashboardHome from '@/components/DashboardHome';
import GlobalSearch from '@/components/GlobalSearch';
import PlaceholderModule from '@/modules/PlaceholderModule';
import HighlightsModule from '@/modules/highlights/HighlightsModule';
import NotesModule from '@/modules/notes/NotesModule';
import GraphModule from '@/modules/graph/GraphModule';
import { MODULES } from '@/lib/modules';
import { ModuleId, OpenTab } from '@/lib/types';

const HOME_TAB: OpenTab = {
  tabId: 'home',
  moduleId: 'home',
  title: 'Home',
  closable: false,
};

interface PendingSelection {
  module: ModuleId;
  id: string;
}

export default function Page() {
  const [tabs, setTabs] = useState<OpenTab[]>([HOME_TAB]);
  const [activeTabId, setActiveTabId] = useState('home');
  const [showSearch, setShowSearch] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);

  function openModule(id: ModuleId, focusId?: string) {
    const existing = tabs.find((t) => t.moduleId === id);
    if (existing) {
      setActiveTabId(existing.tabId);
    } else {
      const mod = MODULES.find((m) => m.id === id)!;
      const newTab: OpenTab = {
        tabId: `${id}-${Date.now()}`,
        moduleId: id,
        title: mod.label,
        closable: true,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.tabId);
    }
    if (focusId) setPendingSelection({ module: id, id: focusId });
  }

  function closeTab(tabId: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.tabId !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[next.length - 1]?.tabId ?? 'home');
      }
      return next;
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeTab = tabs.find((t) => t.tabId === activeTabId) ?? HOME_TAB;

  return (
    <div className="h-dvh flex flex-col" style={{ background: 'var(--bg)' }}>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onClose={closeTab}
        onOpenSearch={() => setShowSearch(true)}
      />

      <div className="flex-1 min-h-0">
        {activeTab.moduleId === 'home' && (
          <DashboardHome onOpenModule={openModule} />
        )}

        {activeTab.moduleId === 'highlights' && (
          <HighlightsModule
            pendingId={pendingSelection?.module === 'highlights' ? pendingSelection.id : null}
            onConsumedPending={() => setPendingSelection(null)}
          />
        )}
        {activeTab.moduleId === 'notes' && (
          <NotesModule
            pendingId={pendingSelection?.module === 'notes' ? pendingSelection.id : null}
            onConsumedPending={() => setPendingSelection(null)}
          />
        )}
        {activeTab.moduleId === 'canvas' && (
          <PlaceholderModule
            title="Canvas"
            icon="🖼️"
            note="Infinite whiteboard (tldraw) goes here — mouse-ready now, Pencil-ready once the iPad arrives."
          />
        )}
        {activeTab.moduleId === 'graph' && <GraphModule onOpenModule={openModule} />}
        {activeTab.moduleId === 'settings' && (
          <PlaceholderModule
            title="Settings"
            icon="⚙️"
            note="Account, theme, and connected devices will live here."
          />
        )}
        {activeTab.moduleId === 'trash' && (
          <PlaceholderModule
            title="Trash"
            icon="🗑️"
            note="Recently deleted items will be recoverable here — this is what prevents another total-loss scenario."
          />
        )}
      </div>

      {showSearch && (
        <GlobalSearch onClose={() => setShowSearch(false)} onOpenModule={openModule} />
      )}
    </div>
  );
}