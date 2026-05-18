import { Activity, Cpu, Zap, Wifi, WifiOff } from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatMs } from '@/lib/utils';

export function StatusBar() {
  const activeTab = useApp((s) =>
    s.tabs.find((t) => t.id === s.activeTabId) ?? null
  );
  const connection = useApp((s) =>
    activeTab?.connectionId
      ? s.connections.find((c) => c.id === activeTab.connectionId) ?? null
      : null
  );
  const open = useApp((s) =>
    activeTab?.connectionId ? Boolean(s.openConnections[activeTab.connectionId]) : false
  );
  const version = useApp((s) =>
    activeTab?.connectionId
      ? s.openConnections[activeTab.connectionId]?.serverVersion
      : undefined
  );

  const result = activeTab?.result;
  const error = activeTab?.error;

  return (
    <footer className="h-7 shrink-0 flex items-center justify-between px-3 text-[11px] text-ink-dim bg-bg-1 border-t border-line">
      <div className="flex items-center gap-3">
        {connection ? (
          open ? (
            <span className="inline-flex items-center gap-1 text-success">
              <Wifi className="w-3 h-3" /> {connection.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-ink-faint">
              <WifiOff className="w-3 h-3" /> {connection.name} (closed)
            </span>
          )
        ) : (
          <span className="text-ink-faint">No connection</span>
        )}
        {version && <span className="truncate max-w-[300px]">{version}</span>}
      </div>
      <div className="flex items-center gap-3">
        {error && <span className="text-danger truncate max-w-[400px]">{error}</span>}
        {result && (
          <>
            <span className="inline-flex items-center gap-1">
              <Activity className="w-3 h-3" /> {result.rowCount.toLocaleString()} rows
            </span>
            <span className="inline-flex items-center gap-1">
              <Zap className="w-3 h-3" /> {formatMs(result.durationMs)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Cpu className="w-3 h-3" /> {result.columns.length} cols
            </span>
          </>
        )}
      </div>
    </footer>
  );
}
