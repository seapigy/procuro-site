import { useWalkthrough, WALKTHROUGH_STEPS } from '../../context/WalkthroughContext';
import type { WalkthroughPath } from '../../context/WalkthroughContext';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';

interface WalkthroughStepCardProps {
  path: WalkthroughPath;
  stepIndex: number;
  title: string;
  description: string;
}

/**
 * Inline text card in the same style as the QuickBooks CTA. Only visible for this step. Includes a Next button to step through.
 */
export function WalkthroughStepCard({ path, stepIndex, title, description }: WalkthroughStepCardProps) {
  const ctx = useWalkthrough();
  if (!ctx || ctx.walkthroughDone || ctx.path !== path || ctx.currentStep !== stepIndex) return null;

  const totalSteps = WALKTHROUGH_STEPS[path];
  const isLastStep = stepIndex >= totalSteps - 1;
  const buttonLabel = isLastStep ? 'Got it' : 'Next';

  return (
    <Card className="mb-6 border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button onClick={ctx.nextStep} size="sm">
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
