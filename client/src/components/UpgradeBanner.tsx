import { Lock, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { useSubscription } from '../context/SubscriptionContext';

interface UpgradeBannerProps {
  title?: string;
  message?: string;
}

export function UpgradeBanner({ 
  title = "Unlock Automated Monitoring",
  message = "Enable daily scanning and alerts for your top 50 products."
}: UpgradeBannerProps) {
  const { openCheckout } = useSubscription();

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-2">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">{title}</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">{message}</p>
          </div>
        </div>
        <Button
          onClick={openCheckout}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Upgrade Now - $19/month
        </Button>
      </div>
    </div>
  );
}

