import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
  import { CreditCard, RefreshCw, ExternalLink, Loader2, SkipForward } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { apiUrl, apiFetch, apiFetchWithTimeout } from '../utils/api';

const ACTIVATION_FETCH_MS = 20000;

type NextStep = 'CONNECT_QB' | 'ADD_PAYMENT' | 'IMPORTING' | 'READY';

interface ActivationStatus {
  companyId: number | null;
  companyName: string | null;
  isQuickBooksConnected: boolean;
  hasPaymentMethod: boolean;
  trialActive: boolean;
  trialEndsAt: string | null;
  lastImportedItemCount: number | null;
  importCompleted: boolean;
  importLastAttemptedAt: string | null;
  nextStep: NextStep;
  testMode?: boolean;
}

export function ActivationRouter() {
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const fetchActivation = async () => {
    try {
      setLoading(true);
      const res = await apiFetchWithTimeout(
        apiUrl('/api/company/activation'),
        {},
        ACTIVATION_FETCH_MS
      );
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch activation:', err);
      setStatus({
        companyId: null,
        companyName: null,
        isQuickBooksConnected: false,
        hasPaymentMethod: false,
        trialActive: false,
        trialEndsAt: null,
        lastImportedItemCount: null,
        importCompleted: false,
        importLastAttemptedAt: null,
        nextStep: 'CONNECT_QB',
        testMode: false,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivation();
  }, []);

  // Handle return from Stripe setup
  useEffect(() => {
    const setup = searchParams.get('setup');
    const sessionId = searchParams.get('session_id');
    if (setup === '1' && sessionId) {
      (async () => {
        try {
          const res = await apiFetch(apiUrl('/api/billing/confirm-setup'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          });
          if (res.ok) {
            window.history.replaceState({}, '', '/activate');
            await fetchActivation();
          }
        } catch (err) {
          console.error('Failed to confirm setup:', err);
        }
      })();
    }
  }, [searchParams]);

  useEffect(() => {
    if (!status || status.nextStep !== 'READY') return;
    navigate('/dashboard', { replace: true });
  }, [status?.nextStep, navigate]);

  const handleAddPayment = async () => {
    try {
      setPaymentLoading(true);
      const res = await apiFetch(apiUrl('/api/billing/start-trial'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to start trial');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add payment method');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSkipForTesting = async () => {
    try {
      setSkipLoading(true);
      const res = await apiFetch(apiUrl('/api/test/skip-import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchActivation();
      } else {
        throw new Error(data.error || 'Skip failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not skip. Is TEST_MODE=true?');
    } finally {
      setSkipLoading(false);
    }
  };

  const handleRetryImport = async () => {
    try {
      setImportLoading(true);
      const res = await apiFetch(apiUrl('/api/qb/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchActivation();
      } else {
        throw new Error(data.error || data.details || 'Import failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const handleConnectQuickBooks = () => {
    window.location.href = apiUrl('/api/qb/connect');
  };

  if (loading || !status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (status.nextStep === 'READY') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome to Procuro</h1>
          <p className="text-muted-foreground mt-1">Complete setup to get started</p>
        </div>

        {status.nextStep === 'CONNECT_QB' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                Connect QuickBooks
              </CardTitle>
              <CardDescription>
                Link your QuickBooks account to import your purchase history and start tracking savings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleConnectQuickBooks} className="w-full">
                Connect QuickBooks
              </Button>
            </CardContent>
          </Card>
        )}

        {status.nextStep === 'ADD_PAYMENT' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Add Payment Method
              </CardTitle>
              <CardDescription>
                Add a card to start your free 14-day trial. No charge today.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleAddPayment}
                disabled={paymentLoading}
                className="w-full"
              >
                {paymentLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Add Payment Method'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {status.nextStep === 'IMPORTING' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                {status.importLastAttemptedAt != null && status.lastImportedItemCount === 0
                  ? 'No purchases found yet'
                  : 'Analyzing Your Purchase History'}
              </CardTitle>
              <CardDescription>
                {status.importLastAttemptedAt != null && status.lastImportedItemCount === 0
                  ? "We didn't find any purchase transactions in your QuickBooks data. Add purchases in QuickBooks and try again, or check that your date range includes recent activity."
                  : "We're importing and matching your QuickBooks items. This may take a moment."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status.lastImportedItemCount != null && status.lastImportedItemCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Imported {status.lastImportedItemCount} items.
                </p>
              )}
              <Button
                onClick={handleRetryImport}
                disabled={importLoading}
                variant="outline"
                className="w-full"
              >
                {importLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Import
                  </>
                )}
              </Button>
              {status.testMode && (
                <Button
                  onClick={handleSkipForTesting}
                  disabled={skipLoading}
                  variant="ghost"
                  className="w-full text-muted-foreground"
                >
                  {skipLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Skipping...
                    </>
                  ) : (
                    <>
                      <SkipForward className="w-4 h-4 mr-2" />
                      Skip for testing
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
