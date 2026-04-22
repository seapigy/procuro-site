import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { UserGuideModal } from '../components/UserGuideModal';

type GuideContextValue = {
  openGuide: () => void;
  closeGuide: () => void;
};

const GuideContext = createContext<GuideContextValue | null>(null);

export function useGuide() {
  const ctx = useContext(GuideContext);
  return ctx;
}

interface GuideProviderProps {
  children: ReactNode;
}

export function GuideProvider({ children }: GuideProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const openGuide = useCallback(() => setIsOpen(true), []);
  const closeGuide = useCallback(() => setIsOpen(false), []);

  return (
    <GuideContext.Provider value={{ openGuide, closeGuide }}>
      {children}
      <UserGuideModal isOpen={isOpen} onClose={closeGuide} />
    </GuideContext.Provider>
  );
}
