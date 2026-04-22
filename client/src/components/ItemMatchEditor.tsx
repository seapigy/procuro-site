import { useState, useEffect } from 'react';
import { Check, RefreshCw, Loader2, ExternalLink, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { apiUrl, apiFetch } from '../utils/api';
import { cn } from '@/lib/utils';
import { InfoTooltip } from './InfoTooltip';
import { hasConcreteMatchEvidence } from '../utils/itemMatchQuality';

const BASELINE_TOOLTIP = 'Baseline is set from your QuickBooks purchase history (typically your higher recent price) so savings stays consistent month to month.';

interface ItemMatchEditorProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    name: string;
    upc?: string | null;
    vendorName?: string | null;
    productBrand?: string | null;
    category?: string | null;
    baselinePrice?: number;
    baselineUnitPrice?: number | null;
    lastPaidPrice?: number;
    matchedRetailer: string | null;
    matchedUrl: string | null;
    matchedPrice: number | null;
    matchConfidence: number | null;
    matchStatus?: string;
    isManuallyMatched?: boolean;
    matchProvider?: string | null;
    matchUrl?: string | null;
    matchTitle?: string | null;
    matchReasons?: any;
    manualMatchProvider?: string | null;
    manualMatchUrl?: string | null;
    manualMatchTitle?: string | null;
    lastMatchedAt?: string | null;
  };
  onMatchUpdated?: () => void;
}

type RematchRetailerDiag = {
  configured?: boolean;
  ran?: boolean;
  skippedReason?: string;
};

type RematchApiBody = {
  message?: string;
  isManuallyMatched?: boolean;
  item?: { matchStatus?: string };
  match?: unknown;
  rematchDiagnostics?: {
    retailerPolicy?: {
      amazon: boolean;
      homeDepot: boolean;
      reason?: string;
    };
    amazon?: RematchRetailerDiag;
    homeDepot?: RematchRetailerDiag;
    /** Legacy flat shape (older responses) */
    amazonDiscoveryConfigured?: boolean;
    amazonDiscoveryRan?: boolean;
    amazonDiscoverySkippedReason?: string;
  };
};

function isRematchConfigWarning(
  diag: RematchApiBody['rematchDiagnostics'] | null | undefined
): boolean {
  if (!diag) return false;
  if (diag.amazonDiscoveryConfigured === false) return true;
  const amz = diag.amazon;
  const hd = diag.homeDepot;
  const bad = (d: RematchRetailerDiag | undefined) =>
    !!d &&
    d.configured === false &&
    !!d.skippedReason &&
    d.skippedReason !== 'excluded_by_policy';
  return bad(amz) || bad(hd);
}

type LoadingAction = 'verify' | 'override' | 'rematch';

export function ItemMatchEditor({ isOpen, onClose, item, onMatchUpdated }: ItemMatchEditorProps) {
  const [loadingAction, setLoadingAction] = useState<LoadingAction | null>(null);
  const isBusy = loadingAction !== null;
  const isRematching = loadingAction === 'rematch';
  const [error, setError] = useState<string | null>(null);
  const [overrideProvider, setOverrideProvider] = useState('amazon');
  const [overrideUrl, setOverrideUrl] = useState('');
  const [overrideTitle, setOverrideTitle] = useState('');
  const [overridePrice, setOverridePrice] = useState('');
  const [overrideUpc, setOverrideUpc] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [updateItemName, setUpdateItemName] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [fetchingProductDetails, setFetchingProductDetails] = useState(false);
  const [previousItemId, setPreviousItemId] = useState<number | null>(null);
  const [rematchSuccessMessage, setRematchSuccessMessage] = useState<string | null>(null);
  const [rematchDiag, setRematchDiag] = useState<RematchApiBody['rematchDiagnostics'] | null>(null);

  // Only reset form state when modal first opens or item changes, not on every render
  useEffect(() => {
    const isNewOpen = !previousItemId || previousItemId !== item.id;

    if (isOpen && isNewOpen) {
      setShowOverrideForm(false);
      setError(null);
      setRematchSuccessMessage(null);
      setRematchDiag(null);
      setOverrideUrl('');
      setOverrideTitle('');
      setOverridePrice('');
      setOverrideUpc('');
      setOverrideNotes('');
      setUpdateItemName(false);
      setPreviousItemId(item.id);
    } else if (!isOpen) {
      setPreviousItemId(null);
      setRematchSuccessMessage(null);
      setRematchDiag(null);
    }
  }, [isOpen, item.id, previousItemId]);

  const handleVerify = async () => {
    try {
      setLoadingAction('verify');
      setError(null);

      const res = await apiFetch(apiUrl(`/api/items/${item.id}/match/verify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        onMatchUpdated?.();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || data.message || 'Failed to verify match');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify match');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOverride = async () => {
    if (!overrideUrl.trim()) {
      setError('URL is required');
      return;
    }

    try {
      setLoadingAction('override');
      setError(null);

      const res = await apiFetch(apiUrl(`/api/items/${item.id}/match/override`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: overrideProvider,
          url: overrideUrl.trim(),
          title: overrideTitle.trim() || undefined,
          price: overridePrice ? parseFloat(overridePrice) : undefined,
          upc: overrideUpc.trim() || undefined,
          notes: overrideNotes.trim() || undefined,
          updateItemName: updateItemName && overrideTitle.trim() ? overrideTitle.trim() : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          onMatchUpdated?.();
        } else {
          onMatchUpdated?.();
          onClose();
        }
      } else {
        const data = await res.json();
        setError(data.error || data.message || 'Failed to override match');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to override match');
    } finally {
      setLoadingAction(null);
    }
  };

  const summarizeRematchResponse = (data: RematchApiBody): string => {
    const diag = data.rematchDiagnostics;
    if (diag?.amazonDiscoveryConfigured === false && diag.amazonDiscoverySkippedReason) {
      return diag.amazonDiscoverySkippedReason;
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }
    if (data.isManuallyMatched) {
      return 'Suggestions are shown below (not saved until you verify or override).';
    }
    const st = data.item?.matchStatus;
    if (st === 'unmatched' && diag?.retailerPolicy) {
      const rp = diag.retailerPolicy;
      const amz = diag.amazon;
      const hd = diag.homeDepot;
      const searched: string[] = [];
      if (amz?.ran) searched.push('Amazon');
      if (hd?.ran) searched.push('Home Depot');
      if (searched.length > 0) {
        return `Rematch searched ${searched.join(' and ')} but no suitable product was found. Try a shorter or clearer product name, add brand or hint, or use Override with the exact product URL.`;
      }
      if (rp.homeDepot && hd && !hd.configured && hd.skippedReason && hd.skippedReason !== 'excluded_by_policy') {
        return `This item is routed to Home Depot search, but it is not configured (${hd.skippedReason}). Use Override with the exact product URL, or configure Home Depot Bright Data on the server.`;
      }
      if (rp.amazon && amz && !amz.configured && amz.skippedReason && amz.skippedReason !== 'excluded_by_policy') {
        return `This item is routed to Amazon search, but it is not configured (${amz.skippedReason}). Use Override with the exact product URL, or configure Amazon Bright Data on the server.`;
      }
      return 'Rematch did not find a suitable product. Try a shorter or clearer product name, add brand or hint, or use Override with the exact product URL.';
    }
    if (st === 'unmatched') {
      return 'Rematch completed but no suitable product was found. Try a shorter or clearer product name, add brand or hint, or use Override with the exact product URL.';
    }
    return 'Rematch finished. Review the updated candidate below.';
  };

  const handleRematch = async () => {
    try {
      setLoadingAction('rematch');
      setError(null);
      setRematchSuccessMessage(null);
      setRematchDiag(null);

      const res = await apiFetch(apiUrl(`/api/items/${item.id}/rematch`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = (await res.json()) as RematchApiBody;
        setRematchDiag(data.rematchDiagnostics ?? null);
        setRematchSuccessMessage(summarizeRematchResponse(data));
        onMatchUpdated?.();
      } else {
        const data = await res.json();
        setError(data.error || data.message || 'Failed to re-match item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-match item');
    } finally {
      setLoadingAction(null);
    }
  };

  const matchStatus = item.matchStatus || 'unmatched';
  const currentMatch = item.matchProvider || item.matchedRetailer || item.manualMatchProvider || null;
  const currentUrl = item.matchUrl || item.matchedUrl || item.manualMatchUrl || null;
  const currentTitle = item.matchTitle || item.manualMatchTitle || item.name;
  const currentPrice = item.matchedPrice;
  const hasAnyMatchEvidence = hasConcreteMatchEvidence({
    itemName: item.name,
    matchProvider: item.matchProvider,
    matchedRetailer: item.matchedRetailer,
    matchUrl: item.matchUrl,
    matchedUrl: item.matchedUrl,
    matchTitle: item.matchTitle,
    manualMatchTitle: item.manualMatchTitle,
    matchedPrice: item.matchedPrice,
    matchConfidence: item.matchConfidence,
  });
  const isMatchedByStatus = ['auto_matched', 'needs_review', 'verified', 'overridden'].includes(matchStatus);
  const shouldShowPrimaryMatch = isMatchedByStatus || hasAnyMatchEvidence;
  const isTrulyUnmatched = matchStatus === 'unmatched' && !hasAnyMatchEvidence;
  const canVerify =
    Boolean(item.matchProvider && item.matchUrl) &&
    matchStatus !== 'verified' &&
    matchStatus !== 'overridden';

  const reasons = (item.matchReasons && typeof item.matchReasons === 'object')
    ? (item.matchReasons as Record<string, unknown>)
    : null;

  const confidence = item.matchConfidence;
  const confidenceBand = confidence == null
    ? { label: 'Unknown', tone: 'text-muted-foreground', next: 'Run Rematch to refresh candidate confidence.' }
    : confidence >= 0.85
      ? { label: 'High confidence', tone: 'text-emerald-600 dark:text-emerald-400', next: 'Looks good — verify to lock this match.' }
      : confidence >= 0.5
        ? { label: 'Review recommended', tone: 'text-amber-600 dark:text-amber-400', next: 'Compare details and verify if this is the right product.' }
        : { label: 'Low confidence', tone: 'text-orange-600 dark:text-orange-400', next: 'Use Verify only after checking details, or choose Override/Rematch.' };

  const sourceLabel =
    matchStatus === 'overridden'
      ? 'Manual override'
      : matchStatus === 'verified'
        ? 'User verified'
        : item.isManuallyMatched
          ? 'Manual lock'
          : 'Automatic match';

  const sourceTime = item.lastMatchedAt ? new Date(item.lastMatchedAt).toLocaleString() : null;

  const reasonBullets: string[] = [];
  const numericReason = (key: string) => {
    const value = reasons?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  const tokenOverlap = numericReason('tokenOverlap');
  const editSimilarity = numericReason('editSimilarity');
  const brandMatch = reasons?.['brandMatch'];
  const sizeMatch = reasons?.['sizeMatch'];
  const needsReviewReason = reasons?.['needsReviewReason'];
  if (tokenOverlap != null) reasonBullets.push(`Token overlap: ${(tokenOverlap * 100).toFixed(0)}%`);
  if (editSimilarity != null) reasonBullets.push(`Text similarity: ${(editSimilarity * 100).toFixed(0)}%`);
  if (typeof brandMatch === 'boolean') reasonBullets.push(brandMatch ? 'Brand signal matched.' : 'Brand signal weak or missing.');
  if (typeof sizeMatch === 'boolean') reasonBullets.push(sizeMatch ? 'Size/pack signal matched.' : 'Size/pack details may not align.');
  if (typeof needsReviewReason === 'string' && needsReviewReason.trim()) reasonBullets.push(needsReviewReason.trim());
  if (reasonBullets.length === 0) {
    reasonBullets.push('No detailed score breakdown available yet.');
  }

  const normalize = (v?: string | null) => (v || '').trim().toLowerCase();
  const itemBrandNorm = normalize(item.productBrand);
  const matchedBrandRaw = typeof reasons?.['matchBrand'] === 'string' ? String(reasons?.['matchBrand']) : '';
  const matchedBrandNorm = normalize(matchedBrandRaw);
  const upcFromReason = typeof reasons?.['upc'] === 'string' ? String(reasons?.['upc']) : '';
  const compareRows = [
    {
      label: 'Brand',
      left: item.productBrand || 'Not set',
      right: matchedBrandRaw || 'Unknown',
      ok: itemBrandNorm.length > 0 && matchedBrandNorm.length > 0 && itemBrandNorm === matchedBrandNorm,
      note: matchedBrandRaw ? undefined : 'No brand from matched record',
    },
    {
      label: 'Size / Pack',
      left: item.name,
      right: currentTitle || 'Unknown',
      ok: typeof sizeMatch === 'boolean' ? sizeMatch : null,
      note: typeof sizeMatch === 'boolean' ? undefined : 'No explicit size signal available',
    },
    {
      label: 'UPC',
      left: item.upc || 'Not set',
      right: upcFromReason || 'Unknown',
      ok: Boolean(item.upc && upcFromReason && item.upc === upcFromReason),
      note: upcFromReason ? undefined : 'Matched product did not include UPC',
    },
  ];

  const historyRows: Array<{ label: string; when: string | null }> = [];
  const reasonHistory = Array.isArray(reasons?.['history']) ? (reasons?.['history'] as Array<Record<string, unknown>>) : [];
  if (reasonHistory.length > 0) {
    reasonHistory.slice(-4).reverse().forEach((entry) => {
      const action = typeof entry.action === 'string' ? entry.action : 'Match updated';
      const note = typeof entry.note === 'string' && entry.note.trim() ? ` (${entry.note.trim()})` : '';
      const ts = typeof entry.at === 'string' ? new Date(entry.at).toLocaleString() : null;
      historyRows.push({ label: `${action}${note}`, when: ts });
    });
  } else {
    if (sourceTime) {
      historyRows.push({ label: `${sourceLabel} recorded`, when: sourceTime });
    }
    if (matchStatus === 'verified') {
      historyRows.push({ label: 'Current state: Verified', when: null });
    } else if (matchStatus === 'overridden') {
      historyRows.push({ label: 'Current state: Overridden', when: null });
    } else if (matchStatus === 'needs_review') {
      historyRows.push({ label: 'Current state: Needs Review', when: null });
    } else if (matchStatus === 'auto_matched') {
      historyRows.push({ label: 'Current state: Auto Matched', when: null });
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Fix Item Match"
      maxWidth="lg"
      closeOnBackdropClick={!showOverrideForm}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/20 px-3 py-2">
          Matches are based on the best current product candidate. Verify to confirm, or override if you found a better product.
        </p>
        {isRematching && (
          <div
            role="status"
            aria-live="polite"
            className="flex gap-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm"
          >
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-foreground">Searching for a product match…</p>
              <p className="mt-1 text-muted-foreground">
                Fix Match runs catalog search on the retailers allowed for this item (often{' '}
                <strong>Amazon</strong> and/or <strong>Home Depot</strong> via Bright Data). This can take{' '}
                <strong>30–60 seconds</strong> when the server is configured; please keep this window open.
              </p>
            </div>
          </div>
        )}
        {rematchSuccessMessage && (
          <div
            className={cn(
              'rounded-md border px-3 py-2 text-sm',
              isRematchConfigWarning(rematchDiag)
                ? 'border-amber-300/60 bg-amber-50/90 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                : 'border-emerald-300/50 bg-emerald-50/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
            )}
          >
            {rematchSuccessMessage}
          </div>
        )}
        <div className="border rounded-lg p-4 bg-muted/30">
          <p className="text-sm font-semibold mb-3">Current Item Details:</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <p className="font-semibold">{item.name}</p>
            </div>
            {item.upc && (
              <div>
                <span className="text-muted-foreground">UPC:</span>
                <p className="font-mono">{item.upc}</p>
              </div>
            )}
            {item.vendorName && (
              <div>
                <span className="text-muted-foreground">Vendor:</span>
                <p>{item.vendorName}</p>
              </div>
            )}
            {item.category && (
              <div>
                <span className="text-muted-foreground">Category:</span>
                <p>{item.category}</p>
              </div>
            )}
            {(item.baselineUnitPrice != null || item.baselinePrice != null) && (
              <div>
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  Baseline price: <InfoTooltip text={BASELINE_TOOLTIP} />
                </span>
                <p className="font-bold text-primary">
                  ${(item.baselineUnitPrice ?? item.baselinePrice ?? 0).toFixed(2)}
                </p>
              </div>
            )}
            {item.lastPaidPrice != null && item.lastPaidPrice > 0 && (
              <div>
                <span className="text-muted-foreground">Last Paid Price:</span>
                <p className="font-bold">${item.lastPaidPrice.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>

        {item.matchStatus && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            {item.matchStatus === 'unmatched' && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Unmatched
              </Badge>
            )}
            {item.matchStatus === 'needs_review' && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                Needs Review
              </Badge>
            )}
            {item.matchStatus === 'auto_matched' && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                Auto Matched
              </Badge>
            )}
            {item.matchStatus === 'verified' && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                Verified
              </Badge>
            )}
            {item.matchStatus === 'overridden' && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                Overridden
              </Badge>
            )}
          </div>
        )}

        {shouldShowPrimaryMatch ? (
          <div className="border rounded-lg p-4 bg-muted/50">
            <p className="text-sm font-semibold mb-2">Best Current Match</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Match source:</span>
                <span className="font-medium">{sourceLabel}</span>
              </div>
              {sourceTime && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last matched:</span>
                  <span className="font-medium">{sourceTime}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Retailer:</span>
                <span className="font-medium capitalize">{currentMatch || 'Unknown retailer'}</span>
              </div>
              {currentTitle && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Title:</span>
                  <span className="font-medium text-sm text-right max-w-md">{currentTitle}</span>
                </div>
              )}
              {currentPrice !== null && currentPrice !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Price:</span>
                  <span className="font-bold text-primary">${currentPrice.toFixed(2)}</span>
                </div>
              )}
              {item.matchReasons?.upc && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">UPC:</span>
                  <span className="font-mono text-sm">{item.matchReasons.upc}</span>
                  {item.upc && (
                    <span className={`text-xs ml-2 ${item.upc === item.matchReasons.upc ? 'text-green-600' : 'text-yellow-600'}`}>
                      {item.upc === item.matchReasons.upc ? '✓' : '⚠'}
                    </span>
                  )}
                </div>
              )}
              {item.matchConfidence !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Confidence:</span>
                  <span className={`font-medium ${confidenceBand.tone}`}>{(item.matchConfidence * 100).toFixed(0)}% ({confidenceBand.label})</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-muted-foreground">Recommendation:</span>
                <span className="text-sm text-right">{confidenceBand.next}</span>
              </div>
              {currentUrl ? (
                <div className="flex items-center gap-2 mt-3">
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View Product
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <div className="rounded border border-amber-300/50 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 mt-2">
                  Product URL unavailable on record. You can still verify or override with a direct URL.
                </div>
              )}
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm font-semibold mb-2">Why this match was chosen</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {reasonBullets.slice(0, 4).map((reason, idx) => (
                    <li key={`${reason}-${idx}`}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm font-semibold mb-2">Attribute comparison</p>
                <div className="space-y-2">
                  {compareRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[100px_1fr_1fr_auto] gap-2 items-start text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="line-clamp-2">{row.left}</span>
                      <span className="line-clamp-2">{row.right}</span>
                      <span className="mt-0.5">
                        {row.ok === true ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : row.ok === false ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <InfoTooltip text={row.note || 'No direct comparison signal available'} />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {item.matchReasons?.alternatives && item.matchReasons.alternatives.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-semibold mb-2">Other candidates</p>
                  <div className="space-y-2">
                    {item.matchReasons.alternatives.slice(0, 3).map((alt: any, idx: number) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium capitalize">{alt.retailer}</span> - ${alt.price?.toFixed(2)} (
                        {alt.confidence ? (alt.confidence * 100).toFixed(0) : 'N/A'}% confidence)
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {historyRows.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-semibold mb-2">Match history</p>
                  <ul className="space-y-1 text-sm">
                    {historyRows.map((row, idx) => (
                      <li key={`${row.label}-${idx}`} className="flex items-center justify-between gap-3">
                        <span>{row.label}</span>
                        {row.when ? <span className="text-xs text-muted-foreground">{row.when}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : isTrulyUnmatched ? (
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No match found</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Active provider search returned no product results for this query. Run Rematch again after edits, or use Override to set the exact product URL now.
            </p>
          </div>
        ) : null}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {showOverrideForm ? (
          <div className="border rounded-lg p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Override Match - Product Information:</p>
              <p className="text-xs text-muted-foreground mb-4">
                Enter the matched product details below. Compare with your item details above to ensure accuracy.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Provider <span className="text-red-500">*</span>:
                </label>
                <select
                  value={overrideProvider}
                  onChange={(e) => setOverrideProvider(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="amazon">Amazon</option>
                  <option value="homedepot">Home Depot</option>
                  <option value="officedepot">Office Depot</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Product Price:</label>
                <input
                  type="number"
                  step="0.01"
                  value={overridePrice}
                  onChange={(e) => setOverridePrice(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                />
                {(item.baselineUnitPrice ?? item.baselinePrice) != null && overridePrice && (
                  <p className="text-xs mt-1 text-muted-foreground">
                    Your baseline: ${(item.baselineUnitPrice ?? item.baselinePrice ?? 0).toFixed(2)} |
                    {parseFloat(overridePrice) < (item.baselineUnitPrice ?? item.baselinePrice ?? 0) ? (
                      <span className="text-green-600">
                        {' '}
                        Save $
                        {((item.baselineUnitPrice ?? item.baselinePrice ?? 0) - parseFloat(overridePrice)).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-red-600">
                        {' '}
                        +${(parseFloat(overridePrice) - (item.baselineUnitPrice ?? item.baselinePrice ?? 0)).toFixed(2)}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Product URL <span className="text-red-500">*</span>:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={overrideUrl}
                  onChange={(e) => setOverrideUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://..."
                />
                {overrideUrl && overrideUrl.startsWith('http') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setFetchingProductDetails(true);
                      window.open(overrideUrl, '_blank');
                      setTimeout(() => setFetchingProductDetails(false), 1000);
                    }}
                    disabled={fetchingProductDetails}
                  >
                    {fetchingProductDetails ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Product Title:</label>
              <input
                type="text"
                value={overrideTitle}
                onChange={(e) => setOverrideTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Product name from retailer"
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="update-item-name"
                  checked={updateItemName}
                  onChange={(e) => setUpdateItemName(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="update-item-name" className="text-xs text-muted-foreground cursor-pointer">
                  Also update item name to match product title
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Product UPC:</label>
              <input
                type="text"
                value={overrideUpc}
                onChange={(e) => setOverrideUpc(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                placeholder="UPC"
              />
              {item.upc && overrideUpc && (
                <p className={`text-xs mt-1 ${item.upc === overrideUpc ? 'text-green-600' : 'text-yellow-600'}`}>
                  {item.upc === overrideUpc ? '✓ Matches your UPC' : '⚠ Different from your UPC'}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Notes:</label>
              <textarea
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Additional notes about this match..."
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleOverride}
                disabled={isBusy || !overrideUrl.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {loadingAction === 'override' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save Override
                  </>
                )}
              </Button>
              <Button onClick={() => setShowOverrideForm(false)} disabled={isBusy} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 pt-4">
            {canVerify && (
              <Button onClick={handleVerify} disabled={isBusy} className="flex-1 bg-green-600 hover:bg-green-700">
                {loadingAction === 'verify' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Verify Current Match
                  </>
                )}
              </Button>
            )}
            <Button onClick={() => setShowOverrideForm(true)} disabled={isBusy} variant="outline" className="flex-1">
              Override Match
            </Button>
            <Button onClick={handleRematch} disabled={isBusy} variant="outline" className="flex-1">
              {loadingAction === 'rematch' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Matching...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rematch Now
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
