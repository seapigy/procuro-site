import { Shield } from 'lucide-react';
import { Button } from './ui/button';
import { useSubscription } from '../context/SubscriptionContext';

export function UpgradeButton() {
  const { openCheckout } = useSubscription();

  return (
    <Button
      size="sm"
      onClick={openCheckout}
      className="bg-blue-600 hover:bg-blue-700 text-white"
    >
      <Shield className="w-4 h-4 mr-1" />
      Upgrade
    </Button>
  );
}

