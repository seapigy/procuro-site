import { Check, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useWalkthrough } from '../../context/WalkthroughContext';
import type { WalkthroughPath } from '../../context/WalkthroughContext';

export interface ChecklistStep {
  id: string;
  label: string;
  done: boolean;
}

interface ChecklistStripProps {
  path: WalkthroughPath;
  steps: ChecklistStep[];
  onDismiss: () => void;
}

export function ChecklistStrip({ path, steps, onDismiss }: ChecklistStripProps) {
  const title = path === 1 ? 'Getting started' : "You're all set — here's where to look";

  return (
    <div className="mb-4 rounded-lg border bg-muted/40 px-4 py-3 flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-foreground">{title}</span>
      <div className="flex flex-wrap items-center gap-4">
        {steps.map((step) => (
          <span
            key={step.id}
            className={`inline-flex items-center gap-1.5 text-xs ${step.done ? 'text-muted-foreground' : 'text-foreground'}`}
          >
            {step.done ? (
              <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
            ) : (
              <span className="h-3.5 w-3.5 rounded-full border border-current shrink-0" />
            )}
            <span className={step.done ? 'line-through' : ''}>{step.label}</span>
          </span>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="ml-auto h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5 mr-1" />
        Dismiss
      </Button>
    </div>
  );
}

/** Build Path 1 steps from state */
export function getPath1Steps(isQuickBooksConnected: boolean, itemsCount: number): ChecklistStep[] {
  return [
    { id: 'connect-qb', label: 'Connect QuickBooks', done: isQuickBooksConnected },
    { id: 'add-items', label: 'Add or import items', done: itemsCount > 0 },
    { id: 'view-alerts', label: 'View alerts & savings', done: itemsCount > 0 },
  ];
}

/** Build Path 2 steps from state */
export function getPath2Steps(itemsCount: number, hasViewedAlerts: boolean): ChecklistStep[] {
  return [
    { id: 'qb-connected', label: 'QuickBooks connected', done: true },
    { id: 'see-items', label: 'See your items', done: itemsCount > 0 },
    { id: 'check-alerts', label: 'Check Overview & Alerts', done: hasViewedAlerts || itemsCount > 0 },
  ];
}

interface WalkthroughChecklistProps {
  isQuickBooksConnected: boolean;
  itemsCount: number;
  hasViewedAlerts: boolean;
}

export function WalkthroughChecklist({
  isQuickBooksConnected,
  itemsCount,
  hasViewedAlerts,
}: WalkthroughChecklistProps) {
  const wt = useWalkthrough();
  if (!wt || !wt.path) return null;
  const steps =
    wt.path === 1
      ? getPath1Steps(isQuickBooksConnected, itemsCount)
      : getPath2Steps(itemsCount, hasViewedAlerts);
  return (
    <ChecklistStrip path={wt.path} steps={steps} onDismiss={wt.dismissWalkthrough} />
  );
}
