import { useEffect, useState } from 'react';
import type { ConnectionConfig, DbKind } from '@shared/types';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { shortId } from '@/lib/utils';
import { Check, Zap } from 'lucide-react';
import { useApp } from '@/lib/store';

const DEFAULTS: Record<DbKind, Partial<ConnectionConfig>> = {
  postgres: { port: 5432, host: 'localhost', username: 'postgres', database: 'postgres' },
  mysql: { port: 3306, host: 'localhost', username: 'root', database: '' },
  mongodb: { port: 27017, host: 'localhost', database: 'admin' }
};

const COLORS = ['#7c5cff', '#22d3ee', '#34e3b1', '#ffb547', '#ff5d8f', '#a855f7'];

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: ConnectionConfig | null;
}

export function ConnectionForm({ open, onClose, initial }: Props) {
  const setConnections = useApp((s) => s.setConnections);
  const showToast = useApp((s) => s.showToast);
  const [form, setForm] = useState<ConnectionConfig>(() => makeBlank('postgres'));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [useUri, setUseUri] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : makeBlank('postgres'));
      setTestResult(null);
      setUseUri(Boolean(initial?.uri));
    }
  }, [open, initial]);

  function patch(p: Partial<ConnectionConfig>): void {
    setForm((f) => ({ ...f, ...p }));
  }

  function changeKind(kind: DbKind): void {
    setForm((f) => ({
      ...f,
      kind,
      ...DEFAULTS[kind],
      name: f.name || titleFor(kind)
    }));
  }

  async function test(): Promise<void> {
    setTesting(true);
    setTestResult(null);
    try {
      const info = await window.sadb.connections.test(form);
      setTestResult(`✓ ${info.serverVersion}`);
    } catch (e) {
      setTestResult(`✗ ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  async function save(): Promise<void> {
    try {
      const list = await window.sadb.connections.save(form);
      setConnections(list);
      showToast('success', `Saved ${form.name}`);
      onClose();
    } catch (e) {
      showToast('error', (e as Error).message);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit connection' : 'New connection'}
      description="Credentials are encrypted with your OS keychain via Electron safeStorage."
      size="lg"
    >
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {(['postgres', 'mysql', 'mongodb'] as DbKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => changeKind(k)}
              className={`px-3 py-3 rounded-xl border text-left transition ${
                form.kind === k
                  ? 'border-brand bg-brand/10 text-ink'
                  : 'border-line text-ink-dim hover:border-line-strong hover:text-ink'
              }`}
            >
              <div className="text-sm font-semibold">{titleFor(k)}</div>
              <div className="text-[11px] text-ink-faint mt-0.5">
                {k === 'postgres' && 'PostgreSQL · port 5432'}
                {k === 'mysql' && 'MySQL/MariaDB · port 3306'}
                {k === 'mongodb' && 'MongoDB · port 27017'}
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="My local Postgres"
            />
          </div>
          <div>
            <span className="label">Color</span>
            <div className="mt-1.5 flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => patch({ color: c })}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    form.color === c ? 'border-ink' : 'border-transparent'
                  }`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        {form.kind === 'mongodb' && (
          <label className="flex items-center gap-2 text-sm text-ink-dim">
            <input
              type="checkbox"
              checked={useUri}
              onChange={(e) => setUseUri(e.target.checked)}
              className="accent-brand"
            />
            Use connection URI (mongodb+srv://…)
          </label>
        )}

        {useUri ? (
          <Input
            label="Connection URI"
            value={form.uri ?? ''}
            onChange={(e) => patch({ uri: e.target.value })}
            placeholder="mongodb+srv://user:pass@cluster.mongodb.net/db"
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  label="Host"
                  value={form.host}
                  onChange={(e) => patch({ host: e.target.value })}
                  placeholder="localhost"
                />
              </div>
              <Input
                label="Port"
                type="number"
                value={form.port}
                onChange={(e) => patch({ port: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Database"
                value={form.database ?? ''}
                onChange={(e) => patch({ database: e.target.value })}
                placeholder={form.kind === 'mongodb' ? 'admin' : 'postgres'}
              />
              <Input
                label="Username"
                value={form.username ?? ''}
                onChange={(e) => patch({ username: e.target.value })}
              />
            </div>
            <Input
              label="Password"
              type="password"
              value={form.password ?? ''}
              onChange={(e) => patch({ password: e.target.value })}
              placeholder={initial ? '••••• (saved)' : ''}
            />
            <label className="flex items-center gap-2 text-sm text-ink-dim">
              <input
                type="checkbox"
                checked={Boolean(form.ssl)}
                onChange={(e) => patch({ ssl: e.target.checked })}
                className="accent-brand"
              />
              Use SSL/TLS
            </label>
          </>
        )}

        {testResult && (
          <div
            className={`px-3 py-2 rounded-lg border text-sm ${
              testResult.startsWith('✓')
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-danger/30 bg-danger/10 text-danger'
            }`}
          >
            {testResult}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-line flex items-center justify-between bg-bg-2/40">
        <Button
          variant="ghost"
          onClick={test}
          loading={testing}
          iconLeft={<Zap className="w-4 h-4" />}
        >
          Test connection
        </Button>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">Encrypted</Badge>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} iconLeft={<Check className="w-4 h-4" />}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function titleFor(k: DbKind): string {
  switch (k) {
    case 'postgres':
      return 'PostgreSQL';
    case 'mysql':
      return 'MySQL';
    case 'mongodb':
      return 'MongoDB';
  }
}

function makeBlank(kind: DbKind): ConnectionConfig {
  return {
    id: shortId(),
    name: '',
    kind,
    host: 'localhost',
    port: DEFAULTS[kind].port ?? 5432,
    database: DEFAULTS[kind].database ?? '',
    username: DEFAULTS[kind].username ?? '',
    password: '',
    ssl: false,
    color: '#7c5cff',
    createdAt: Date.now()
  };
}
