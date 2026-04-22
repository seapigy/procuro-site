import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ClipboardCopy,
  TestTube2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { apiUrl, apiFetch } from '../utils/api';
import { useSubscription } from '../context/SubscriptionContext';

interface TestStatus {
  testMode: boolean;
  company: {
    id: number;
    name: string;
    isSubscribed: boolean;
    stripeCustomerId: string | null;
    monitoredItemsCount: number;
    lastAlertGenerated: string | null;
    userCount: number;
  } | null;
}

interface AmazonPreflightCheck {
  id: string;
  ok: boolean;
  message: string;
  hint?: string;
}

interface AmazonPreflightResponse {
  checks: AmazonPreflightCheck[];
  summary: {
    readyForAmazonKeywordDiscovery: boolean;
    allWarningsResolved: boolean;
  };
  envHint: Record<string, unknown>;
  costHint: string;
}

interface AmazonCandidatePreview {
  asin: string;
  title: string;
  price: number;
  combinedScore: number;
  confidenceBand: string;
  rejectionCode?: string;
}

interface AmazonBatchRow {
  itemId: number;
  itemName: string;
  outcome: string;
  rawRowsReturned: number;
  rowsAfterProductFilter: number;
  normalizedRows: number;
  cacheHit: boolean;
  emptyReason?: string;
  errorMessage?: string;
  selectedUnitPrice?: number;
  selectedTitle?: string;
  selectedUrl?: string;
  selectedAsin?: string;
  discoveryKeyword?: string;
  matcherTopRejectionCode?: string;
  matcherTopRejectionDetail?: string;
  reviewHint?: string;
  failureKind?: 'infra' | 'data';
  topCandidates?: AmazonCandidatePreview[];
  usedFallbackKeyword?: boolean;
}

type AmazonLiveBatchProgressState =
  | { phase: 'idle' }
  | {
      phase: 'running';
      currentIndex: number;
      total: number;
      itemId: number | null;
      itemNameShort: string;
      startedAt: number;
    };

interface MatchHealthResponse {
  companyId: number;
  byMatchStatus: { matchStatus: string | null; count: number }[];
  needsClarificationCount: number;
  vagueNameCount: number;
  generatedAt: string;
}

interface AmazonBatchResponse {
  companyId: number;
  companyName: string;
  skipCache: boolean;
  ensureItems: boolean;
  summary: {
    totalItems: number;
    successCount: number;
    noRowsCount: number;
    matcherRejectedCount: number;
    errorCount: number;
    skippedNeedsClarificationCount?: number;
    totalBillableRecords: number;
    ratePerThousandUsd: number;
    estimatedCostUsd: number;
  };
  note: string;
  results: AmazonBatchRow[];
  textReport: string;
}

export function TestAdmin() {
  const { refetch: refetchSubscription } = useSubscription();
  const [status, setStatus] = useState<TestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [preflight, setPreflight] = useState<AmazonPreflightResponse | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [testScenario, setTestScenario] = useState<string>('');
  const [amazonBatchLoading, setAmazonBatchLoading] = useState(false);
  const [amazonBatchResult, setAmazonBatchResult] = useState<AmazonBatchResponse | null>(null);
  const [amazonEnsureItems, setAmazonEnsureItems] = useState(true);
  const [amazonBypassCache, setAmazonBypassCache] = useState(true);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [amazonLiveProgress, setAmazonLiveProgress] = useState<AmazonLiveBatchProgressState | null>(null);
  const [matchHealth, setMatchHealth] = useState<MatchHealthResponse | null>(null);
  const [matchHealthLoading, setMatchHealthLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(apiUrl('/api/test/status'));
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching test status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreflight = useCallback(async () => {
    try {
      setPreflightLoading(true);
      const res = await apiFetch(apiUrl('/api/test/amazon-preflight'));
      const data = await res.json();
      if (res.ok) {
        setPreflight(data);
      } else {
        setPreflight(null);
        console.error('Preflight failed:', data);
      }
    } catch (e) {
      console.error('Preflight fetch error:', e);
      setPreflight(null);
    } finally {
      setPreflightLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (status?.testMode) {
      fetchPreflight();
    }
  }, [status?.testMode, fetchPreflight]);

  const fetchMatchHealth = useCallback(async () => {
    try {
      setMatchHealthLoading(true);
      const res = await apiFetch(apiUrl('/api/test/match-health'));
      const data = await res.json();
      if (res.ok) {
        setMatchHealth(data as MatchHealthResponse);
      } else {
        setMatchHealth(null);
        console.error('match-health failed:', data);
      }
    } catch (e) {
      console.error('match-health error:', e);
      setMatchHealth(null);
    } finally {
      setMatchHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status?.testMode) {
      void fetchMatchHealth();
    }
  }, [status?.testMode, fetchMatchHealth]);

  useEffect(() => {
    if (!amazonBatchLoading) {
      setAmazonLiveProgress(null);
      return;
    }
    const poll = async () => {
      try {
        const res = await apiFetch(apiUrl('/api/test/amazon-live-batch-progress'));
        if (res.ok) {
          const d = (await res.json()) as AmazonLiveBatchProgressState;
          setAmazonLiveProgress(d);
        }
      } catch {
        /* ignore */
      }
    };
    void poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [amazonBatchLoading]);

  const handleAction = async (endpoint: string, actionName: string) => {
    try {
      setActionLoading(actionName);
      const res = await apiFetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok) {
        // Refresh status after action
        await fetchStatus();
        if (endpoint.includes('subscribe') || endpoint.includes('unsubscribe')) {
          await refetchSubscription();
        }
        alert(`✅ ${actionName} completed successfully!`);
      } else {
        alert(`❌ ${actionName} failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`❌ ${actionName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const runAmazonLiveBatch = async () => {
    try {
      setAmazonBatchLoading(true);
      setAmazonBatchResult(null);
      setCopyHint(null);
      const res = await apiFetch(apiUrl('/api/test/amazon-live-batch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bypassCache: amazonBypassCache,
          ensureItems: amazonEnsureItems,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAmazonBatchResult(data);
        await fetchPreflight();
        await fetchMatchHealth();
      } else {
        alert(`Amazon live batch failed: ${data.error || res.statusText}\n${data.hint || data.details || ''}`);
      }
    } catch (e) {
      alert(`Amazon live batch failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setAmazonBatchLoading(false);
    }
  };

  const copyTextReport = async () => {
    if (!amazonBatchResult?.textReport) return;
    try {
      await navigator.clipboard.writeText(amazonBatchResult.textReport);
      setCopyHint('Copied to clipboard');
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint('Copy failed');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!status?.testMode) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Admin Panel</CardTitle>
            <CardDescription>Test mode is not enabled</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              To use the test admin panel, set <code className="bg-muted px-2 py-1 rounded">TEST_MODE=true</code> in your environment variables.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Test Admin Panel</h1>
        <p className="text-muted-foreground mt-1">Manage test environment and simulate user actions</p>
      </div>

      {/* Company State */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Company State
          </CardTitle>
          <CardDescription>Current test company status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.company ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company Name</p>
                  <p className="font-semibold">{status.company.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Company ID</p>
                  <p className="font-semibold">{status.company.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription Status</p>
                  <Badge variant={status.company.isSubscribed ? "default" : "secondary"} className={status.company.isSubscribed ? "bg-green-600" : ""}>
                    {status.company.isSubscribed ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monitored Items</p>
                  <p className="font-semibold">{status.company.monitoredItemsCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Users</p>
                  <p className="font-semibold">{status.company.userCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Alert Generated</p>
                  <p className="font-semibold">
                    {status.company.lastAlertGenerated
                      ? new Date(status.company.lastAlertGenerated).toLocaleString()
                      : 'None'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Test company not found. Run setup first.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match health (aggregate Item.matchStatus — TEST_MODE) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Match health
          </CardTitle>
          <CardDescription>
            Counts by <code className="text-xs">matchStatus</code> for the current test company — use for tuning matcher UX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchMatchHealth()} disabled={matchHealthLoading}>
              {matchHealthLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
            {matchHealth?.generatedAt ? (
              <span className="text-xs text-muted-foreground">Updated {new Date(matchHealth.generatedAt).toLocaleString()}</span>
            ) : null}
          </div>
          {matchHealth ? (
            <div className="text-sm space-y-2">
              <p>
                <span className="text-muted-foreground">Company ID:</span> {matchHealth.companyId}
              </p>
              <p>
                <span className="text-muted-foreground">needsClarification:</span>{' '}
                <strong>{matchHealth.needsClarificationCount}</strong>
                <span className="text-muted-foreground mx-2">·</span>
                <span className="text-muted-foreground">isVagueName:</span>{' '}
                <strong>{matchHealth.vagueNameCount}</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {matchHealth.byMatchStatus.map((row) => (
                  <li key={String(row.matchStatus)}>
                    <span className="font-mono">{row.matchStatus ?? 'null'}</span>: {row.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {matchHealthLoading ? 'Loading…' : 'No data — ensure company context is set (test user / setup).'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Amazon live test preflight */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube2 className="w-5 h-5" />
            Amazon live test preflight
          </CardTitle>
          <CardDescription>
            No Bright Data calls — verify tenant and env before running a paid batch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {preflightLoading && !preflight ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : preflight ? (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant={preflight.summary.readyForAmazonKeywordDiscovery ? 'default' : 'destructive'}>
                  {preflight.summary.readyForAmazonKeywordDiscovery
                    ? 'Ready for keyword discovery'
                    : 'Not ready (fix required checks)'}
                </Badge>
                <Badge variant={preflight.summary.allWarningsResolved ? 'secondary' : 'outline'}>
                  {preflight.summary.allWarningsResolved ? 'All checks green' : 'Some informational warnings'}
                </Badge>
              </div>
              <ul className="space-y-2 text-sm">
                {preflight.checks.map((c) => (
                  <li key={c.id} className="flex gap-2 items-start">
                    {c.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-medium">{c.id}</span>: {c.message}
                      {c.hint ? (
                        <p className="text-muted-foreground text-xs mt-0.5">{c.hint}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">envHint</summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                  {JSON.stringify(preflight.envHint, null, 2)}
                </pre>
              </details>
              <p className="text-xs text-muted-foreground">{preflight.costHint}</p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Preflight unavailable.</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchPreflight}
            disabled={preflightLoading}
          >
            {preflightLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh preflight
          </Button>
        </CardContent>
      </Card>

      {/* Scenario runner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Test scenario
          </CardTitle>
          <CardDescription>
            Run a scripted live test (may incur Bright Data usage). Each item calls Bright Data once
            (~1–3+ min per item); all 20 often take 20–60+ minutes total. Progress updates every few
            seconds while the spinner runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="test-scenario" className="text-sm font-medium">
              Scenario
            </label>
            <select
              id="test-scenario"
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={testScenario}
              onChange={(e) => setTestScenario(e.target.value)}
            >
              <option value="">— Select —</option>
              <option value="amazon_live">Amazon Test (20 cleaning items, live Bright Data)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={amazonEnsureItems}
                onChange={(e) => setAmazonEnsureItems(e.target.checked)}
              />
              Ensure 20 cleaning items in Supabase (idempotent upsert)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={amazonBypassCache}
                onChange={(e) => setAmazonBypassCache(e.target.checked)}
              />
              Bypass discovery cache (force live Bright Data per item)
            </label>
          </div>
          <Button
            type="button"
            onClick={runAmazonLiveBatch}
            disabled={testScenario !== 'amazon_live' || amazonBatchLoading}
          >
            {amazonBatchLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Amazon batch…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run scenario
              </>
            )}
          </Button>
          {amazonBatchLoading && amazonLiveProgress?.phase === 'running' ? (
            <div className="rounded-md border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              <p className="font-medium">
                Progress: item {amazonLiveProgress.currentIndex + 1} of {amazonLiveProgress.total}
                {amazonLiveProgress.itemId != null ? ` (id ${amazonLiveProgress.itemId})` : ''}
              </p>
              <p className="text-xs mt-1 opacity-90 break-words">{amazonLiveProgress.itemNameShort}</p>
              <p className="text-xs mt-1 text-muted-foreground">
                Elapsed: {Math.round((Date.now() - amazonLiveProgress.startedAt) / 1000)}s — current step is
                network-bound (Amazon / Bright Data).
              </p>
            </div>
          ) : null}
          {amazonBatchLoading && (!amazonLiveProgress || amazonLiveProgress.phase !== 'running') ? (
            <p className="text-xs text-muted-foreground">
              Starting batch… if progress doesn’t appear, restart the backend and try again.
            </p>
          ) : null}
          {amazonBatchResult ? (
            <div className="space-y-3 border rounded-lg p-4 mt-2">
              <div className="text-sm">
                <p className="font-semibold">
                  {amazonBatchResult.companyName} (companyId={amazonBatchResult.companyId})
                </p>
                <p className="text-muted-foreground mt-1">
                  OK: {amazonBatchResult.summary.successCount} · No rows:{' '}
                  {amazonBatchResult.summary.noRowsCount} · Matcher rejected:{' '}
                  {amazonBatchResult.summary.matcherRejectedCount} · Errors:{' '}
                  {amazonBatchResult.summary.errorCount}
                  {typeof amazonBatchResult.summary.skippedNeedsClarificationCount === 'number'
                    ? ` · Skipped (needs clarification): ${amazonBatchResult.summary.skippedNeedsClarificationCount}`
                    : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Failure kinds:</strong> <code className="text-xs">infra</code> = timeouts / API (retry later);
                  <code className="text-xs ml-1">data</code> = matcher / naming (edit brand, pack, Amazon hint).
                </p>
                <p className="mt-2">
                  Billable raw rows (non-cache):{' '}
                  <strong>{amazonBatchResult.summary.totalBillableRecords}</strong> · Est. cost @ $
                  {amazonBatchResult.summary.ratePerThousandUsd}/1k:{' '}
                  <strong>${amazonBatchResult.summary.estimatedCostUsd.toFixed(4)}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{amazonBatchResult.note}</p>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto border rounded">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Outcome</th>
                      <th className="p-2">Kind</th>
                      <th className="p-2">Top rejection</th>
                      <th className="p-2">Review hint</th>
                      <th className="p-2">Keyword</th>
                      <th className="p-2">FB</th>
                      <th className="p-2">raw</th>
                      <th className="p-2">filt</th>
                      <th className="p-2">norm</th>
                      <th className="p-2">Top candidates</th>
                      <th className="p-2">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amazonBatchResult.results.map((r) => (
                      <tr key={r.itemId} className="border-t align-top">
                        <td className="p-2 font-mono">{r.itemId}</td>
                        <td className="p-2 max-w-[200px] truncate" title={r.itemName}>
                          {r.itemName}
                        </td>
                        <td className="p-2 whitespace-nowrap">{r.outcome}</td>
                        <td className="p-2 whitespace-nowrap">{r.failureKind ?? '—'}</td>
                        <td className="p-2 max-w-[140px] break-words" title={r.matcherTopRejectionDetail}>
                          {r.matcherTopRejectionCode ?? '—'}
                        </td>
                        <td className="p-2 max-w-[220px] text-[11px] leading-snug">{r.reviewHint ?? '—'}</td>
                        <td className="p-2 max-w-[160px] break-all text-[11px]" title={r.discoveryKeyword}>
                          {r.discoveryKeyword ?? '—'}
                        </td>
                        <td className="p-2">{r.usedFallbackKeyword ? 'Y' : '—'}</td>
                        <td className="p-2">{r.rawRowsReturned}</td>
                        <td className="p-2">{r.rowsAfterProductFilter}</td>
                        <td className="p-2">{r.normalizedRows}</td>
                        <td className="p-2 max-w-[240px] text-[11px]">
                          {r.topCandidates?.length
                            ? r.topCandidates.map((c, i) => (
                                <div key={i} className="mb-1 border-b border-border/60 pb-1 last:border-0">
                                  <span className="font-mono">{c.asin}</span>{' '}
                                  {c.rejectionCode ? (
                                    <span className="text-amber-700 dark:text-amber-300">({c.rejectionCode})</span>
                                  ) : null}
                                  <div className="line-clamp-2 opacity-90">{c.title}</div>
                                </div>
                              ))
                            : '—'}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {r.selectedUnitPrice != null ? `$${r.selectedUnitPrice.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={copyTextReport}>
                  <ClipboardCopy className="w-4 h-4 mr-2" />
                  Copy report
                </Button>
                {copyHint ? <span className="text-xs text-muted-foreground">{copyHint}</span> : null}
              </div>
              <pre className="text-xs bg-muted p-3 rounded max-h-48 overflow-auto whitespace-pre-wrap">
                {amazonBatchResult.textReport}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Test Actions
          </CardTitle>
          <CardDescription>Simulate user actions and system processes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button
              onClick={() => handleAction('/api/test/setup', 'Setup Test Environment')}
              disabled={!!actionLoading}
              className="w-full"
              variant="outline"
            >
              {actionLoading === 'Setup Test Environment' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  Setup Test Environment
                </>
              )}
            </Button>

            <Button
              onClick={() => handleAction('/api/test/import-sample-data', 'Import Sample QBO Data')}
              disabled={!!actionLoading}
              className="w-full"
              variant="outline"
            >
              {actionLoading === 'Import Sample QBO Data' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Import Sample QBO Data
                </>
              )}
            </Button>

            <Button
              onClick={() => handleAction('/api/test/recompute-monitoring', 'Recompute Monitoring')}
              disabled={!!actionLoading}
              className="w-full"
              variant="outline"
            >
              {actionLoading === 'Recompute Monitoring' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recomputing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recompute Monitoring
                </>
              )}
            </Button>

            <Button
              onClick={() => handleAction('/api/test/run-price-check', 'Run Price Check Now')}
              disabled={!!actionLoading}
              className="w-full"
              variant="outline"
            >
              {actionLoading === 'Run Price Check Now' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Price Check Now
                </>
              )}
            </Button>

            <Button
              onClick={() => handleAction('/api/test/create-matching-edge-cases', 'Create Matching Edge Cases')}
              disabled={!!actionLoading}
              className="w-full"
              variant="outline"
            >
              {actionLoading === 'Create Matching Edge Cases' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Create Matching Edge Cases
                </>
              )}
            </Button>

            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-semibold mb-2">Subscription Simulation</p>
              <div className="space-y-2">
                <Button
                  onClick={() => handleAction('/api/test/force-subscribe', 'Force Subscribe')}
                  disabled={!!actionLoading || status.company?.isSubscribed}
                  className="w-full"
                  variant={status.company?.isSubscribed ? "secondary" : "default"}
                >
                  {actionLoading === 'Force Subscribe' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Subscribing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Force Subscribe
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleAction('/api/test/force-unsubscribe', 'Force Unsubscribe')}
                  disabled={!!actionLoading || !status.company?.isSubscribed}
                  className="w-full"
                  variant="outline"
                >
                  {actionLoading === 'Force Unsubscribe' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Unsubscribing...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Force Unsubscribe
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          onClick={fetchStatus}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>
    </div>
  );
}

