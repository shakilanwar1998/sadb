import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, ArrowDownToLine, X, Loader2, KeyRound } from 'lucide-react';
import { useApp, type Tab } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { shortId } from '@/lib/utils';
import type { AiChatMessage } from '@shared/types';
import { Badge } from '@/components/ui/Badge';

interface Props {
  tab: Tab;
}

export function AiPanel({ tab }: Props) {
  const updateTab = useApp((s) => s.updateTab);
  const ai = useApp((s) => s.aiSettings);
  const openModal = useApp((s) => s.openModal);
  const showToast = useApp((s) => s.showToast);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [tab.ai.length, loading]);

  const provider = ai.active;
  const cfg = provider ? ai.providers[provider] : undefined;
  const hasKey = Boolean(cfg?.apiKey);

  async function ask(): Promise<void> {
    if (!prompt.trim()) return;
    if (!tab.connectionId) {
      showToast('error', 'Pick a connection first');
      return;
    }
    if (!hasKey) {
      openModal('settings');
      return;
    }
    const userMsg: AiChatMessage = {
      id: shortId(),
      role: 'user',
      content: prompt.trim(),
      createdAt: Date.now()
    };
    const newMessages = [...tab.ai, userMsg];
    updateTab(tab.id, { ai: newMessages });
    setPrompt('');
    setLoading(true);
    try {
      const history = tab.ai.map((m) => ({
        role: m.role === 'system' ? 'assistant' : m.role,
        content: m.sql ? `${m.content}\nSQL: ${m.sql}` : m.content
      })) as Array<{ role: 'user' | 'assistant'; content: string }>;
      const res = await window.sadb.ai.generateQuery(tab.connectionId, prompt.trim(), history);
      const assistantMsg: AiChatMessage = {
        id: shortId(),
        role: 'assistant',
        content: res.reasoning ?? '',
        sql: res.sql,
        createdAt: Date.now()
      };
      updateTab(tab.id, { ai: [...newMessages, assistantMsg] });
    } catch (e) {
      const errMsg: AiChatMessage = {
        id: shortId(),
        role: 'assistant',
        content: '',
        error: (e as Error).message,
        createdAt: Date.now()
      };
      updateTab(tab.id, { ai: [...newMessages, errMsg] });
    } finally {
      setLoading(false);
    }
  }

  function insertSql(sql: string): void {
    updateTab(tab.id, { query: sql });
    showToast('success', 'Inserted into editor');
  }

  return (
    <div className="w-[380px] shrink-0 border-l border-line bg-bg-1 flex flex-col">
      <div className="h-10 px-3 flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand to-accent-cyan flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-bg-0" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold">AI Agent</span>
          {provider && (
            <Badge tone="brand">
              {provider} · {cfg?.model}
            </Badge>
          )}
        </div>
        <button
          onClick={() => updateTab(tab.id, { aiOpen: false })}
          className="w-7 h-7 rounded-md hover:bg-bg-3 text-ink-dim flex items-center justify-center"
          aria-label="Close AI panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-3 space-y-3">
        {tab.ai.length === 0 && (
          <div className="text-center py-8 px-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-brand/15 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-brand-400" />
            </div>
            <h4 className="text-sm font-semibold mb-1">Ask your database in plain English</h4>
            <p className="text-xs text-ink-faint mb-4">
              The agent reads your schema and writes a query you can review before running.
            </p>
            <div className="space-y-1 text-left">
              {[
                'Top 10 customers by revenue this month',
                'Users who signed up in the last 7 days',
                'Average order value per country'
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="w-full text-xs text-left px-3 py-2 rounded-lg bg-bg-2 hover:bg-bg-3 border border-line text-ink-dim hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab.ai.map((m) => (
          <MessageBubble key={m.id} message={m} onInsert={insertSql} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-ink-dim animate-pulseSoft">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-line p-3 space-y-2">
        {!hasKey && (
          <button
            onClick={() => openModal('settings')}
            className="w-full text-xs text-amber-300 bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 flex items-center gap-2 hover:bg-warning/15"
          >
            <KeyRound className="w-3.5 h-3.5" /> Add an API key to enable AI
          </button>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="Ask the agent…  (⌘⏎ to send)"
            rows={2}
            className="flex-1 bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm placeholder:text-ink-faint focus:outline-none focus:border-brand resize-none"
          />
          <Button variant="primary" onClick={ask} disabled={!prompt.trim() || loading} aria-label="Send">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onInsert
}: {
  message: AiChatMessage;
  onInsert: (sql: string) => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-brand/15 border border-brand/30 rounded-2xl rounded-tr-md px-3 py-2 text-sm text-ink">
          {message.content}
        </div>
      </div>
    );
  }
  if (message.error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl px-3 py-2 text-xs text-danger font-mono whitespace-pre-wrap">
        {message.error}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {message.content && (
        <div className="text-xs text-ink-dim">{message.content}</div>
      )}
      {message.sql && (
        <div className="panel-inset overflow-hidden">
          <div className="px-2 py-1 border-b border-line flex items-center justify-between">
            <span className="text-[10px] uppercase text-ink-faint">Generated query</span>
            <button
              onClick={() => onInsert(message.sql!)}
              className="text-[10px] text-brand-400 hover:text-brand-400/80 flex items-center gap-1 px-1.5 py-0.5 rounded border border-brand/30 bg-brand/10"
            >
              <ArrowDownToLine className="w-3 h-3" /> Use
            </button>
          </div>
          <pre className="p-2 text-[12px] font-mono text-ink whitespace-pre-wrap overflow-auto max-h-60">
            {message.sql}
          </pre>
        </div>
      )}
    </div>
  );
}
