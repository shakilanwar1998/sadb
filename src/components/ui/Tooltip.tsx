import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const sideClass: Record<NonNullable<Props['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5'
};

export function Tooltip({ content, children, side = 'bottom' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            'absolute z-50 px-2 py-1 text-[11px] font-medium bg-bg-4 text-ink border border-line rounded-md shadow-panel whitespace-nowrap pointer-events-none',
            sideClass[side]
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
