import { ReactNode } from 'react';
import { useWalkthrough } from '../../context/WalkthroughContext';
import type { WalkthroughPath } from '../../context/WalkthroughContext';

const HIGHLIGHT_CLASS = 'ring-2 ring-primary ring-offset-2 ring-offset-background';

type StepCondition = number | { path: WalkthroughPath; stepIndex: number };

interface WalkthroughHighlightProps {
  path: WalkthroughPath | WalkthroughPath[];
  /** When set, highlight only when path and currentStep match. Use array of { path, stepIndex } to match multiple (path, step) pairs. */
  stepIndex?: StepCondition | StepCondition[];
  children: ReactNode;
  className?: string;
}

function matchesStep(
  ctx: { path: WalkthroughPath | null; currentStep: number },
  stepCond: StepCondition
): boolean {
  if (typeof stepCond === 'number') return ctx.currentStep === stepCond;
  return ctx.path === stepCond.path && ctx.currentStep === stepCond.stepIndex;
}

/**
 * Wraps content and adds a visible highlight (ring) when the walkthrough is on this path and step.
 */
export function WalkthroughHighlight({ path, stepIndex, children, className = '' }: WalkthroughHighlightProps) {
  const ctx = useWalkthrough();
  const paths = Array.isArray(path) ? path : [path];
  const pathMatch = ctx && !ctx.walkthroughDone && ctx.path != null && paths.includes(ctx.path);
  const stepMatch =
    stepIndex === undefined ||
    (ctx && (Array.isArray(stepIndex) ? stepIndex.some((s) => matchesStep(ctx, s)) : matchesStep(ctx, stepIndex)));
  const shouldHighlight = pathMatch && stepMatch;

  return (
    <div className={shouldHighlight ? `${HIGHLIGHT_CLASS} rounded-lg ${className}`.trim() : className}>
      {children}
    </div>
  );
}
