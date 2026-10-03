'use client';

import { useState } from 'react';
import TabBar from '@/components/TabBar';
import DashboardHome from '@/components/DashboardHome';
import PlaceholderModule from '@/modules/PlaceholderModule';
import HighlightsModule from '@/modules/highlights/HighlightsModule';
import { MODULES } from '@/lib/modules';
import { ModuleId, OpenTab } from '@/lib/types';

const HOME_TAB: OpenTab = {
  tabId: 'home',
  moduleId: 'home',
  title: 'Home',
  closable: false,
};

export default function Page() {
  const [tabs, setTabs] = useState<OpenTab[]>([HOME_TAB]);
  const [activeTabId, setActiveTabId] = useState('home');

  function openModule(id: ModuleId) {
    const existing = tabs.find((t) => t.moduleId === id);
    if (existing) {
      setActiveTabId(existing.tabId);
      return;
    }
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

  function closeTab(tabId: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.tabId !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[next.length - 1]?.tabId ?? 'home');
      }
      return next;
    });
  }

  const activeTab = tabs.find((t) => t.tabId === activeTabId) ?? HOME_TAB;

  return (
    <div className="h-screen flex flex-col bg-neutral-950">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onClose={closeTab}
      />

      <div className="flex-1 min-h-0">
        {activeTab.moduleId === 'home' && (
          <DashboardHome onOpenModule={openModule} />
        )}
                {activeTab.moduleId === 'highlights' && <HighlightsModule />}

        {activeTab.moduleId === 'notes' && (
          <PlaceholderModule
            title="Notes"
            icon="📝"
            note="Rich-text note editor (Tiptap) goes here in the next build step."
          />
        )}
        {activeTab.moduleId === 'canvas' && (
          <PlaceholderModule
            title="Canvas"
            icon="🖼️"
            note="Infinite whiteboard (tldraw) goes here — mouse-ready now, Pencil-ready once the iPad arrives."
          />
        )}
        {activeTab.moduleId === 'graph' && (
          <PlaceholderModule
            title="Graph"
            icon="🕸️"
            note="Visual map of how your notes and highlights connect — built after notes and linking exist."
          />
        )}
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
    </div>
  );
}
