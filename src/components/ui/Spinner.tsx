import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin',
        className
      )}
    />
  );
}
