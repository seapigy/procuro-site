import { useState } from 'react';
import { Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { apiUrl, apiFetch } from '../utils/api';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UpgradeModal({ isOpen, onClose, onSuccess: _onSuccess }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(apiUrl('/api/billing/create-checkout-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unlock Automated Monitoring">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Lock className="w-5 h-5" />
          <p className="font-semibold">Subscription Required</p>
        </div>

        <p className="text-gray-700 dark:text-gray-300">
          Automated price monitoring requires an active subscription. Upgrade now to unlock:
        </p>

        <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Daily automated price checks for your top items</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Real-time price drop alerts</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Manual "Check Price Now" feature</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Priority monitoring for your most-purchased items</span>
          </li>
        </ul>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
            $19/month
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Cancel anytime. Import and view items remain free.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Upgrade Now - $19/month'
            )}
          </Button>
          <Button onClick={onClose} variant="outline" disabled={loading}>
            Cancel
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          You'll be redirected to Stripe to complete your subscription
        </p>
      </div>
    </Modal>
  );
}

