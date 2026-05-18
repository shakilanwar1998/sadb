import { useCallback, useEffect, useMemo } from 'react';
import { Play, Square, Sparkles, Wand2, Database } from 'lucide-react';
import { useApp, type Tab } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { QueryEditor } from '@/components/editor/QueryEditor';
import { ResultsView } from '@/components/results/ResultsView';
import { AiPanel } from '@/components/ai/AiPanel';
import { SplitPane } from '@/components/ui/SplitPane';

export function TabView({ tab }: { tab: Tab }) {
  const connections = useApp((s) => s.connections);
  const openConnections = useApp((s) => s.openConnections);
  const schemas = useApp((s) => s.schemas);
  const updateTab = useApp((s) => s.updateTab);
  const showToast = useApp((s) => s.showToast);
  const openConn = useApp((s) => s.openConnection);
  const setSchema = useApp((s) => s.setSchema);

  const conn = connections.find((c) => c.id === tab.connectionId) ?? null;
  const isConnected = tab.connectionId ? Boolean(openConnections[tab.connectionId]) : false;

  const connectionSchema = useMemo(
    () => (tab.connectionId ? schemas[tab.connectionId] ?? [] : []),
    [schemas, tab.connectionId]
  );
  const availableDbs = useMemo(
    () => connectionSchema.map((s) => s.name),
    [connectionSchema]
  );

  const run = useCallback(async () => {
    if (!tab.connectionId) {
      showToast('error', 'Choose a connection first');
      return;
    }
    if (!isConnected) {
      try {
        const info = await window.sadb.connections.open(tab.connectionId);
        openConn(tab.connectionId, info);
      } catch (e) {
        showToast('error', (e as Error).message);
        return;
      }
      try {
        const schema = await window.sadb.schema.introspect(tab.connectionId);
        setSchema(tab.connectionId, schema);
      } catch {
        setSchema(tab.connectionId, []);
      }
    }
    if (!tab.query.trim()) {
      showToast('info', 'Query is empty');
      return;
    }
    updateTab(tab.id, { running: true, error: null });
    try {
      const result = await window.sadb.query.run(
        tab.connectionId,
        tab.query,
        tab.activeDb
      );
      updateTab(tab.id, { result, running: false, error: null });
    } catch (e) {
      updateTab(tab.id, { running: false, error: (e as Error).message, result: null });
    }
  }, [
    tab.connectionId,
    tab.query,
    tab.activeDb,
    tab.id,
    isConnected,
    openConn,
    setSchema,
    showToast,
    updateTab
  ]);

  const cancel = useCallback(async () => {
    if (!tab.connectionId) return;
    await window.sadb.query.cancel(tab.connectionId);
  }, [tab.connectionId]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<string>;
      if (e.detail !== tab.id) return;
      run();
    };
    window.addEventListener('sadb:run-query', handler);
    return () => window.removeEventListener('sadb:run-query', handler);
  }, [tab.id, run]);


  return (
    <div className="flex-1 min-h-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-11 px-3 shrink-0 flex items-center gap-2 border-b border-line bg-bg-1/60">
          <div className="w-52">
            <Select
              value={tab.connectionId ?? ''}
              onChange={(e) =>
                updateTab(tab.id, { connectionId: e.target.value || null, activeDb: null })
              }
              options={[
                { value: '', label: '— pick a connection —' },
                ...connections.map((c) => ({
                  value: c.id,
                  label: `${c.name}  ·  ${c.kind}`
                }))
              ]}
            />
          </div>
          {tab.connectionId && (
            <div className="w-48">
              <Select
                value={tab.activeDb ?? ''}
                onChange={(e) => updateTab(tab.id, { activeDb: e.target.value || null })}
                options={[
                  { value: '', label: '— database —' },
                  ...availableDbs.map((d) => ({ value: d, label: d }))
                ]}
              />
            </div>
          )}
          {tab.activeDb && (
            <div className="hidden md:flex items-center gap-1 text-[11px] text-ink-faint">
              <Database className="w-3 h-3 text-brand-400" />
              <span className="font-mono">{tab.activeDb}</span>
            </div>
          )}
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              onClick={() =>
                window.dispatchEvent(new CustomEvent('sadb:format-query', { detail: tab.id }))
              }
              iconLeft={<Wand2 className="w-3.5 h-3.5" />}
            >
              Format
            </Button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => updateTab(tab.id, { aiOpen: !tab.aiOpen })}
              iconLeft={<Sparkles className="w-3.5 h-3.5" />}
            >
              AI {tab.aiOpen ? 'on' : 'off'}
            </Button>
            {tab.running ? (
              <Button variant="danger" onClick={cancel} iconLeft={<Square className="w-3.5 h-3.5" />}>
                Stop
              </Button>
            ) : (
              <Button variant="primary" onClick={run} iconLeft={<Play className="w-3.5 h-3.5" />}>
                Run
                <kbd className="ml-1 text-[10px] opacity-70 font-mono">⌘⏎</kbd>
              </Button>
            )}
          </div>
        </div>

        <SplitPane
          storageKey="sadb-editor-results-split"
          defaultPercent={55}
          minPercent={20}
          maxPercent={85}
          first={
            <QueryEditor
              tabId={tab.id}
              value={tab.query}
              onChange={(v) => updateTab(tab.id, { query: v })}
              onRun={run}
              dbKind={conn?.kind}
              schema={connectionSchema}
              activeDb={tab.activeDb}
            />
          }
          second={<ResultsView tab={tab} />}
        />
      </div>
      {tab.aiOpen && <AiPanel tab={tab} />}
    </div>
  );
}
