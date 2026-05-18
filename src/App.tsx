import { useEffect } from 'react';
import { TitleBar } from '@/components/layout/TitleBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBar } from '@/components/layout/StatusBar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { Toast } from '@/components/ui/Toast';
import { ConnectionForm } from '@/components/connections/ConnectionForm';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { TabBar } from '@/workspace/TabBar';
import { TabView } from '@/workspace/TabView';
import { Welcome } from '@/workspace/Welcome';
import { useApp } from '@/lib/store';
import type { ConnectionConfig } from '@shared/types';

export default function App() {
  const tabs = useApp((s) => s.tabs);
  const activeTabId = useApp((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const modal = useApp((s) => s.modal);
  const modalPayload = useApp((s) => s.modalPayload);
  const closeModal = useApp((s) => s.closeModal);
  const setConnections = useApp((s) => s.setConnections);
  const setAi = useApp((s) => s.setAiSettings);
  const newTab = useApp((s) => s.newTab);

  useEffect(() => {
    window.sadb.connections.list().then(setConnections);
    window.sadb.ai.settings().then(setAi);
  }, [setConnections, setAi]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        newTab();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [newTab]);

  return (
    <div className="h-full w-full flex flex-col bg-bg-0 text-ink">
      <TitleBar />
      <div className="flex-1 min-h-0 flex">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col bg-bg-0">
          <TabBar />
          {activeTab ? <TabView tab={activeTab} /> : <Welcome />}
        </main>
      </div>
      <StatusBar />

      <CommandPalette />
      <Toast />
      <ConnectionForm
        open={modal === 'connection'}
        onClose={closeModal}
        initial={modalPayload as ConnectionConfig | null}
      />
      <SettingsModal open={modal === 'settings'} onClose={closeModal} />
    </div>
  );
}
