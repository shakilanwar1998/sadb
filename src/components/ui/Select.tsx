import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  options: Option[];
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, options, className, ...rest },
  ref
) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="label">{label}</span>}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'input appearance-none pr-9 cursor-pointer',
            className
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-bg-2">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim pointer-events-none" />
      </div>
    </label>
  );
});
