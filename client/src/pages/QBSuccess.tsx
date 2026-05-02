import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Info, RefreshCw, ExternalLink, Wrench, Search, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { apiUrl, apiFetch } from '../utils/api';
import { setJustConnectedFlag } from '../context/WalkthroughContext';
import appConfig from '../../../config/app.json';

interface ImportQualitySummary {
  lookbackDays: number;
  topN: number;
  candidatesEvaluated: number;
  goodCount: number;
  fixableCount: number;
  trashCount: number;
  searchableCount: number;
  autoMatchedCount: number;
  zeroGoodNames: boolean;
  canAddManuallyCount: number;
  importRetailerMatchSkipped?: boolean;
  importedSampleNames?: string[];
}

export function QBSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isRetrying, setIsRetrying] = useState(false);
  const [qualitySummary, setQualitySummary] = useState<ImportQualitySummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const success = searchParams.get('success') === 'true';
  const error = searchParams.get('error');
  const errorMessage = searchParams.get('errorMessage') || '';
  const companyName = searchParams.get('companyName') || '';
  const importedCount = parseInt(searchParams.get('importedCount') || '0', 10);
  const importRunId = searchParams.get('importRunId');
  const inviteToken = searchParams.get('inviteToken') === 'true';
  const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;

  const isImportFailed = error === 'IMPORT_FAILED';
  const isAuthFailed = error === 'AUTHORIZATION_FAILED';
  const isUnknownFailure = !success && !isImportFailed && !isAuthFailed;

  useEffect(() => {
    if (!success || error) return;
    let cancelled = false;
    const load = async () => {
      setIsLoadingSummary(true);
      try {
        const endpoint = importRunId
          ? apiUrl(`/api/qb/import-quality/${importRunId}`)
          : apiUrl('/api/qb/import-quality/latest');
        const res = await apiFetch(endpoint);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setQualitySummary(data.qualitySummary || null);
        }
      } catch {
        // Silent fallback keeps success page usable.
      } finally {
        if (!cancelled) setIsLoadingSummary(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [success, error, importRunId]);

  const handleRetryImport = async () => {
    setIsRetrying(true);
    try {
      const res = await apiFetch(apiUrl('/api/qb/import'), { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        window.location.reload();
      } else {
        alert(data.error || 'Failed to retry import. Please try reconnecting QuickBooks.');
      }
    } catch (err) {
      console.error('Error retrying import:', err);
      alert('An error occurred. Please try reconnecting QuickBooks.');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleReconnect = async () => {
    try {
      const res = await apiFetch(apiUrl('/api/qb/reconnect'), {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.connectUrl) {
        window.location.href = data.connectUrl;
      } else {
        alert('Failed to generate reconnect URL. Please try again.');
      }
    } catch (err) {
      console.error('Error reconnecting:', err);
      alert('An error occurred. Please try again.');
    }
  };

  const handleGoToDashboard = () => {
    setJustConnectedFlag();
    navigate('/');
  };

  const handleGoToItems = () => navigate('/items');

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Success Header */}
        {success && !error && (
          <>
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold">QuickBooks Connected Successfully!</h1>
              {inviteToken && (
                <p className="text-lg text-muted-foreground">
                  <strong>You joined via invite link!</strong>
                </p>
              )}
              {companyName && (
                <p className="text-lg text-muted-foreground">Company: {companyName}</p>
              )}
            </div>

            {/* Imported Items Banner */}
            {importedCount > 0 && (
              <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-900 dark:text-green-100">
                        Imported {importedCount} items successfully.
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        Monitoring your top {maxMonitoredItems} items daily for savings.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoadingSummary && (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  Reviewing item name quality...
                </CardContent>
              </Card>
            )}

            {qualitySummary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Import Quality Wizard
                  </CardTitle>
                  <CardDescription>
                    We classified{' '}
                    <strong>{qualitySummary.candidatesEvaluated}</strong> distinct item name
                    {qualitySummary.candidatesEvaluated === 1 ? '' : 's'} from your QuickBooks purchases in the last{' '}
                    <strong>{qualitySummary.lookbackDays}</strong> days
                    {qualitySummary.topN > 0 ? (
                      <>
                        {' '}
                        (import-time auto-search limited to your top <strong>{qualitySummary.topN}</strong> by purchase activity).
                      </>
                    ) : null}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {importedCount > 0 &&
                    qualitySummary.importedSampleNames &&
                    qualitySummary.importedSampleNames.length > 0 && (
                      <div className="rounded-md border bg-muted/40 p-3 text-sm">
                        <p className="font-medium mb-2">Imported from QuickBooks this run</p>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                          {qualitySummary.importedSampleNames.map((name, idx) => (
                            <li key={`${idx}-${name}`}>{name}</li>
                          ))}
                          {importedCount > qualitySummary.importedSampleNames.length ? (
                            <li className="list-none pl-0 text-xs italic">
                              …and {importedCount - qualitySummary.importedSampleNames.length} more in Items.
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    )}

                  {qualitySummary.importRetailerMatchSkipped && importedCount > 0 ? (
                    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                      <CardContent className="pt-6 text-sm text-blue-900 dark:text-blue-100">
                        <p>
                          Import-time retailer auto-search is turned off in your server configuration (
                          <code className="text-xs">QB_IMPORT_MATCH_TOP_N=0</code> or{' '}
                          <code className="text-xs">QB_IMPORT_SKIP_RETAILER_MATCH</code>). Your purchases were still
                          imported into Procuro — open Items to review and match manually if needed.
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Good / classified names</p>
                      <p className="font-semibold">
                        {qualitySummary.goodCount} / {qualitySummary.candidatesEvaluated}
                      </p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Need fixing</p>
                      <p className="font-semibold">{qualitySummary.fixableCount}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Trash (ignored)</p>
                      <p className="font-semibold">{qualitySummary.trashCount}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Auto matched</p>
                      <p className="font-semibold">{qualitySummary.autoMatchedCount}</p>
                    </div>
                  </div>

                  {qualitySummary.zeroGoodNames &&
                  !qualitySummary.importRetailerMatchSkipped &&
                  qualitySummary.candidatesEvaluated > 0 ? (
                    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                      <CardContent className="pt-6 space-y-3">
                        <p className="font-semibold text-amber-900 dark:text-amber-100">
                          No good searchable names were found in this import.
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Names looked like vendor bills or were too vague for retail search. Rename lines in Items or add
                          clear product-style names manually.
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="rounded-md border p-3 text-sm space-y-2">
                    <p className="font-medium">What to do next</p>
                    {qualitySummary.importRetailerMatchSkipped ? (
                      <p>
                        Review imported items and add clearer names where needed. Open Items to adjust names or add
                        products manually for monitoring.
                      </p>
                    ) : (
                      <p>
                        Good names were auto-searched when import-time matching is enabled. Fixable names can be renamed
                        in Items. Trash names stay ignored for matching.
                      </p>
                    )}
                    <p>
                      You can manually add up to <strong>{qualitySummary.canAddManuallyCount}</strong> more items within
                      your monitoring limit ({maxMonitoredItems} total watched).
                    </p>
                    <p className="text-muted-foreground">
                      Good examples: "HP 414A Cyan Toner Cartridge", "3M 8210 N95 Respirator 20 pack", "Rubbermaid 32 Gallon Brute Trash Can".
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleGoToItems}>
                      <Wrench className="h-4 w-4 mr-2" />
                      Fix Names in Items
                    </Button>
                    <Button onClick={handleGoToItems} variant="outline">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Items Manually
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Why We Need Your QuickBooks Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Why Procuro Needs Your QuickBooks Data
                </CardTitle>
                <CardDescription>
                  We use your purchase data to help you save money
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-semibold">•</span>
                    <span>We import your purchase transactions to identify items your business buys most often.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-semibold">•</span>
                    <span>We analyze purchase frequency to determine which items should be monitored for savings.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-semibold">•</span>
                    <span>We compare these items daily across major retailers to find potential discounts.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-semibold">•</span>
                    <span>We store only the minimum data needed to perform these price checks.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex justify-center gap-4">
              <Button onClick={handleGoToDashboard} size="lg">
                Go to Dashboard
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {/* Import Failed Error */}
        {isImportFailed && (
          <>
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <AlertCircle className="h-16 w-16 text-red-600" />
              </div>
              <h1 className="text-3xl font-bold text-red-600">
                We could not complete your import
              </h1>
              <p className="text-lg text-muted-foreground">
                Try again or reconnect QuickBooks.
              </p>
            </div>

            <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
              <CardContent className="pt-6">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {errorMessage || 'An error occurred during the import process.'}
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-center gap-4">
              <Button onClick={handleRetryImport} disabled={isRetrying} variant="outline">
                <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Retrying...' : 'Retry Import'}
              </Button>
              <Button onClick={handleReconnect}>
                Reconnect QuickBooks
              </Button>
            </div>
          </>
        )}

        {/* Authorization Failed Error */}
        {isAuthFailed && (
          <>
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <AlertCircle className="h-16 w-16 text-red-600" />
              </div>
              <h1 className="text-3xl font-bold text-red-600">
                Authorization Failed
              </h1>
              <p className="text-lg text-muted-foreground">
                We could not complete the QuickBooks connection.
              </p>
            </div>

            <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
              <CardContent className="pt-6">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {errorMessage || 'An error occurred during authorization.'}
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-center gap-4">
              <Button onClick={handleReconnect}>
                Try Again
              </Button>
              <Button onClick={handleGoToDashboard} variant="outline">
                Go to Dashboard
              </Button>
            </div>
          </>
        )}

        {/* Unknown callback error fallback */}
        {isUnknownFailure && (
          <>
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <AlertCircle className="h-16 w-16 text-amber-600" />
              </div>
              <h1 className="text-3xl font-bold text-amber-700 dark:text-amber-400">
                Connection needs attention
              </h1>
              <p className="text-lg text-muted-foreground">
                QuickBooks returned an unexpected response.
              </p>
            </div>

            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <CardContent className="pt-6">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {errorMessage || (error ? `Error: ${error}` : 'No additional error details were provided.')}
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-center gap-4">
              <Button onClick={handleReconnect}>Reconnect QuickBooks</Button>
              <Button onClick={handleGoToDashboard} variant="outline">
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}




