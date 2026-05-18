import { useMemo, useState } from 'react';
import type { QueryResult } from '@shared/types';
import { Copy, Check } from 'lucide-react';

export function ResultsJson({ result }: { result: QueryResult }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => JSON.stringify(result.rows, null, 2), [result.rows]);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex-1 min-h-0 relative">
      <button
        type="button"
        onClick={copy}
        className="absolute right-3 top-3 z-10 px-2 h-7 rounded-md bg-bg-3 hover:bg-bg-4 text-xs text-ink-dim hover:text-ink flex items-center gap-1 border border-line"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : 'Copy JSON'}
      </button>
      <pre className="h-full overflow-auto p-4 text-[12px] font-mono text-ink whitespace-pre">
        {text}
      </pre>
    </div>
  );
}
