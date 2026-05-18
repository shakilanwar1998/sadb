import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Database,
  Play,
  Plus,
  Settings,
  Sparkles,
  Wand2,
  Power
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Action {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useApp((s) => s.commandPaletteOpen);
  const setOpen = useApp((s) => s.setCommandPaletteOpen);
  const connections = useApp((s) => s.connections);
  const openConnections = useApp((s) => s.openConnections);
  const openConn = useApp((s) => s.openConnection);
  const openModal = useApp((s) => s.openModal);
  const newTab = useApp((s) => s.newTab);
  const updateTab = useApp((s) => s.updateTab);
  const activeTab = useApp((s) => s.tabs.find((t) => t.id === s.activeTabId) ?? null);
  const showToast = useApp((s) => s.showToast);

  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const actions = useMemo<Action[]>(() => {
    const list: Action[] = [
      {
        id: 'new-tab',
        label: 'New query tab',
        icon: Plus,
        group: 'General',
        hint: '⌘ T',
        run: () => newTab({ connectionId: activeTab?.connectionId ?? null })
      },
      {
        id: 'new-connection',
        label: 'New connection…',
        icon: Database,
        group: 'General',
        run: () => openModal('connection', null)
      },
      {
        id: 'settings',
        label: 'Open settings (AI providers)',
        icon: Settings,
        group: 'General',
        run: () => openModal('settings')
      },
      {
        id: 'ask-ai',
        label: 'Ask AI about active query',
        icon: Sparkles,
        group: 'AI',
        run: () => {
          if (activeTab) updateTab(activeTab.id, { aiOpen: true });
          else showToast('info', 'Open a tab first');
        }
      },
      {
        id: 'run',
        label: 'Run current query',
        icon: Play,
        group: 'Query',
        hint: '⌘ ⏎',
        run: () => {
          if (!activeTab) return;
          window.dispatchEvent(new CustomEvent('sadb:run-query', { detail: activeTab.id }));
        }
      },
      {
        id: 'format',
        label: 'Format current query',
        icon: Wand2,
        group: 'Query',
        hint: '⇧ ⌥ F',
        run: () => {
          if (!activeTab) return;
          window.dispatchEvent(new CustomEvent('sadb:format-query', { detail: activeTab.id }));
        }
      },
      ...connections.map<Action>((c) => ({
        id: `conn-${c.id}`,
        label: openConnections[c.id]
          ? `Use connection: ${c.name}`
          : `Open connection: ${c.name}`,
        hint: `${c.kind} · ${c.host}`,
        icon: Power,
        group: 'Connections',
        run: async () => {
          if (!openConnections[c.id]) {
            try {
              const info = await window.sadb.connections.open(c.id);
              openConn(c.id, info);
              showToast('success', `Connected to ${c.name}`);
            } catch (e) {
              showToast('error', (e as Error).message);
              return;
            }
          }
          newTab({ connectionId: c.id, title: `${c.name} query` });
        }
      }))
    ];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((a) => a.label.toLowerCase().includes(needle));
  }, [q, connections, openConnections, openModal, newTab, activeTab, openConn, showToast, updateTab]);

  function runAt(i: number): void {
    const a = actions[i];
    if (!a) return;
    setOpen(false);
    setTimeout(() => a.run(), 30);
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(actions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(idx);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  let lastGroup = '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          <div className="absolute inset-0 bg-bg-0/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div
            className="panel relative w-full max-w-xl overflow-hidden glow-ring"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
          >
            <div className="px-3 py-2 border-b border-line">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIdx(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Type a command, query, or connection…"
                className="w-full h-9 bg-transparent text-sm placeholder:text-ink-faint focus:outline-none"
              />
            </div>
            <div className="max-h-[55vh] overflow-auto py-1">
              {actions.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-ink-faint">
                  Nothing matches "{q}"
                </div>
              )}
              {actions.map((a, i) => {
                const showGroup = a.group !== lastGroup;
                lastGroup = a.group;
                return (
                  <div key={a.id}>
                    {showGroup && (
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-ink-faint">
                        {a.group}
                      </div>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => setIdx(i)}
                      onClick={() => runAt(i)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-sm',
                        i === idx ? 'bg-bg-3' : 'hover:bg-bg-2'
                      )}
                    >
                      <a.icon className="w-4 h-4 text-ink-dim" />
                      <span className="flex-1 text-left">{a.label}</span>
                      {a.hint && (
                        <kbd className="text-[10px] text-ink-faint font-mono">{a.hint}</kbd>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
