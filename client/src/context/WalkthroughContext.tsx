import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export const WALKTHROUGH_STORAGE_KEY = 'procuro-walkthrough-done';
export const JUST_CONNECTED_KEY = 'procuro-just-connected';
/** When set, dashboard treats QuickBooks as connected for UI/walkthrough (testing only). */
export const SIMULATE_QB_CONNECTED_KEY = 'procuro-simulate-qb-connected';

const STORAGE_KEY = WALKTHROUGH_STORAGE_KEY;

export type WalkthroughPath = 1 | 2;

/** Number of steps per path (0-based indices). */
export const WALKTHROUGH_STEPS: Record<WalkthroughPath, number> = { 1: 2, 2: 1 };

type WalkthroughContextValue = {
  walkthroughDone: boolean;
  path: WalkthroughPath | null;
  /** Current step index (0-based). Used to show one step card at a time and highlight the right area. */
  currentStep: number;
  /** Go to the next step. On last step, advances so no step card is shown. */
  nextStep: () => void;
  dismissWalkthrough: () => void;
  coachMarksDismissed: Record<string, boolean>;
  dismissCoachMark: (id: string) => void;
};

const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

function getWalkthroughDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function setWalkthroughDone(value: boolean): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, 'true');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function useWalkthrough() {
  const ctx = useContext(WalkthroughContext);
  if (!ctx) return null;
  return ctx;
}

interface WalkthroughProviderProps {
  children: ReactNode;
  /** Whether QuickBooks is connected */
  isQuickBooksConnected: boolean;
  /** Number of items (tracked) */
  itemsCount: number;
  /** Whether user has viewed the Alerts tab (for step completion) */
  hasViewedAlerts?: boolean;
}

export function WalkthroughProvider({
  children,
  isQuickBooksConnected,
  itemsCount,
  hasViewedAlerts: _hasViewedAlerts = false,
}: WalkthroughProviderProps) {
  const [walkthroughDone, setDone] = useState(getWalkthroughDone);
  const [currentStep, setCurrentStep] = useState(0);
  const [coachMarksDismissed, setCoachMarksDismissed] = useState<Record<string, boolean>>({});

  const nextStep = useCallback(() => {
    setCurrentStep((s) => s + 1);
  }, []);

  const dismissWalkthrough = useCallback(() => {
    setWalkthroughDone(true);
    setDone(true);
    try {
      sessionStorage.removeItem(JUST_CONNECTED_KEY);
    } catch {
      // ignore
    }
  }, []);

  const dismissCoachMark = useCallback((id: string) => {
    setCoachMarksDismissed((prev) => ({ ...prev, [id]: true }));
  }, []);

  const path: WalkthroughPath | null = (() => {
    if (walkthroughDone) return null;
    try {
      if (isQuickBooksConnected) return 2;
      if (!isQuickBooksConnected && itemsCount === 0) return 1;
      return null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (walkthroughDone) return;
    if (path === 2) {
      try {
        sessionStorage.removeItem(JUST_CONNECTED_KEY);
      } catch {
        // ignore
      }
    }
  }, [path, walkthroughDone]);

  useEffect(() => {
    if (path != null) setCurrentStep(0);
  }, [path]);

  const value: WalkthroughContextValue = {
    walkthroughDone,
    path,
    currentStep,
    nextStep,
    dismissWalkthrough,
    coachMarksDismissed,
    dismissCoachMark,
  };

  return (
    <WalkthroughContext.Provider value={value}>
      {children}
    </WalkthroughContext.Provider>
  );
}

/** Call when user navigates from QBSuccess to Dashboard so we show Path 2 */
export function setJustConnectedFlag() {
  try {
    sessionStorage.setItem(JUST_CONNECTED_KEY, 'true');
  } catch {
    // ignore
  }
}

/** Clear only walkthrough-related keys so you can test the walkthrough again. Does not clear theme or other app data. */
const STEP_STORAGE_KEY = 'procuro-walkthrough-step';

export function resetWalkthroughForTesting() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(JUST_CONNECTED_KEY);
    sessionStorage.removeItem(SIMULATE_QB_CONNECTED_KEY);
    sessionStorage.removeItem(STEP_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** For testing without QuickBooks: set flag so dashboard shows "connected" and Path 2 walkthrough. Call then reload. */
export function setSimulateQuickBooksConnected() {
  try {
    sessionStorage.setItem(SIMULATE_QB_CONNECTED_KEY, 'true');
    sessionStorage.setItem(JUST_CONNECTED_KEY, 'true');
  } catch {
    // ignore
  }
}

export function getSimulateQuickBooksConnected(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SIMULATE_QB_CONNECTED_KEY) === 'true';
  } catch {
    return false;
  }
}
