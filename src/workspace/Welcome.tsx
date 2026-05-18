import { Database, Sparkles, Zap, Layers, Wand2, BarChart3 } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Button } from '@/components/ui/Button';

export function Welcome() {
  const openModal = useApp((s) => s.openModal);
  const newTab = useApp((s) => s.newTab);
  const setCmdOpen = useApp((s) => s.setCommandPaletteOpen);
  const connections = useApp((s) => s.connections);

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-grid-glow">
      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand via-accent-cyan to-accent-mint shadow-glow flex items-center justify-center">
            <Database className="w-6 h-6 text-bg-0" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome to <span className="gradient-text">SaDB</span>
            </h1>
            <p className="text-ink-dim text-sm">A modern, AI-native database client.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => openModal('connection')}
            className="panel p-4 text-left hover:border-line-strong transition"
          >
            <Database className="w-5 h-5 text-brand-400 mb-2" />
            <div className="font-semibold text-sm">New connection</div>
            <div className="text-xs text-ink-faint mt-0.5">
              Connect to PostgreSQL, MySQL, or MongoDB
            </div>
          </button>
          <button
            onClick={() => openModal('settings')}
            className="panel p-4 text-left hover:border-line-strong transition"
          >
            <Sparkles className="w-5 h-5 text-accent-cyan mb-2" />
            <div className="font-semibold text-sm">Set up AI agent</div>
            <div className="text-xs text-ink-faint mt-0.5">
              Bring your Claude, OpenAI, or Gemini key
            </div>
          </button>
          <button
            onClick={() => newTab({ connectionId: connections[0]?.id ?? null })}
            className="panel p-4 text-left hover:border-line-strong transition"
          >
            <Zap className="w-5 h-5 text-accent-amber mb-2" />
            <div className="font-semibold text-sm">New query tab</div>
            <div className="text-xs text-ink-faint mt-0.5">
              Start writing SQL with smart autocomplete
            </div>
          </button>
          <button
            onClick={() => setCmdOpen(true)}
            className="panel p-4 text-left hover:border-line-strong transition"
          >
            <Wand2 className="w-5 h-5 text-accent-mint mb-2" />
            <div className="font-semibold text-sm">Command palette</div>
            <div className="text-xs text-ink-faint mt-0.5">
              Press ⌘K to do anything fast
            </div>
          </button>
        </div>

        <div className="panel p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-400" /> What you can do
          </h3>
          <ul className="space-y-2.5 text-sm text-ink-dim">
            <FeatureLine icon={Sparkles}>
              <b className="text-ink">AI agent</b> — describe what you want; the agent reads your schema and writes the query.
            </FeatureLine>
            <FeatureLine icon={BarChart3}>
              <b className="text-ink">Live visualization</b> — flip results to bar, line, area, or pie in one click.
            </FeatureLine>
            <FeatureLine icon={Zap}>
              <b className="text-ink">Fast results</b> — virtualized table renders 100k+ rows smoothly.
            </FeatureLine>
            <FeatureLine icon={Wand2}>
              <b className="text-ink">Pro DX</b> — Monaco editor, formatter, multi-tabs, command palette, CSV/JSON export.
            </FeatureLine>
            <FeatureLine icon={Database}>
              <b className="text-ink">Secure</b> — credentials & API keys live in your OS keychain. Nothing leaves your machine except direct calls to the provider you choose.
            </FeatureLine>
          </ul>
        </div>

        <div className="mt-6 flex justify-center">
          <Button
            variant="primary"
            onClick={() =>
              connections.length === 0
                ? openModal('connection')
                : newTab({ connectionId: connections[0].id })
            }
            iconLeft={<Database className="w-4 h-4" />}
          >
            {connections.length === 0 ? 'Add your first connection' : 'Start a new query'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FeatureLine({
  icon: Icon,
  children
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 mt-1 text-ink-dim shrink-0" />
      <span>{children}</span>
    </li>
  );
}
