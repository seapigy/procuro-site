import { useRef, useState, useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';
import { useWalkthrough } from '../../context/WalkthroughContext';
import type { WalkthroughPath } from '../../context/WalkthroughContext';

interface CoachMarkProps {
  id: string;
  message: string;
  children: ReactNode;
  /** Position of the tooltip relative to the child */
  position?: 'top' | 'bottom';
  /** Only show for this path (1 = new user, 2 = just connected) */
  path?: WalkthroughPath;
}

export function CoachMark({ id, message, children, position = 'bottom', path: pathFilter }: CoachMarkProps) {
  const ctx = useWalkthrough();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  const dismissed = ctx?.coachMarksDismissed[id];
  const show =
    ctx &&
    !ctx.walkthroughDone &&
    !dismissed &&
    visible &&
    (pathFilter == null || ctx.path === pathFilter);

  useEffect(() => {
    if (!wrapperRef.current || dismissed) return;
    const el = wrapperRef.current;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) setVisible(true);
  }, [dismissed]);

  const handleDismiss = () => {
    ctx?.dismissCoachMark(id);
  };

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      {children}
      {show && (
        <div
          className={`absolute left-0 z-[200] flex items-center gap-2 rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          role="tooltip"
        >
          <span className="pr-1">{message}</span>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded p-0.5 hover:bg-muted"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
