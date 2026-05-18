import { useEffect } from 'react';
import {
  Plus,
  Database,
  Trash2,
  Power,
  PowerOff,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { ConnectionConfig, DbKind, SchemaTable } from '@shared/types';
import { SchemaTree } from '@/components/schema/SchemaTree';

const kindLabel: Record<DbKind, string> = {
  postgres: 'Postgres',
  mysql: 'MySQL',
  mongodb: 'Mongo'
};

const kindTone: Record<DbKind, 'brand' | 'cyan' | 'mint' | 'amber'> = {
  postgres: 'cyan',
  mysql: 'amber',
  mongodb: 'mint'
};

export function Sidebar() {
  const connections = useApp((s) => s.connections);
  const open = useApp((s) => s.openConnections);
  const schemas = useApp((s) => s.schemas);
  const setConnections = useApp((s) => s.setConnections);
  const setSchema = useApp((s) => s.setSchema);
  const openModal = useApp((s) => s.openModal);
  const closeConnection = useApp((s) => s.closeConnection);
  const openConnection = useApp((s) => s.openConnection);
  const showToast = useApp((s) => s.showToast);
  const newTab = useApp((s) => s.newTab);
  const updateTab = useApp((s) => s.updateTab);
  const tabs = useApp((s) => s.tabs);
  const activeTabId = useApp((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  function quoteIdent(kind: DbKind, table: SchemaTable, includeSchema: boolean): string {
    if (kind === 'mongodb') return `db.${table.name}.find({}).limit(100)`;
    if (kind === 'mysql') {
      const name = `\`${table.name.replace(/`/g, '``')}\``;
      const schemaPart =
        includeSchema && table.schema
          ? `\`${table.schema.replace(/`/g, '``')}\`.`
          : '';
      return `SELECT * FROM ${schemaPart}${name} LIMIT 100;`;
    }
    const schema = (table.schema ?? 'public').replace(/"/g, '""');
    const name = table.name.replace(/"/g, '""');
    return includeSchema
      ? `SELECT * FROM "${schema}"."${name}" LIMIT 100;`
      : `SELECT * FROM "${name}" LIMIT 100;`;
  }

  async function ensureOpen(c: ConnectionConfig): Promise<void> {
    if (open[c.id]) return;
    try {
      const info = await window.sadb.connections.open(c.id);
      openConnection(c.id, info);
    } catch (e) {
      showToast('error', (e as Error).message);
      throw e;
    }
    try {
      const sch = await window.sadb.schema.introspect(c.id);
      setSchema(c.id, sch);
    } catch {
      setSchema(c.id, []);
    }
  }

  async function applyToTab(
    c: ConnectionConfig,
    dbName: string,
    table: SchemaTable | null,
    autoRun: boolean
  ): Promise<void> {
    const query = table ? quoteIdent(c.kind, table, false) : '';
    let tabId: string;
    if (activeTab && activeTab.connectionId === c.id) {
      updateTab(activeTab.id, {
        connectionId: c.id,
        activeDb: dbName,
        title: table ? table.name : activeTab.title,
        ...(table ? { query } : {})
      });
      tabId = activeTab.id;
    } else {
      tabId = newTab({
        connectionId: c.id,
        activeDb: dbName,
        title: table ? table.name : dbName,
        query
      });
    }
    if (!autoRun) return;
    try {
      await ensureOpen(c);
    } catch {
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('sadb:run-query', { detail: tabId }));
      });
    });
  }

  useEffect(() => {
    window.sadb.connections.list().then(setConnections);
  }, [setConnections]);

  async function handleOpen(c: ConnectionConfig): Promise<void> {
    try {
      const info = await window.sadb.connections.open(c.id);
      openConnection(c.id, info);
      showToast('success', `Connected to ${c.name}`);
    } catch (e) {
      showToast('error', (e as Error).message);
      return;
    }
    try {
      const schema = await window.sadb.schema.introspect(c.id);
      setSchema(c.id, schema);
    } catch (e) {
      setSchema(c.id, []);
      showToast('error', `Schema: ${(e as Error).message}`);
    }
  }

  async function handleClose(c: ConnectionConfig): Promise<void> {
    await window.sadb.connections.close(c.id);
    closeConnection(c.id);
    showToast('info', `Disconnected from ${c.name}`);
  }

  async function handleDelete(c: ConnectionConfig): Promise<void> {
    if (!confirm(`Delete connection "${c.name}"?`)) return;
    const list = await window.sadb.connections.delete(c.id);
    setConnections(list);
    closeConnection(c.id);
  }

  return (
    <aside className="w-72 shrink-0 border-r border-line bg-bg-1 flex flex-col">
      <div className="px-3 py-3 flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-2">
          <span className="label">Connections</span>
          <Badge tone="neutral">{connections.length}</Badge>
        </div>
        <Tooltip content="New connection">
          <Button
            variant="ghost"
            onClick={() => openModal('connection', null)}
            className="w-8 h-8 p-0"
            aria-label="New connection"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2 space-y-1">
        {connections.length === 0 && (
          <button
            onClick={() => openModal('connection', null)}
            className="w-full mt-4 p-4 border border-dashed border-line rounded-xl flex flex-col items-center gap-2 text-ink-dim hover:text-ink hover:border-brand/40 transition group"
          >
            <div className="w-10 h-10 rounded-full bg-brand/15 flex items-center justify-center group-hover:bg-brand/25 transition">
              <Sparkles className="w-5 h-5 text-brand-400" />
            </div>
            <div className="text-sm font-medium">Add your first connection</div>
            <div className="text-xs text-center text-ink-faint">
              Postgres, MySQL, or MongoDB
            </div>
          </button>
        )}

        {connections.map((c) => {
          const isOpen = Boolean(open[c.id]);
          const schema = schemas[c.id];
          return (
            <div key={c.id} className="space-y-1">
              <div
                className={cn(
                  'group flex items-center gap-2 px-2 py-1.5 rounded-lg border transition',
                  isOpen
                    ? 'bg-bg-2 border-line'
                    : 'border-transparent hover:bg-bg-2'
                )}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: c.color || (isOpen ? '#34e3b1' : '#5b6178')
                  }}
                />
                <button
                  type="button"
                  onClick={() => (isOpen ? handleClose(c) : handleOpen(c))}
                  className="flex-1 flex flex-col items-start text-left min-w-0"
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    <Badge tone={kindTone[c.kind]} className="ml-auto">
                      {kindLabel[c.kind]}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-ink-faint truncate w-full">
                    {c.host}:{c.port}
                    {c.database && ` · ${c.database}`}
                  </span>
                </button>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                  {isOpen ? (
                    <Tooltip content="Disconnect">
                      <button
                        onClick={() => handleClose(c)}
                        className="w-7 h-7 rounded-md hover:bg-bg-3 text-ink-dim flex items-center justify-center"
                      >
                        <PowerOff className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  ) : (
                    <Tooltip content="Connect">
                      <button
                        onClick={() => handleOpen(c)}
                        className="w-7 h-7 rounded-md hover:bg-bg-3 text-ink-dim hover:text-success flex items-center justify-center"
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content="Delete">
                    <button
                      onClick={() => handleDelete(c)}
                      className="w-7 h-7 rounded-md hover:bg-bg-3 text-ink-dim hover:text-danger flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
              </div>
              {isOpen && schema && (
                <div className="ml-3 pl-2 border-l border-line">
                  <SchemaTree
                    schema={schema}
                    activeDb={
                      activeTab && activeTab.connectionId === c.id ? activeTab.activeDb : null
                    }
                    onSelectDb={(dbName) => {
                      void applyToTab(c, dbName, null, false);
                    }}
                    onOpenTable={(dbName, table) => {
                      void applyToTab(c, dbName, table, true);
                    }}
                  />
                </div>
              )}
              {isOpen && !schema && (
                <div className="ml-3 pl-2 py-1 text-[11px] text-ink-faint flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 animate-pulseSoft" />
                  Loading schema…
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-line p-2">
        <Button
          variant="secondary"
          onClick={() => openModal('connection', null)}
          className="w-full"
          iconLeft={<Database className="w-4 h-4" />}
        >
          New Connection
        </Button>
      </div>
    </aside>
  );
}
