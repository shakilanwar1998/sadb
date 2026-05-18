import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GripHorizontal, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  first: ReactNode;
  second: ReactNode;
  direction?: 'vertical' | 'horizontal';
  defaultPercent?: number;
  minPercent?: number;
  maxPercent?: number;
  storageKey?: string;
  className?: string;
}

export function SplitPane({
  first,
  second,
  direction = 'vertical',
  defaultPercent = 50,
  minPercent = 15,
  maxPercent = 85,
  storageKey,
  className
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [percent, setPercent] = useState(() => {
    if (storageKey) {
      const v = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (v) {
        const n = Number(v);
        if (!Number.isNaN(n)) return clamp(n, minPercent, maxPercent);
      }
    }
    return clamp(defaultPercent, minPercent, maxPercent);
  });

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, String(percent));
  }, [percent, storageKey]);

  const onMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const raw =
        direction === 'vertical'
          ? ((e.clientY - rect.top) / rect.height) * 100
          : ((e.clientX - rect.left) / rect.width) * 100;
      setPercent(clamp(raw, minPercent, maxPercent));
    },
    [direction, minPercent, maxPercent]
  );

  const onUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onMove, onUp]);

  function onDown(e: React.PointerEvent): void {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = direction === 'vertical' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function onDoubleClick(): void {
    setPercent(defaultPercent);
  }

  const isVertical = direction === 'vertical';
  const Grip = isVertical ? GripHorizontal : GripVertical;

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 min-h-0 min-w-0 flex',
        isVertical ? 'flex-col' : 'flex-row',
        className
      )}
    >
      <div
        style={isVertical ? { flex: `0 0 ${percent}%` } : { flex: `0 0 ${percent}%` }}
        className="min-h-0 min-w-0 flex flex-col overflow-hidden"
      >
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={isVertical ? 'horizontal' : 'vertical'}
        onPointerDown={onDown}
        onDoubleClick={onDoubleClick}
        className={cn(
          'shrink-0 relative group transition-colors',
          isVertical
            ? 'h-px bg-line hover:bg-brand/60 cursor-row-resize'
            : 'w-px bg-line hover:bg-brand/60 cursor-col-resize'
        )}
      >
        <div
          className={cn(
            'absolute',
            isVertical
              ? 'inset-x-0 -top-2 -bottom-2 z-20'
              : 'inset-y-0 -left-2 -right-2 z-20'
          )}
        />
        <div
          className={cn(
            'absolute flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
            isVertical
              ? 'left-1/2 -translate-x-1/2 -top-2 -bottom-2 w-16'
              : 'top-1/2 -translate-y-1/2 -left-2 -right-2 h-16'
          )}
        >
          <div
            className={cn(
              'rounded-md bg-bg-3 border border-line text-ink-dim flex items-center justify-center shadow-panel',
              isVertical ? 'h-4 w-10' : 'w-4 h-10'
            )}
          >
            <Grip className="w-3 h-3" />
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">{second}</div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
