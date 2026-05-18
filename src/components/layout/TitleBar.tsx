import { Command, Search, Settings, Database } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/lib/store';
import { useEffect, useState } from 'react';

export function TitleBar() {
  const setCmdOpen = useApp((s) => s.setCommandPaletteOpen);
  const openModal = useApp((s) => s.openModal);
  const activeTab = useApp((s) =>
    s.tabs.find((t) => t.id === s.activeTabId) ?? null
  );
  const connection = useApp((s) =>
    activeTab?.connectionId
      ? s.connections.find((c) => c.id === activeTab.connectionId) ?? null
      : null
  );
  const [platform, setPlatform] = useState<NodeJS.Platform>('darwin');

  useEffect(() => {
    window.sadb.platform().then(setPlatform);
  }, []);

  const isMac = platform === 'darwin';

  return (
    <header
      className={`titlebar h-11 shrink-0 flex items-center border-b border-line bg-bg-1/60 backdrop-blur ${
        isMac ? 'pl-20 pr-3' : 'px-3'
      }`}
    >
      <div className="flex items-center gap-2 mr-4">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand via-accent-cyan to-accent-mint shadow-glow flex items-center justify-center">
          <Database className="w-3.5 h-3.5 text-bg-0" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold tracking-wide gradient-text">SaDB</span>
      </div>

      <div className="titlebar-button flex-1 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="w-full h-8 px-3 flex items-center gap-2 text-sm text-ink-dim bg-bg-2 border border-line rounded-lg hover:border-line-strong hover:text-ink transition group"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">
            {connection
              ? `${connection.name} · search, run, or ask AI…`
              : 'Search, run a query, or ask AI…'}
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 h-5 text-[10px] font-mono rounded border border-line bg-bg-3 text-ink-faint">
            <Command className="w-3 h-3" />K
          </kbd>
        </button>
      </div>

      <div className="titlebar-button flex items-center gap-1 ml-4">
        <Button variant="ghost" onClick={() => openModal('settings')} aria-label="Settings">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
