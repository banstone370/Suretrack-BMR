import { cn } from '../../lib/utils';
import type { TimelineItem } from '../../types';

export function ProcessTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="space-y-0">
      {items.map((item, index) => (
        <li key={item.key} className="relative flex gap-3 pb-4 last:pb-0">
          {index < items.length - 1 && (
            <span
              className={cn(
                'absolute left-[7px] top-4 h-[calc(100%-8px)] w-px',
                item.state === 'complete' ? 'bg-accent-500' : 'bg-line',
              )}
            />
          )}
          <span
            className={cn(
              'relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2',
              item.state === 'complete' && 'border-accent-600 bg-accent-600',
              item.state === 'current' &&
                'border-brand-800 bg-brand-800 ring-4 ring-brand-800/15',
              item.state === 'upcoming' && 'border-line bg-white',
            )}
          />
          <div>
            <p
              className={cn(
                'text-sm font-medium',
                item.state === 'complete' && 'text-accent-700',
                item.state === 'current' && 'text-brand-900',
                item.state === 'upcoming' && 'text-muted',
              )}
            >
              {item.label}
            </p>
            <p
              className={cn(
                'text-xs capitalize',
                item.state === 'complete' && 'text-accent-600',
                item.state === 'current' && 'text-brand-800',
                item.state === 'upcoming' && 'text-muted',
              )}
            >
              {item.state}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
