import { Plus, X, Database, FileText } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';

export function TabBar() {
  const tabs = useApp((s) => s.tabs);
  const active = useApp((s) => s.activeTabId);
  const setActive = useApp((s) => s.setActiveTab);
  const newTab = useApp((s) => s.newTab);
  const close = useApp((s) => s.closeTab);
  const connections = useApp((s) => s.connections);
  const openConnections = useApp((s) => s.openConnections);

  const lastOpenId = Object.keys(openConnections)[0];

  return (
    <div className="h-9 shrink-0 flex items-center border-b border-line bg-bg-0/60 px-1 overflow-auto">
      {tabs.map((t) => {
        const conn = connections.find((c) => c.id === t.connectionId);
        return (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              'group h-8 max-w-[200px] px-2.5 mr-0.5 rounded-t-md flex items-center gap-2 text-xs transition border-x border-t',
              active === t.id
                ? 'bg-bg-1 border-line text-ink'
                : 'border-transparent text-ink-dim hover:text-ink hover:bg-bg-2'
            )}
          >
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate">{t.title || 'Untitled'}</span>
            {conn && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: conn.color || '#5b6178' }}
              />
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                close(t.id);
              }}
              className="w-4 h-4 rounded hover:bg-bg-3 flex items-center justify-center opacity-0 group-hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => newTab({ connectionId: lastOpenId ?? null })}
        className="w-8 h-8 rounded-md hover:bg-bg-2 text-ink-dim hover:text-ink flex items-center justify-center"
        aria-label="New tab"
      >
        <Plus className="w-4 h-4" />
      </button>
      {tabs.length === 0 && (
        <div className="ml-2 text-xs text-ink-faint flex items-center gap-1.5">
          <Database className="w-3 h-3" /> Open a connection or start a new tab
        </div>
      )}
    </div>
  );
}
