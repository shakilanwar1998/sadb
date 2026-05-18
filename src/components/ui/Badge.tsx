import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'cyan' | 'mint' | 'amber' | 'rose' | 'neutral';

const toneClass: Record<Tone, string> = {
  brand: 'bg-brand/15 text-brand-400 border-brand/30',
  cyan: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30',
  mint: 'bg-accent-mint/15 text-accent-mint border-accent-mint/30',
  amber: 'bg-accent-amber/15 text-accent-amber border-accent-amber/30',
  rose: 'bg-accent-rose/15 text-accent-rose border-accent-rose/30',
  neutral: 'bg-bg-3 text-ink-dim border-line'
};

export function Badge({
  tone = 'neutral',
  children,
  className
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 h-5 text-[10.5px] uppercase tracking-wide font-medium rounded-md border',
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
