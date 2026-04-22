import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'table-row' | 'circle';
  width?: string;
  height?: string;
}

export function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-muted rounded';

  const variantClasses = {
    text: 'h-4',
    card: 'h-32',
    'table-row': 'h-12',
    circle: 'rounded-full',
  };

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={{
        width: width || (variant === 'circle' ? '2rem' : '100%'),
        height: height || (variant === 'circle' ? '2rem' : undefined),
      }}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? '75%' : '100%'} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('border rounded-xl p-6 space-y-4', className)}>
      <Skeleton variant="text" width="60%" height="1.5rem" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton variant="text" />
        </td>
      ))}
    </tr>
  );
}

