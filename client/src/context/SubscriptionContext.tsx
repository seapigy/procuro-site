import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiUrl, apiFetch } from '../utils/api';

interface SubscriptionContextType {
  isSubscribed: boolean;
  stripeCustomerId: string | null;
  loading: boolean;
  error: string | null;
  openCheckout: () => Promise<void>;
  openPortal: () => Promise<void>;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(apiUrl('/api/billing/subscription-status'));
      const data = await res.json();

      if (res.ok && data.success) {
        setIsSubscribed(data.isSubscribed);
        setStripeCustomerId(data.stripeCustomerId);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch subscription status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      await fetchStatus();

      // After Stripe Checkout redirect: confirm session and refresh status (no webhook needed locally)
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const isSetup = params.get('setup') === '1';
      if (sessionId && !isSetup) {
        try {
          const res = await apiFetch(apiUrl(`/api/billing/checkout-success?session_id=${encodeURIComponent(sessionId)}`));
          const data = await res.json();
          if (res.ok && data.success) {
            await fetchStatus();
          }
        } finally {
          params.delete('session_id');
          const newUrl = params.toString()
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }
    };
    run();

    // Refetch on focus (in case subscription changed in another tab)
    const handleFocus = () => {
      fetchStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const openCheckout = async () => {
    try {
      const res = await apiFetch(apiUrl('/api/billing/create-checkout-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start checkout');
    }
  };

  const openPortal = async () => {
    try {
      const res = await apiFetch(apiUrl('/api/billing/create-portal-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create portal session');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        stripeCustomerId,
        loading,
        error,
        openCheckout,
        openPortal,
        refetch: fetchStatus,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

