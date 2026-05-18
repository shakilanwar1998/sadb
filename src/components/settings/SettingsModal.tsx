import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Sparkles, KeyRound, Check } from 'lucide-react';
import { AI_MODELS, type AiProvider, type AiSettings } from '@shared/types';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROVIDER_META: Record<
  AiProvider,
  { label: string; description: string; tone: 'brand' | 'cyan' | 'mint'; help: string }
> = {
  anthropic: {
    label: 'Anthropic',
    description: 'Claude — best for nuanced SQL & schema reasoning',
    tone: 'brand',
    help: 'console.anthropic.com'
  },
  openai: {
    label: 'OpenAI',
    description: 'GPT — function calling and JSON mode',
    tone: 'mint',
    help: 'platform.openai.com'
  },
  gemini: {
    label: 'Google Gemini',
    description: 'Fast, long context, cost-effective',
    tone: 'cyan',
    help: 'aistudio.google.com'
  }
};

export function SettingsModal({ open, onClose }: Props) {
  const ai = useApp((s) => s.aiSettings);
  const setAi = useApp((s) => s.setAiSettings);
  const showToast = useApp((s) => s.showToast);
  const [draft, setDraft] = useState<AiSettings>(ai);
  const [active, setActive] = useState<AiProvider>(ai.active ?? 'anthropic');

  useEffect(() => {
    if (open) {
      setDraft(ai);
      setActive(ai.active ?? 'anthropic');
    }
  }, [open, ai]);

  function updateProvider(p: AiProvider, patch: { apiKey?: string; model?: string }): void {
    setDraft((d) => ({
      ...d,
      providers: {
        ...d.providers,
        [p]: {
          apiKey: patch.apiKey ?? d.providers[p]?.apiKey ?? '',
          model: patch.model ?? d.providers[p]?.model ?? AI_MODELS[p][0]
        }
      }
    }));
  }

  async function save(): Promise<void> {
    const final: AiSettings = { ...draft, active };
    const saved = await window.sadb.ai.saveSettings(final);
    setAi(saved);
    showToast('success', `${PROVIDER_META[active].label} is your active provider`);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="AI Provider Settings" size="lg">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-brand/10 border border-brand/20 rounded-lg">
          <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
          <div className="text-xs text-ink-dim">
            Bring your own API keys. They're encrypted in your OS keychain and never leave your machine
            (except when calling the chosen provider directly).
          </div>
        </div>

        <div className="space-y-3">
          {(Object.keys(PROVIDER_META) as AiProvider[]).map((p) => {
            const meta = PROVIDER_META[p];
            const cur = draft.providers[p] ?? { apiKey: '', model: AI_MODELS[p][0] };
            const isActive = active === p;
            return (
              <div
                key={p}
                className={cn(
                  'panel-inset p-4 transition',
                  isActive && 'border-brand/40 bg-brand/[0.04]'
                )}
              >
                <div className="flex items-start gap-3">
                  <label className="flex items-center mt-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={isActive}
                      onChange={() => setActive(p)}
                      className="accent-brand w-4 h-4"
                    />
                  </label>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">{meta.label}</span>
                      <Badge tone={meta.tone}>{p}</Badge>
                      {cur.apiKey && <Badge tone="mint">key saved</Badge>}
                    </div>
                    <div className="text-xs text-ink-faint mb-3">{meta.description}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Input
                          label="API Key"
                          type="password"
                          value={cur.apiKey}
                          onChange={(e) => updateProvider(p, { apiKey: e.target.value })}
                          placeholder={`Get one at ${meta.help}`}
                        />
                      </div>
                      <Select
                        label="Model"
                        value={cur.model}
                        onChange={(e) => updateProvider(p, { model: e.target.value })}
                        options={AI_MODELS[p].map((m) => ({ value: m, label: m }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-line flex items-center justify-between bg-bg-2/40">
        <div className="text-xs text-ink-faint flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" /> Stored locally via Electron safeStorage
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} iconLeft={<Check className="w-4 h-4" />}>
            Save & set active
          </Button>
        </div>
      </div>
    </Modal>
  );
}
