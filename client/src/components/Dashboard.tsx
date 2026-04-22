import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Package, Bell, AlertCircle, ExternalLink, TrendingUp, DollarSign, ArrowUpRight, AlertTriangle, Info, CheckCircle2, Edit2, Plus, Trash2, Shield, Lock, Pause, Play, Flame, X, BookOpen, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ThemeToggle } from './theme-toggle';
import { LoadingState } from './ui/spinner';
import { EmptyState } from './ui/empty-state';
import { Tooltip } from './ui/tooltip';
import { Modal } from './ui/modal';
import { DropdownMenu, DropdownMenuItem } from './ui/dropdown-menu';
import { apiUrl, apiFetch } from '../utils/api';
import { useSubscription } from '../context/SubscriptionContext';
import { UpgradeBanner } from './UpgradeBanner';
import { UpgradeButton } from './UpgradeButton';
import { AccountButton } from './AccountModal';
import { useGuide } from '../context/GuideContext';
import { ItemMatchEditor } from './ItemMatchEditor';
import { WalkthroughProvider, resetWalkthroughForTesting, useWalkthrough, setSimulateQuickBooksConnected, getSimulateQuickBooksConnected } from '../context/WalkthroughContext';
import { WalkthroughChecklist, WalkthroughHighlight, WalkthroughStepCard } from './walkthrough';
import { InfoTooltip } from './InfoTooltip';
import appConfig from '../../../config/app.json';
import {
  computeMatchQuality,
  getNoPriceCheckStreak,
  hasConcreteMatchEvidence,
  isHighRiskForSaveNudge,
  qualityLevelBadgeClass,
  type MatchQualityContext,
} from '../utils/itemMatchQuality';
import {
  needsClarificationAttention,
  needsMatchReviewAttention,
} from '../utils/itemAttention';

const PRODUCT_BRAND_TOOLTIP =
  'Product or manufacturer brand (what is on the package). This is not the same as vendor — vendor is who you pay.';

type DealState = 'deal' | 'no_deal' | 'no_price' | 'no_baseline';

interface Item {
  id: number;
  name: string;
  category: string | null;
  baselinePrice: number; // Stable price for savings calculations
  baselineUnitPrice?: number | null;
  bestDealUnitPrice?: number | null;
  lastPaidPrice: number; // Most recent purchase price (for display)
  upc: string | null;
  vendorName?: string | null;
  productBrand?: string | null;
  amazonSearchHint?: string | null;
  createdAt: string;
  prices?: Price[];
  matchConfidence: number | null;
  isVagueName: boolean;
  needsClarification: boolean;
  matchedRetailer: string | null;
  matchedUrl?: string | null;
  matchedPrice: number | null;
  isMonitored?: boolean;
  priorityScore?: number;
  isPaused?: boolean;
  matchStatus?: string; // unmatched | auto_matched | needs_review | verified | overridden
  isManuallyMatched?: boolean;
  matchProvider?: string | null;
  matchUrl?: string | null;
  matchTitle?: string | null;
  matchReasons?: any;
  manualMatchProvider?: string | null;
  manualMatchUrl?: string | null;
  manualMatchTitle?: string | null;
  lastMatchedAt?: string | null;
  dealState?: DealState;
  bestPriceToday?: number | null;
  savingsAmount?: number | null;
  savingsPct?: number | null;
}

interface Price {
  id: number;
  retailer: string;
  price: number;
  date: string;
}

interface Alert {
  id: number;
  itemId: number;
  retailer: string;
  newPrice: number;
  oldPrice: number;
  url: string | null;
  savingsPerOrder: number;
  estimatedMonthlySavings: number;
  alertDate: string;
  dropPercent?: number; // Added for percentage calculation
  item: {
    name: string;
  };
}

/** Alert row after computing drop % and tracking flags for the table. */
type AlertWithTracking = Alert & {
  dropPercent: number;
  isCurrentlyTracked: boolean;
  isActive: boolean;
};

type SaveNudgeState =
  | null
  | { kind: 'missing_brand'; form: 'add' | 'edit' }
  | { kind: 'low_quality'; form: 'add' | 'edit' };

/** Primary bucket for Tracked Items sidebar: matched / deal first, then no deal, then no price. */
function trackedItemPrimarySortRank(item: Item): number {
  const hasProductMatch =
    hasConcreteMatchEvidence({
      itemName: item.name,
      matchProvider: item.matchProvider,
      matchedRetailer: item.matchedRetailer,
      matchUrl: item.matchUrl,
      matchedUrl: item.matchedUrl,
      matchTitle: item.matchTitle,
      manualMatchTitle: item.manualMatchTitle,
      matchedPrice: item.matchedPrice,
      matchConfidence: item.matchConfidence,
    }) ||
    ['auto_matched', 'needs_review', 'verified', 'overridden'].includes(item.matchStatus || '');
  if (hasProductMatch || item.dealState === 'deal') return 0;
  if (item.dealState === 'no_deal') return 1;
  if (item.dealState === 'no_price') return 2;
  return 3;
}

/** Within the same primary bucket, order by today’s deal signal (deal → no deal → no price). */
function trackedItemDealStateSecondary(item: Item): number {
  const ds = item.dealState;
  if (ds === 'deal') return 0;
  if (ds === 'no_deal') return 1;
  if (ds === 'no_price') return 2;
  if (ds === 'no_baseline') return 4;
  return 3;
}

interface SavingsSummary {
  totalMonthlySavings: number;
  /** Monthly total from Alert rows only (subset of totalMonthlySavings). */
  fromAlertsMonthly?: number;
  /** Legacy; server returns 0 / [] — savings are folded into alerts after reconcile. */
  trackedDealsSupplementMonthly?: number;
  trackedDealsWithoutAlert?: Array<{
    itemId: number;
    name: string;
    retailer: string;
    url: string | null;
    oldPrice: number;
    newPrice: number;
    savingsPerOrder: number;
    estimatedMonthlySavings: number;
  }>;
  totalItemsMonitored: number;
  alertsThisMonth: number;
  metricsWindow?: string;
  metricsWindowDays?: number;
  metricsWindowLabel?: string;
  topSavingsItem: {
    name: string;
    savingsPerOrder: number;
    estimatedMonthlySavings: number;
    retailer: string;
    url: string | null;
  } | null;
  estimatedAnnualSavings: number;
}

/** Percent label for % OFF badges — one decimal under 10% (e.g. 3.4%) so small deals stay readable. */
function formatDropPercentOffLabel(dropPercent: number): string {
  if (!Number.isFinite(dropPercent) || dropPercent <= 0) return '0';
  if (dropPercent < 10) return dropPercent.toFixed(1);
  return dropPercent.toFixed(0);
}

/**
 * Consistent % drop for badges: prefer old vs new, then optional API `dropPercent`,
 * then implied baseline from savings (old ≈ new + savings per order).
 */
function computeAlertDropPercent(alert: {
  oldPrice: number;
  newPrice: number;
  savingsPerOrder: number;
  dropPercent?: number;
}): number {
  if (alert.oldPrice > 0) {
    const p = ((alert.oldPrice - alert.newPrice) / alert.oldPrice) * 100;
    if (Number.isFinite(p) && p >= 0) return p;
  }
  if (alert.dropPercent != null && Number.isFinite(alert.dropPercent) && alert.dropPercent > 0) {
    return alert.dropPercent;
  }
  const impliedOld = alert.newPrice + alert.savingsPerOrder;
  if (impliedOld > 0 && alert.savingsPerOrder > 0) {
    const p = (alert.savingsPerOrder / impliedOld) * 100;
    if (Number.isFinite(p) && p > 0) return p;
  }
  return 0;
}

/** Next button for walkthrough step 0 (Connect QB); only visible when walkthrough is path 1 step 0 */
function WalkthroughNextButton() {
  const wt = useWalkthrough();
  if (!wt || wt.path !== 1 || wt.currentStep !== 0) return null;
  return (
    <Button onClick={wt.nextStep} size="sm" variant="secondary">
      Next
    </Button>
  );
}

/** Hide upgrade banner during first-time walkthrough so the story is "connect QuickBooks" not "upgrade". */
function UpgradeBannerWhenNotWalkthrough() {
  const ctx = useWalkthrough();
  if (ctx && ctx.path != null && !ctx.walkthroughDone) return null;
  return <UpgradeBanner />;
}

/** Show QB CTA card only when it's the current step (path 1 step 0); hide when path 1 step 1 so only one card shows at a time. */
function ShowQuickBooksCTAWhen({ isQuickBooksConnected, children }: { isQuickBooksConnected: boolean; children: React.ReactNode }) {
  if (isQuickBooksConnected) return null;
  const ctx = useWalkthrough();
  if (ctx && ctx.path === 1 && ctx.currentStep > 0) return null;
  return <>{children}</>;
}

export function Dashboard() {
  const { isSubscribed, loading: subscriptionLoading } = useSubscription();
  const guide = useGuide();
  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('overview'); // Overview now shows Savings content
  const [savingsSummary, setSavingsSummary] = useState<SavingsSummary | null>(null);
  const [savingsLoading, setSavingsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'month' | 'quarter' | 'year' | 'all'>('all');
  /** Filter Tracked Items sidebar to items needing clarification or match review. */
  const [attentionFilter, setAttentionFilter] = useState<'all' | 'clarification' | 'match_review'>('all');

  // Editing state for tracked items
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editProductBrand, setEditProductBrand] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Add item modal state
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Match editor state
  const [matchEditorItem, setMatchEditorItem] = useState<Item | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemBrand, setNewItemBrand] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemVendor, setNewItemVendor] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [saveNudge, setSaveNudge] = useState<SaveNudgeState>(null);
  const [brandReinforcement, setBrandReinforcement] = useState<'add' | 'edit' | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [, setQbConnectedAt] = useState<Date | null>(null);
  const [isQuickBooksConnected, setIsQuickBooksConnected] = useState<boolean>(false);
  /** Company data from QB status (for savings blurb dismiss key). */
  const [qbCompanyId, setQbCompanyId] = useState<number | null>(null);
  const [qbRealmId, setQbRealmId] = useState<string | null>(null);
  const [qbLastImportedItemCount, setQbLastImportedItemCount] = useState<number | null>(null);
  /** One-time "How savings works" blurb: show after first import until dismissed (localStorage). */
  const [savingsBlurbDismissed, setSavingsBlurbDismissed] = useState(false);
  /** When testing: treat as connected so Path 2 walkthrough and "connected" UI show without real QB. */
  const effectiveIsQuickBooksConnected = isQuickBooksConnected || getSimulateQuickBooksConnected();
  const showSavingsBlurb =
    effectiveIsQuickBooksConnected &&
    qbLastImportedItemCount != null &&
    qbLastImportedItemCount > 0 &&
    !savingsBlurbDismissed;

  const addBrandInputRef = useRef<HTMLInputElement>(null);
  const editBrandInputRef = useRef<HTMLInputElement>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const prevAddBrandRef = useRef('');
  const prevEditBrandRef = useRef('');

  const editingSourceItem = useMemo(
    () => (editingId != null ? items.find((i) => i.id === editingId) : undefined),
    [editingId, items]
  );

  const trackedItemsDisplayOrder = useMemo(() => {
    return [...items].sort((a, b) => {
      const pa = trackedItemPrimarySortRank(a);
      const pb = trackedItemPrimarySortRank(b);
      if (pa !== pb) return pa - pb;
      const sa = trackedItemDealStateSecondary(a);
      const sb = trackedItemDealStateSecondary(b);
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [items]);

  const attentionCounts = useMemo(() => {
    let clarification = 0;
    let matchReview = 0;
    for (const item of items) {
      if (needsClarificationAttention(item)) clarification += 1;
      else if (needsMatchReviewAttention(item)) matchReview += 1;
    }
    return { clarification, matchReview };
  }, [items]);

  const trackedItemsFiltered = useMemo(() => {
    if (attentionFilter === 'all') return trackedItemsDisplayOrder;
    if (attentionFilter === 'clarification') {
      return trackedItemsDisplayOrder.filter((item) => needsClarificationAttention(item));
    }
    return trackedItemsDisplayOrder.filter((item) => needsMatchReviewAttention(item));
  }, [trackedItemsDisplayOrder, attentionFilter]);

  const addMatchCtx: MatchQualityContext = useMemo(
    () => ({
      name: newItemName,
      productBrand: newItemBrand,
      vendorName: newItemVendor,
    }),
    [newItemName, newItemBrand, newItemVendor]
  );

  const editMatchCtx: MatchQualityContext = useMemo(
    () => ({
      name: editName,
      productBrand: editProductBrand,
      vendorName: editVendor,
      amazonSearchHint: editingSourceItem?.amazonSearchHint ?? undefined,
      needsClarification: editingSourceItem?.needsClarification,
      isVagueName: editingSourceItem?.isVagueName,
      matchStatus: editingSourceItem?.matchStatus ?? null,
      matchConfidence: editingSourceItem?.matchConfidence ?? null,
      noPriceCheckStreak: editingSourceItem ? getNoPriceCheckStreak(editingSourceItem.id) : 0,
    }),
    [editName, editProductBrand, editVendor, editingSourceItem]
  );

  useEffect(() => {
    if (!showAddModal) {
      prevAddBrandRef.current = '';
      return;
    }
    const cur = newItemBrand.trim();
    const prev = prevAddBrandRef.current.trim();
    if (!prev && cur) {
      setBrandReinforcement('add');
      const t = setTimeout(() => setBrandReinforcement((v) => (v === 'add' ? null : v)), 4500);
      prevAddBrandRef.current = newItemBrand;
      return () => clearTimeout(t);
    }
    prevAddBrandRef.current = newItemBrand;
  }, [newItemBrand, showAddModal]);

  useEffect(() => {
    if (editingId == null) {
      prevEditBrandRef.current = '';
      return;
    }
    const cur = editProductBrand.trim();
    const prev = prevEditBrandRef.current.trim();
    if (!prev && cur) {
      setBrandReinforcement('edit');
      const t = setTimeout(() => setBrandReinforcement((v) => (v === 'edit' ? null : v)), 4500);
      prevEditBrandRef.current = editProductBrand;
      return () => clearTimeout(t);
    }
    prevEditBrandRef.current = editProductBrand;
  }, [editProductBrand, editingId]);

  const fetchQuickBooksStatus = async () => {
    try {
      const res = await apiFetch(apiUrl('/api/qb/status'));
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsQuickBooksConnected(data.isQuickBooksConnected || false);
          setQbCompanyId(data.companyId ?? null);
          setQbRealmId(data.realmId ?? null);
          setQbLastImportedItemCount(data.lastImportedItemCount ?? null);
          const dismissKey = 'procuro:savings_blurb_dismissed:' + (data.companyId ?? data.realmId ?? 'unknown');
          setSavingsBlurbDismissed(localStorage.getItem(dismissKey) === 'true');
        }
      }
    } catch (error) {
      console.error('Error fetching QuickBooks status:', error);
      setIsQuickBooksConnected(false);
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      // Check if onboarding was dismissed
      const dismissed = localStorage.getItem('procuro-onboarding-dismissed');
      if (dismissed === 'true') {
        setShowOnboarding(false);
        return;
      }

      // Check QuickBooks connection status
      const res = await apiFetch(apiUrl('/api/qb/status'));
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.isQuickBooksConnected && data.connectedAt) {
          const connectedDate = new Date(data.connectedAt);
          const now = new Date();
          const hoursSinceConnection = (now.getTime() - connectedDate.getTime()) / (1000 * 60 * 60);
          
          // Show for 48 hours after connection
          if (hoursSinceConnection < 48) {
            setShowOnboarding(true);
            setQbConnectedAt(connectedDate);
          }
        }
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  };

  const handleDismissOnboarding = () => {
    localStorage.setItem('procuro-onboarding-dismissed', 'true');
    setShowOnboarding(false);
  };

  const handleDismissSavingsBlurb = () => {
    const key = 'procuro:savings_blurb_dismissed:' + (qbCompanyId ?? qbRealmId ?? 'unknown');
    localStorage.setItem(key, 'true');
    setSavingsBlurbDismissed(true);
  };

  const fetchData = async () => {
    try {
      const simulate = getSimulateQuickBooksConnected();
      const itemsPath = simulate ? '/api/simulate/items' : '/api/items';
      const alertsPath = simulate ? '/api/simulate/alerts' : '/api/alerts';
      const [itemsRes, alertsRes] = await Promise.all([
        apiFetch(apiUrl(itemsPath)),
        apiFetch(apiUrl(alertsPath)),
      ]);

      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        setItems(itemsData.items || []);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const path = getSimulateQuickBooksConnected() ? '/api/simulate/alerts/unreadCount' : '/api/alerts/unreadCount';
      const res = await apiFetch(apiUrl(path));
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchSavingsSummary = async () => {
    try {
      const path = getSimulateQuickBooksConnected() ? '/api/simulate/savings-summary' : '/api/savings-summary';
      const res = await apiFetch(apiUrl(path));
      if (res.ok) {
        const data = await res.json();
        setSavingsSummary(data);
      }
    } catch (error) {
      console.error('Error fetching savings summary:', error);
    } finally {
      setSavingsLoading(false);
    }
  };

  /** Items, alerts, unread count, and savings-summary cards — keep in sync after actions or when returning to the tab. */
  const refreshDashboardMetrics = async () => {
    await fetchSavingsSummary();
    await Promise.all([fetchData(), fetchUnreadCount()]);
  };

  const refreshDashboardMetricsRef = useRef(refreshDashboardMetrics);
  refreshDashboardMetricsRef.current = refreshDashboardMetrics;

  useEffect(() => {
    void refreshDashboardMetrics();
    checkOnboardingStatus();
    fetchQuickBooksStatus();
  }, []);

  useEffect(() => {
    const onBecameVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshDashboardMetricsRef.current();
      }
    };
    document.addEventListener('visibilitychange', onBecameVisible);
    return () => document.removeEventListener('visibilitychange', onBecameVisible);
  }, []);

  /** When switching back to Overview from Alerts/Tracked, reload summary cards without a full page refresh. */
  const skipOverviewTabRefetch = useRef(true);
  useEffect(() => {
    if (activeTab !== 'overview') return;
    if (skipOverviewTabRefetch.current) {
      skipOverviewTabRefetch.current = false;
      return;
    }
    void refreshDashboardMetricsRef.current();
  }, [activeTab]);

  const handleBellClick = async () => {
    // Switch to alerts tab
    setActiveTab('alerts');

    // Mark all as seen
    try {
      const res = await apiFetch(apiUrl('/api/alerts/markAllSeen'), {
        method: 'POST',
      });
      if (res.ok) {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking alerts as seen:', error);
    }
  };

  const startEditing = (item: Item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditProductBrand(item.productBrand || '');
    setEditPrice(item.lastPaidPrice.toString());
    setEditCategory(item.category || '');
    setEditVendor(item.vendorName || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setSaveNudge(null);
    setEditName('');
    setEditProductBrand('');
    setEditPrice('');
    setEditCategory('');
    setEditVendor('');
  };

  const performSaveItem = async (itemId: number) => {
    const price = parseFloat(editPrice);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(apiUrl(`/api/items/${itemId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          productBrand: editProductBrand.trim(),
          lastPaidPrice: price,
          category: editCategory.trim() || undefined,
          vendorName: editVendor.trim() || undefined,
        }),
      });

      if (res.ok) {
        await refreshDashboardMetrics();
        cancelEditing();
        setSaveNudge(null);

        const itemCard = document.querySelector(`[data-item-id="${itemId}"]`);
        if (itemCard) {
          itemCard.classList.add('bg-green-50', 'dark:bg-green-900/20');
          setTimeout(() => {
            itemCard.classList.remove('bg-green-50', 'dark:bg-green-900/20');
          }, 2000);
        }
      } else {
        const error = await res.json();
        alert(`Failed to update item: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const requestSaveItem = (itemId: number) => {
    if (!editName || editName.trim() === '') {
      alert('Item name cannot be empty');
      return;
    }

    const price = parseFloat(editPrice);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    if (!editProductBrand || editProductBrand.trim() === '') {
      setSaveNudge({ kind: 'missing_brand', form: 'edit' });
      return;
    }

    if (isHighRiskForSaveNudge(editMatchCtx)) {
      setSaveNudge({ kind: 'low_quality', form: 'edit' });
      return;
    }

    void performSaveItem(itemId);
  };

  const performAddItem = async () => {
    const price = parseFloat(newItemPrice);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    setAddingItem(true);
    try {
      const res = await apiFetch(apiUrl('/api/items'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productBrand: newItemBrand.trim(),
          name: newItemName.trim(),
          lastPaidPrice: price,
          category: newItemCategory.trim() || undefined,
          vendorName: newItemVendor.trim() || undefined,
        }),
      });

      if (res.ok) {
        await refreshDashboardMetrics();
        setShowAddModal(false);
        setSaveNudge(null);
        setNewItemBrand('');
        setNewItemName('');
        setNewItemPrice('');
        setNewItemCategory('');
        setNewItemVendor('');
      } else {
        const error = await res.json();
        alert(`Failed to add item: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    } finally {
      setAddingItem(false);
    }
  };

  const requestAddItem = () => {
    if (!newItemName.trim() || !newItemPrice) {
      alert('Item name and price are required');
      return;
    }

    const price = parseFloat(newItemPrice);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    if (!newItemBrand.trim()) {
      setSaveNudge({ kind: 'missing_brand', form: 'add' });
      return;
    }

    if (isHighRiskForSaveNudge(addMatchCtx)) {
      setSaveNudge({ kind: 'low_quality', form: 'add' });
      return;
    }

    void performAddItem();
  };

  const deleteItem = async (itemId: number, itemName: string) => {
    if (!confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await apiFetch(apiUrl(`/api/items/${itemId}`), {
        method: 'DELETE',
      });

      if (res.ok) {
        await refreshDashboardMetrics();
      } else {
        const error = await res.json();
        alert(`Failed to delete item: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handlePause = async (id: number) => {
    try {
      const res = await apiFetch(apiUrl(`/api/items/${id}/pause`), {
        method: 'POST',
      });

      if (res.ok) {
        await refreshDashboardMetrics();
      } else {
        const error = await res.json();
        alert(`Failed to pause monitoring: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error pausing item:', error);
      alert('Failed to pause monitoring');
    }
  };

  const handleResume = async (id: number) => {
    try {
      const res = await apiFetch(apiUrl(`/api/items/${id}/resume`), {
        method: 'POST',
      });

      if (res.ok) {
        await refreshDashboardMetrics();
      } else {
        const error = await res.json();
        // Show detailed error message if item needs clarification
        if (error.reason === 'Item name is too vague and needs clarification') {
          alert(`❌ Cannot Resume Monitoring\n\n${error.message || error.error}\n\nPlease edit the item name to add more specific details (brand, size, model, specifications) before enabling monitoring.`);
        } else {
          alert(`Failed to resume monitoring: ${error.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error resuming item:', error);
      alert('Failed to resume monitoring');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  // Filter alerts by time period
  const filterAlertsByPeriod = (alerts: AlertWithTracking[], period: 'month' | 'quarter' | 'year' | 'all'): AlertWithTracking[] => {
    if (period === 'all') return alerts;
    
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (period) {
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return alerts.filter(alert => {
      const alertDate = new Date(alert.alertDate);
      return alertDate >= cutoffDate;
    });
  };

  // Calculate totals for filtered alerts
  const calculateHistoricalTotals = (filteredAlerts: Alert[]) => {
    const totalSavings = filteredAlerts.reduce((sum, alert) => sum + alert.savingsPerOrder, 0);
    const totalMonthlySavings = filteredAlerts.reduce((sum, alert) => sum + alert.estimatedMonthlySavings, 0);
    const alertCount = filteredAlerts.length;
    
    return { totalSavings, totalMonthlySavings, alertCount };
  };

  // Calculate drop percentage for each alert and sort by percentage (largest first)
  // Create a set of currently tracked item IDs for reference
  const trackedItemIds = new Set(items.map(item => item.id));
  
  // Show ALL alerts (including for items no longer tracked) to preserve historical savings data
  // This ensures users don't lose visibility into past savings when they stop tracking an item
  const alertsWithPercentage: AlertWithTracking[] = alerts.map((alert) => {
    const dropPercent = computeAlertDropPercent({
      oldPrice: alert.oldPrice,
      newPrice: alert.newPrice,
      savingsPerOrder: alert.savingsPerOrder,
      dropPercent: alert.dropPercent,
    });
    // Mark if the item is currently tracked
    const isCurrentlyTracked = trackedItemIds.has(alert.itemId);
    const item = items.find((i) => i.id === alert.itemId);
    const isActive = Boolean(
      item && (!item.needsClarification || (item.isManuallyMatched && item.matchStatus === 'overridden'))
    );
    return { ...alert, dropPercent, isCurrentlyTracked, isActive };
  });

  // Sort alerts by drop percentage (largest first)
  const sortedAlerts = [...alertsWithPercentage].sort((a, b) => b.dropPercent - a.dropPercent);

  /** Overview cards: same persisted alerts as the Alerts tab (sorted by drop %). */
  const overviewActiveDeals: AlertWithTracking[] = useMemo(() => sortedAlerts, [sortedAlerts]);

  const filteredAlerts = filterAlertsByPeriod(sortedAlerts, timePeriod);
  const historicalTotals = calculateHistoricalTotals(filteredAlerts);

  const addQuality = computeMatchQuality(addMatchCtx);
  const editQuality = computeMatchQuality(editMatchCtx);

  return (
    <div className="min-h-full bg-background">
      <WalkthroughProvider
        isQuickBooksConnected={effectiveIsQuickBooksConnected}
        itemsCount={items.length}
        hasViewedAlerts={activeTab === 'alerts'}
      >
      {/* Top Bar */}
      <header className="sticky top-0 z-[100] w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center px-4">
          <div className="mr-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2D8CFF] rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">P</span>
            </div>
            <div>
              <span className="text-xl font-bold text-foreground">Procura</span>
              <p className="text-xs text-muted-foreground -mt-1">Automated savings for your business</p>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <span className="text-sm text-muted-foreground">Price Monitoring Dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Upgrade Button for Non-Subscribers */}
              {!subscriptionLoading && !isSubscribed && (
                <Tooltip content="Upgrade to unlock automated monitoring">
                  <span className="inline-flex">
                    <UpgradeButton />
                  </span>
                </Tooltip>
              )}
              {/* User Guide */}
              {guide && (
                <Tooltip content="User guide — icons and how to use Procuro">
                  <button
                    type="button"
                    onClick={guide.openGuide}
                    className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                    aria-label="User guide"
                  >
                    <BookOpen className="h-5 w-5" />
                  </button>
                </Tooltip>
              )}
              {/* Notification Bell */}
              <Tooltip content={unreadCount > 0 ? `View alerts (${unreadCount} unread)` : 'View alerts'}>
                <button
                  onClick={handleBellClick}
                  className="relative inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                  aria-label="View alerts"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </Tooltip>
              <Tooltip content="Toggle light/dark theme">
                <span className="inline-flex">
                  <ThemeToggle />
                </span>
              </Tooltip>
              <Tooltip content="Account & Integrations">
                <span className="inline-flex">
                  <AccountButton />
                </span>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="container mx-auto p-4 md:p-6 relative z-0">
        {/* Upgrade Banner for Non-Subscribers (hidden during first-time walkthrough) */}
        {!subscriptionLoading && !isSubscribed && (
          <UpgradeBannerWhenNotWalkthrough />
        )}

        {/* Subscription Status Badge */}
        {!subscriptionLoading && (
          <div className="mb-4 flex items-center justify-end">
            <Badge variant={isSubscribed ? "default" : "secondary"} className={isSubscribed ? "bg-green-600" : ""}>
              {isSubscribed ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active Subscription
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 mr-1" />
                  Free Plan
                </>
              )}
            </Badge>
          </div>
        )}

        {/* First-time walkthrough: checklist + coach marks (show once) */}
        <WalkthroughChecklist
          isQuickBooksConnected={effectiveIsQuickBooksConnected}
          itemsCount={items.length}
          hasViewedAlerts={activeTab === 'alerts'}
        />

        {/* QuickBooks CTA Banner - One card at a time: only show when path 1 step 0 (or not in path 1) */}
        <ShowQuickBooksCTAWhen isQuickBooksConnected={effectiveIsQuickBooksConnected}>
          <WalkthroughHighlight path={1} stepIndex={0}>
            <Card className="mb-6 border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">Connect QuickBooks to Get Started</h3>
                    <p className="text-sm text-muted-foreground">
                      Procuro imports your purchase history to automatically monitor prices and alert you when costs drop.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild>
                      <a href={apiUrl('/api/qb/connect')}>Connect QuickBooks</a>
                    </Button>
                    <WalkthroughNextButton />
                  </div>
                </div>
              </CardContent>
            </Card>
          </WalkthroughHighlight>
        </ShowQuickBooksCTAWhen>

        {/* Path 1 step 1: Add items manually — Next steps through */}
        <WalkthroughStepCard
          path={1}
          stepIndex={1}
          title="Add items manually"
          description="Use the + button in the Tracked Items section below to add items without QuickBooks."
        />

        {/* Path 2 step 0: Where to look — highlights left and right panels below */}
        <WalkthroughStepCard
          path={2}
          stepIndex={0}
          title="Where to find everything"
          description="Your items appear in the list on the left. Savings and price-drop alerts appear in the panel on the right."
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Sidebar - Tracked Items (highlighted at path 1 step 1 and path 2 step 0) */}
          <div className="lg:col-span-3">
            <WalkthroughHighlight
              path={[1, 2]}
              stepIndex={[{ path: 1, stepIndex: 1 }, { path: 2, stepIndex: 0 }]}
            >
            {(attentionCounts.clarification > 0 ||
              attentionCounts.matchReview > 0 ||
              attentionFilter !== 'all') && (
              <div
                className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm"
                role="region"
                aria-label="Items needing attention"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Needs attention</span>
                  <Link
                    to={
                      attentionFilter === 'clarification'
                        ? '/items?attention=clarification'
                        : attentionFilter === 'match_review'
                          ? '/items?attention=match_review'
                          : '/items'
                    }
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    Open full list
                  </Link>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAttentionFilter((f) => (f === 'clarification' ? 'all' : 'clarification'))
                    }
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                      attentionFilter === 'clarification'
                        ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100'
                        : 'border-border bg-background hover:bg-accent/50'
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                    <span>
                      Clarification <span className="font-semibold tabular-nums">({attentionCounts.clarification})</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAttentionFilter((f) => (f === 'match_review' ? 'all' : 'match_review'))
                    }
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                      attentionFilter === 'match_review'
                        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                        : 'border-border bg-background hover:bg-accent/50'
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    <span>
                      Match review <span className="font-semibold tabular-nums">({attentionCounts.matchReview})</span>
                    </span>
                  </button>
                  {attentionFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setAttentionFilter('all')}
                      className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent/50"
                    >
                      Show all
                    </button>
                  )}
                </div>
              </div>
            )}
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Package className="h-5 w-5" />
                      Tracked Items
                    </CardTitle>
                    <CardDescription>
                      {isSubscribed 
                        ? `${items.filter(i => i.isMonitored).length} of ${appConfig.monitoring?.maxMonitoredItemsPerCompany || 50} items monitored`
                        : `${items.length} items tracked (subscription required for monitoring)`
                      }
                    </CardDescription>
                  </div>
                  <Tooltip content="Add a new item to track">
                    <Button
                      size="sm"
                      onClick={() => setShowAddModal(true)}
                      className="h-7 w-7 p-0"
                      variant="outline"
                      aria-label="Add Item"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <LoadingState text="Loading items..." />
                ) : items.length === 0 ? (
                  <div className="py-8">
                  <EmptyState
                    icon={Package}
                    title="No items yet"
                    description="Connect QuickBooks to see your items here."
                  />
                  </div>
                ) : trackedItemsFiltered.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No items in this filter.
                    <button
                      type="button"
                      onClick={() => setAttentionFilter('all')}
                      className="ml-1 text-primary underline"
                    >
                      Show all
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trackedItemsFiltered.map((item) => (
                      <div
                        key={item.id}
                        data-item-id={item.id}
                        className={`rounded-lg border p-3 hover:bg-accent/50 transition-all group ${item.isPaused ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className={`flex-1 ${item.isPaused ? "opacity-60" : ""}`}>
                            <div className="font-medium text-sm line-clamp-2">
                              {item.name}
                              {item.isPaused && (
                                <span className="text-xs text-gray-500 ml-2">(Paused)</span>
                              )}
                            </div>
                            {/* Show matched product title if different from item name */}
                            {item.matchTitle && item.matchTitle !== item.name && (
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                Matched: {item.matchTitle}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Status Indicators - Icons only, no badge wrapper */}
                              <div className={`flex items-center gap-1 ${item.isPaused ? "opacity-60" : ""}`}>
                                {item.isPaused ? (
                                  <Tooltip content="Monitoring paused — will not check prices">
                                    <Shield className="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" />
                                  </Tooltip>
                                ) : item.needsClarification && !(item.isManuallyMatched && item.matchStatus === 'overridden') ? (
                                  <Tooltip content="Cannot be monitored - Item name is too vague. Clarify the name to enable price tracking.">
                                    <Shield className="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" />
                                  </Tooltip>
                                ) : isSubscribed && item.isMonitored ? (
                                  <Tooltip content={`This item is actively monitored in daily price checks. Priority: ${(item.priorityScore || 0).toFixed(2)}`}>
                                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 cursor-help" />
                                  </Tooltip>
                                ) : !isSubscribed && item.isMonitored ? (
                                  <Tooltip content="Subscription required to enable monitoring">
                                    <Lock className="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" />
                                  </Tooltip>
                                ) : null}
                                {item.needsClarification && !(item.isManuallyMatched && item.matchStatus === 'overridden') && (
                                  <Tooltip content="Needs clarification — name is too vague to monitor. Edit the item (brand, size, pack) or add an Amazon search hint.">
                                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 cursor-help" />
                                  </Tooltip>
                                )}
                                {(item.matchStatus === 'needs_review' || item.matchStatus === 'unmatched') &&
                                  !item.needsClarification && (
                                    <Tooltip content="Needs match review — open Fix Match to verify or pick a product.">
                                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 cursor-help" />
                                    </Tooltip>
                                  )}
                                {(item.matchStatus === 'verified' || item.matchStatus === 'overridden') && (
                                  <Tooltip content="Match verified or overridden — use Fix Match to change.">
                                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 cursor-help" />
                                  </Tooltip>
                                )}
                                {item.matchStatus === 'auto_matched' &&
                                  !item.needsClarification &&
                                  (item.matchConfidence == null || item.matchConfidence >= 0.5) && (
                                    <Tooltip content="Auto-matched — confirm the product in Fix Match if unsure.">
                                      <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 cursor-help" />
                                    </Tooltip>
                                  )}
                                {item.isVagueName && !item.needsClarification && (
                                  <Tooltip content="Vague name — consider product brand or Amazon search hint for better discovery.">
                                    <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400 cursor-help" />
                                  </Tooltip>
                                )}
                                {item.matchConfidence !== null &&
                                  item.matchConfidence < 0.5 &&
                                  !item.needsClarification &&
                                  item.matchStatus !== 'verified' &&
                                  item.matchStatus !== 'overridden' && (
                                    <Tooltip
                                      content={`Low confidence (${(item.matchConfidence * 100).toFixed(0)}%) — verify in Fix Match or improve name / brand / hint.`}
                                    >
                                      <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 cursor-help" />
                                    </Tooltip>
                                  )}
                              </div>
                              {/* Three-dot menu - always at full opacity, even when item is paused */}
                              <div className={item.isPaused ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}>
                                <DropdownMenu>
                                  <DropdownMenuItem 
                                    key={`fix-match-${item.id}`}
                                    onClick={() => {
                                      setMatchEditorItem(item);
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Fix Match</span>
                                    </div>
                                  </DropdownMenuItem>
                                  {item.needsClarification ? (
                                    <DropdownMenuItem 
                                      disabled={true}
                                      title="Item name is too vague. Edit the name to add more specific details (brand, size, model, specifications) before resuming monitoring."
                                    >
                                      <div className="flex items-center gap-2">
                                        <Play className="h-3.5 w-3.5" />
                                        <span>Resume Monitoring</span>
                                      </div>
                                    </DropdownMenuItem>
                                  ) : item.isPaused ? (
                                    <DropdownMenuItem onClick={() => handleResume(item.id)}>
                                      <div className="flex items-center gap-2">
                                        <Play className="h-3.5 w-3.5" />
                                        <span>Resume Monitoring</span>
                                      </div>
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => handlePause(item.id)}>
                                      <div className="flex items-center gap-2">
                                        <Pause className="h-3.5 w-3.5" />
                                        <span>Pause Monitoring</span>
                                      </div>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => startEditing(item)}>
                                    <div className="flex items-center gap-2">
                                      <Edit2 className="h-3.5 w-3.5" />
                                      <span>Edit Item</span>
                                    </div>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => deleteItem(item.id, item.name)}
                                    variant="destructive"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span>Delete</span>
                                    </div>
                                  </DropdownMenuItem>
                                </DropdownMenu>
                              </div>
                          </div>
                        </div>
                        <div className={item.isPaused ? "opacity-60" : ""}>
                          {item.category && (
                            <Badge variant="secondary" className="mb-2 text-xs">
                              {item.category}
                            </Badge>
                          )}
                          <div className="text-lg font-bold text-primary">
                            {formatPrice(item.lastPaidPrice)}
                          </div>
                          {item.dealState === 'deal' && item.savingsAmount != null && item.savingsAmount > 0 && (
                            <p className="text-sm font-semibold text-green-600 dark:text-green-500 mt-1">
                              Save {formatPrice(item.savingsAmount)}
                              {item.savingsPct != null && item.savingsPct > 0 && (
                                <span className="text-muted-foreground font-normal ml-1">
                                  ({item.savingsPct.toFixed(0)}% off)
                                </span>
                              )}
                            </p>
                          )}
                          {item.dealState === 'no_deal' && (
                            <p className="text-sm text-muted-foreground mt-1">
                              No deal today — we&apos;ll keep watching
                            </p>
                          )}
                          {item.dealState === 'no_price' && (
                            <p className="text-sm text-muted-foreground mt-1">
                              No price available today
                            </p>
                          )}
                          {item.dealState === 'no_baseline' && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Baseline not set yet (import more history)
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            </WalkthroughHighlight>
          </div>

          {/* Main Panel - Tabs (walkthrough highlights this for path 2 step 0) */}
          <div className="lg:col-span-9">
            <WalkthroughHighlight path={2} stepIndex={0}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Dashboard
                </CardTitle>
                <CardDescription>
                  Monitor your tracked items and price alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="alerts">Alerts</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-4">
                    {/* One-time "How savings works" blurb (after first QB import, until dismissed) */}
                    {showSavingsBlurb && (
                      <Card className="border-primary/20 bg-muted/30">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-4">
                            <CardTitle className="text-base">How Procuro calculates savings</CardTitle>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleDismissSavingsBlurb}
                              className="shrink-0"
                            >
                              Got it
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                          <ul className="space-y-1.5 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="text-primary font-semibold">•</span>
                              <span>We set a baseline price from your QuickBooks purchase history (usually a higher recent price).</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary font-semibold">•</span>
                              <span>Each day we compare today&apos;s best available price to your baseline.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary font-semibold">•</span>
                              <span>If today&apos;s price is lower, you&apos;ll see potential savings and get alerts for meaningful drops.</span>
                            </li>
                          </ul>
                          <p className="text-xs text-muted-foreground italic">
                            No $0 savings: if there&apos;s no deal today, we&apos;ll just tell you we&apos;re still watching.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                    {/* Quick Start Onboarding Panel */}
                    {showOnboarding && (
                      <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">How Procuro Works</CardTitle>
                              <CardDescription>
                                Get started with automated price monitoring
                              </CardDescription>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleDismissOnboarding}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                              <span className="text-primary font-semibold">•</span>
                              <span>We import your purchase history automatically from QuickBooks</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary font-semibold">•</span>
                              <span>We identify your highest-impact items</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary font-semibold">•</span>
                              <span>We monitor the top {appConfig.monitoring?.maxMonitoredItemsPerCompany || 20} items daily</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary font-semibold">•</span>
                              <span>When prices drop, we alert you instantly</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary font-semibold">•</span>
                              <span>You can verify retailer matches or edit items anytime</span>
                            </li>
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                    
                    {savingsLoading ? (
                      <LoadingState text="Calculating savings..." />
                    ) : !savingsSummary ? (
                      <EmptyState
                        icon={DollarSign}
                        title="No savings data available"
                        description="Savings and alerts will appear here once you have items."
                      />
                    ) : (
                      <div className="space-y-6">
                        {/* Main Savings Card - Largest */}
                        <div className="rounded-lg border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10 p-8 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="rounded-full bg-primary/10 p-2">
                              <TrendingUp className="h-5 w-5 text-primary" />
                            </div>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Estimated Monthly Savings</h3>
                          </div>
                          <div className="text-6xl font-bold text-primary mb-3">
                            {formatPrice(savingsSummary.totalMonthlySavings)}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              <ArrowUpRight className="h-3 w-3" />
                              {savingsSummary.alertsThisMonth}{' '}
                              {savingsSummary.alertsThisMonth === 1 ? 'alert' : 'alerts'}
                            </span>
                            from {savingsSummary.metricsWindowLabel ?? 'Last 30 days'}
                          </p>
                        </div>

                        {/* Summary Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Annual Savings */}
                          <div className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="rounded-full bg-green-100 p-2">
                                <DollarSign className="h-4 w-4 text-green-600" />
                              </div>
                              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Annual Savings</h3>
                            </div>
                            <div className="text-3xl font-bold text-green-600">
                              {formatPrice(savingsSummary.estimatedAnnualSavings)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Projected yearly savings from {savingsSummary.metricsWindowLabel ?? 'Last 30 days'}
                            </p>
                          </div>

                          {/* Items Monitored */}
                          <div className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="rounded-full bg-blue-100 p-2">
                                <Package className="h-4 w-4 text-primary" />
                              </div>
                              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items Monitored</h3>
                            </div>
                            <div className="text-3xl font-bold text-primary">
                              {savingsSummary.totalItemsMonitored}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Active monitored items (pipeline)</p>
                          </div>

                          {/* Alerts This Month */}
                          <div className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="rounded-full bg-orange-100 p-2">
                                <Bell className="h-4 w-4 text-orange-600" />
                              </div>
                              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alerts Found</h3>
                            </div>
                            <div className="text-3xl font-bold text-orange-600">
                              {savingsSummary.alertsThisMonth}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {savingsSummary.metricsWindowLabel ?? 'Last 30 days'}
                            </p>
                          </div>
                        </div>

                        {/* All Active Alerts - Cards */}
                        {overviewActiveDeals.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Bell className="h-5 w-5 text-primary" />
                              <h3 className="text-lg font-semibold">Active Savings Opportunities</h3>
                            </div>
                            <p className="text-xs text-muted-foreground -mt-2">
                              Price alerts from the last 30 days (same list as the Alerts tab).
                            </p>
                            <div className="space-y-3">
                              {overviewActiveDeals.slice(0, 10).map((alert) => {
                                const dropPercent = computeAlertDropPercent({
                                  oldPrice: alert.oldPrice,
                                  newPrice: alert.newPrice,
                                  savingsPerOrder: alert.savingsPerOrder,
                                  dropPercent: alert.dropPercent,
                                });
                                const isLargeDrop = dropPercent >= 15;
                                const showPercentOffBadge =
                                  Number.isFinite(dropPercent) && dropPercent > 0;

                                // Calculate fill percentage: 15% = 0% fill, 40%+ = 100% fill
                                const minPercent = 15;
                                const maxPercent = 40;
                                const fillPercent = isLargeDrop
                                  ? Math.min(100, Math.max(0, ((dropPercent - minPercent) / (maxPercent - minPercent)) * 100))
                                  : 0;

                                return (
                                <div
                                  key={alert.id}
                                  className="flex items-start gap-4 rounded-lg border p-4 hover:bg-accent/50 transition-colors min-w-0"
                                >
                                  <div className="rounded-full p-2 relative bg-primary/10 flex-shrink-0">
                                    {isLargeDrop ? (
                                      <div className="relative h-4 w-4">
                                        <Flame className="absolute inset-0 h-4 w-4 text-orange-300 dark:text-orange-700" strokeWidth="1.5" />
                                        <Flame
                                          className="absolute inset-0 h-4 w-4 text-orange-600 dark:text-orange-400"
                                          fill="currentColor"
                                          style={{
                                            maskImage: `linear-gradient(0deg, black 0%, black ${fillPercent}%, transparent ${fillPercent}%, transparent 100%)`,
                                            WebkitMaskImage: `linear-gradient(0deg, black 0%, black ${fillPercent}%, transparent ${fillPercent}%, transparent 100%)`,
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <Bell className="h-4 w-4 text-primary" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0 mb-1.5">
                                      <p className="font-medium text-foreground flex-1 min-w-0 truncate" title={alert.item.name}>
                                        {alert.item.name}
                                      </p>
                                      {!alert.isCurrentlyTracked && (
                                        <Badge variant="outline" className="text-xs whitespace-nowrap flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                                          Not Tracked
                                        </Badge>
                                      )}
                                      {showPercentOffBadge && (
                                        <Badge className="bg-orange-600 hover:bg-orange-700 text-white text-xs whitespace-nowrap flex-shrink-0">
                                          {formatDropPercentOffLabel(dropPercent)}% OFF
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm flex flex-wrap items-baseline gap-x-1.5 gap-y-1 mb-1.5">
                                      <span className="text-muted-foreground">{alert.retailer}</span>
                                      <span className="text-muted-foreground">·</span>
                                      <span className="font-semibold text-green-600 dark:text-green-500">
                                        Save {formatPrice(alert.savingsPerOrder)}
                                      </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(alert.alertDate)}
                                    </p>
                                  </div>
                                  {alert.url && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      asChild
                                      className="flex-shrink-0"
                                    >
                                      <a
                                        href={alert.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2"
                                      >
                                        View Deal
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="alerts" className="space-y-4">
                    {loading ? (
                      <LoadingState text="Loading alerts..." />
                    ) : filteredAlerts.length === 0 ? (
                      <EmptyState
                        icon={Bell}
                        title="No alerts yet"
                        description="Price alerts will appear here when tracked items have better prices available. Procuro monitors prices across major retailers."
                      />
                    ) : (
                      <div className="space-y-4">
                        {/* Time Period Filter and Summary */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <label htmlFor="timePeriod" className="text-sm font-medium">
                              Time Period:
                            </label>
                            <select
                              id="timePeriod"
                              value={timePeriod}
                              onChange={(e) => setTimePeriod(e.target.value as 'month' | 'quarter' | 'year' | 'all')}
                              className="px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="all">All Time</option>
                              <option value="year">This Year</option>
                              <option value="quarter">Last 3 Months</option>
                              <option value="month">Last Month</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Total Savings: </span>
                              <span className="font-semibold text-green-600 dark:text-green-500">
                                {formatPrice(historicalTotals.totalSavings)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Alerts: </span>
                              <span className="font-semibold">{historicalTotals.alertCount}</span>
                            </div>
                          </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="rounded-lg border bg-card p-4">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              Total Savings
                            </div>
                            <div className="text-2xl font-bold text-green-600">
                              {formatPrice(historicalTotals.totalSavings)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {timePeriod === 'all' ? 'All time' : `Last ${timePeriod === 'month' ? 'month' : timePeriod === 'quarter' ? '3 months' : 'year'}`}
                            </div>
                          </div>
                          <div className="rounded-lg border bg-card p-4">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              Avg Savings Per Alert
                            </div>
                            <div className="text-2xl font-bold text-primary">
                              {historicalTotals.alertCount > 0 
                                ? formatPrice(historicalTotals.totalSavings / historicalTotals.alertCount)
                                : formatPrice(0)
                              }
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Average per alert
                            </div>
                          </div>
                          <div className="rounded-lg border bg-card p-4">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              Alerts Found
                            </div>
                            <div className="text-2xl font-bold text-orange-600">
                              {historicalTotals.alertCount}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              In selected period
                            </div>
                          </div>
                        </div>

                        {/* Historical Alerts Table */}
                        {filteredAlerts.length === 0 ? (
                          <EmptyState
                            icon={Bell}
                            title="No alerts in this period"
                            description={`No price alerts found for the selected time period. Try selecting a different period.`}
                          />
                        ) : (
                          <div className="rounded-md border overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-left">Date</TableHead>
                                  <TableHead className="text-left">Item Name</TableHead>
                                  <TableHead className="text-left">Retailer</TableHead>
                                  <TableHead className="text-left">Old Price</TableHead>
                                  <TableHead className="text-left">New Price</TableHead>
                                  <TableHead className="text-left">Savings</TableHead>
                                  <TableHead className="text-left">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredAlerts.map((alert) => {
                                  const dropPercent = computeAlertDropPercent({
                                    oldPrice: alert.oldPrice,
                                    newPrice: alert.newPrice,
                                    savingsPerOrder: alert.savingsPerOrder,
                                    dropPercent: alert.dropPercent,
                                  });
                                  const isLargeDrop = dropPercent >= 15;
                                  const showPercentOffBadge =
                                    Number.isFinite(dropPercent) && dropPercent > 0;

                                  // Calculate fill percentage: 15% = 0% fill, 40%+ = 100% fill
                                  const minPercent = 15;
                                  const maxPercent = 40;
                                  const fillPercent = isLargeDrop
                                    ? Math.min(100, Math.max(0, ((dropPercent - minPercent) / (maxPercent - minPercent)) * 100))
                                    : 0;
                                  
                                  return (
                                  <TableRow 
                                    key={alert.id}
                                  >
                                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                      {new Date(alert.alertDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span>{alert.item.name}</span>
                                        {!alert.isCurrentlyTracked && (
                                          <Badge variant="outline" className="text-xs bg-gray-100 dark:bg-gray-800">
                                            Not Tracked
                                          </Badge>
                                        )}
                                        {isLargeDrop && (
                                          <div className="relative h-4 w-4">
                                            {/* Base flame icon outline - always visible */}
                                            <Flame className="absolute inset-0 h-4 w-4 text-orange-300 dark:text-orange-700" strokeWidth="1.5" />
                                            {/* Filled flame that reveals from bottom to top */}
                                            <Flame 
                                              className="absolute inset-0 h-4 w-4 text-orange-600 dark:text-orange-400" 
                                              fill="currentColor"
                                              style={{
                                                maskImage: `linear-gradient(0deg, black 0%, black ${fillPercent}%, transparent ${fillPercent}%, transparent 100%)`,
                                                WebkitMaskImage: `linear-gradient(0deg, black 0%, black ${fillPercent}%, transparent ${fillPercent}%, transparent 100%)`,
                                              }}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{alert.retailer}</Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground line-through">
                                      {formatPrice(alert.oldPrice)}
                                    </TableCell>
                                    <TableCell className="font-semibold text-green-600 dark:text-green-500">
                                      {formatPrice(alert.newPrice)}
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <div className="font-semibold text-green-600 dark:text-green-500">
                                          Save {formatPrice(alert.savingsPerOrder)}
                                        </div>
                                        {showPercentOffBadge && (
                                          <div className="text-xs">
                                            <Badge className="bg-orange-600 hover:bg-orange-700 text-white text-xs whitespace-nowrap">
                                              {formatDropPercentOffLabel(dropPercent)}% OFF
                                            </Badge>
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-left">
                                      {alert.url ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          asChild
                                        >
                                          <a
                                            href={alert.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2"
                                          >
                                            View Deal
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        </Button>
                                      ) : (
                                        <Button size="sm" variant="ghost" disabled>
                                          No Link
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            </WalkthroughHighlight>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-4 mb-3">
            <a 
              href="/support" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors font-medium"
            >
              Support
            </a>
            <span className="text-border">•</span>
            <a 
              href="/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors font-medium"
            >
              Privacy Policy
            </a>
            <span className="text-border">•</span>
            <a 
              href="/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors font-medium"
            >
              Terms of Use
            </a>
          </div>
          <div className="text-xs text-muted-foreground/80">
            © 2025 Procuro. All rights reserved.
          </div>
          <button
            type="button"
            onClick={() => {
              resetWalkthroughForTesting();
              window.location.reload();
            }}
            className="mt-2 text-xs text-muted-foreground/60 hover:text-muted-foreground underline block"
          >
            Reset first-time walkthrough (for testing)
          </button>
          <button
            type="button"
            onClick={() => {
              setSimulateQuickBooksConnected();
              window.location.reload();
            }}
            className="mt-1 text-xs text-muted-foreground/60 hover:text-muted-foreground underline block"
          >
            Simulate QuickBooks connected (for testing)
          </button>
        </footer>
      </div>

      {/* Add Item Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSaveNudge(null);
          setNewItemBrand('');
          setNewItemName('');
          setNewItemPrice('');
          setNewItemCategory('');
          setNewItemVendor('');
        }}
        title="Add New Item"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Match quality:</span>
            <span className={`font-semibold ${qualityLevelBadgeClass(addQuality.level)}`}>{addQuality.label}</span>
          </div>

          <div className="rounded-lg border border-primary/25 bg-primary/5 dark:bg-primary/10 px-3 py-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <span>
                Product brand <span className="text-red-500">*</span>
                <span className="text-muted-foreground font-normal"> (recommended for best accuracy)</span>
              </span>
              <InfoTooltip text={PRODUCT_BRAND_TOOLTIP} />
            </div>
            <p className="text-xs text-muted-foreground">Most accurate results include the package brand (not the supplier).</p>
            <input
              ref={addBrandInputRef}
              id="new-item-brand"
              type="text"
              value={newItemBrand}
              onChange={(e) => setNewItemBrand(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
              placeholder="e.g., Simpson Strong-Tie"
              disabled={addingItem}
            />
            {!newItemBrand.trim() ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">Add brand to improve match accuracy.</p>
            ) : null}
            {brandReinforcement === 'add' ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Great — this usually improves matching.
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="new-item-name" className="block text-sm font-medium mb-2">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              id="new-item-name"
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Simpson Strong-Tie 3-in x 0.148-in 10d Framing nails"
              autoFocus
              disabled={addingItem}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Add size, model, or specifications in the name for better price matching.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-item-price" className="block text-sm font-medium mb-2">
                Last Paid Price <span className="text-red-500">*</span>
              </label>
              <input
                id="new-item-price"
                type="number"
                step="0.01"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="0.00"
                disabled={addingItem}
              />
            </div>
            
            <div>
              <label htmlFor="new-item-category" className="block text-sm font-medium mb-2">
                Category
              </label>
              <input
                id="new-item-category"
                type="text"
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., Hardware, Office Supplies"
                disabled={addingItem}
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-item-vendor" className="block text-sm font-medium mb-2">
              Vendor Name
            </label>
            <input
              id="new-item-vendor"
              type="text"
              value={newItemVendor}
              onChange={(e) => setNewItemVendor(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Vendor/Supplier name"
              disabled={addingItem}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setSaveNudge(null);
                setNewItemBrand('');
                setNewItemName('');
                setNewItemPrice('');
                setNewItemCategory('');
                setNewItemVendor('');
              }}
              disabled={addingItem}
            >
              Cancel
            </Button>
            <Button onClick={requestAddItem} disabled={addingItem || !newItemName.trim() || !newItemPrice}>
              {addingItem ? 'Adding...' : 'Add Item'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        isOpen={editingId !== null}
        onClose={cancelEditing}
        title="Edit Item"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Match quality:</span>
            <span className={`font-semibold ${qualityLevelBadgeClass(editQuality.level)}`}>{editQuality.label}</span>
          </div>

          <div className="rounded-lg border border-primary/25 bg-primary/5 dark:bg-primary/10 px-3 py-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <span>
                Product brand <span className="text-red-500">*</span>
                <span className="text-muted-foreground font-normal"> (recommended for best accuracy)</span>
              </span>
              <InfoTooltip text={PRODUCT_BRAND_TOOLTIP} />
            </div>
            <p className="text-xs text-muted-foreground">Most accurate results include the package brand (not the supplier).</p>
            <input
              ref={editBrandInputRef}
              id="edit-item-brand"
              type="text"
              value={editProductBrand}
              onChange={(e) => setEditProductBrand(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
              placeholder="e.g., Simpson Strong-Tie"
              disabled={saving}
            />
            {!editProductBrand.trim() ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">Add brand to improve match accuracy.</p>
            ) : null}
            {brandReinforcement === 'edit' ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Great — this usually improves matching.
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="edit-item-name" className="block text-sm font-medium mb-2">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={editNameInputRef}
              id="edit-item-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Simpson Strong-Tie 3-in x 0.148-in 10d Framing nails"
              autoFocus
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Add size, model, or specifications in the name for better price matching.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-item-price" className="block text-sm font-medium mb-2">
                Last Paid Price <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-item-price"
                type="number"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="0.00"
                disabled={saving}
              />
            </div>
            
            <div>
              <label htmlFor="edit-item-category" className="block text-sm font-medium mb-2">
                Category
              </label>
              <input
                id="edit-item-category"
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., Hardware, Office Supplies"
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-item-vendor" className="block text-sm font-medium mb-2">
              Vendor Name
            </label>
            <input
              id="edit-item-vendor"
              type="text"
              value={editVendor}
              onChange={(e) => setEditVendor(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Vendor/Supplier name"
              disabled={saving}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={cancelEditing}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingId !== null) {
                  requestSaveItem(editingId);
                }
              }}
              disabled={saving || !editName.trim() || !editPrice}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={saveNudge != null}
        onClose={() => setSaveNudge(null)}
        title={saveNudge?.kind === 'missing_brand' ? 'Add a product brand' : 'Confirm save'}
        maxWidth="sm"
      >
        {saveNudge?.kind === 'missing_brand' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A product brand is required to save. Most accurate results include the package brand—add it to improve
              match accuracy.
            </p>
            <p className="text-xs text-muted-foreground">
              Can&apos;t find a manufacturer brand? Use your store brand (e.g. Great Value) or a strong keyword from the
              product title.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-end items-stretch sm:items-center">
              <Button variant="ghost" size="sm" className="text-muted-foreground" disabled title="Product brand is required to save.">
                Save without brand
              </Button>
              <Button variant="outline" onClick={() => setSaveNudge(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const form = saveNudge.form;
                  setSaveNudge(null);
                  setTimeout(() => {
                    if (form === 'edit') editBrandInputRef.current?.focus();
                    else addBrandInputRef.current?.focus();
                  }, 0);
                }}
              >
                Add brand now
              </Button>
            </div>
          </div>
        ) : saveNudge?.kind === 'low_quality' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Match quality:{' '}
              <span
                className={`font-semibold ${qualityLevelBadgeClass(
                  computeMatchQuality(saveNudge.form === 'edit' ? editMatchCtx : addMatchCtx).level
                )}`}
              >
                {computeMatchQuality(saveNudge.form === 'edit' ? editMatchCtx : addMatchCtx).label}
              </span>
              . You can still save; consider refining the item name or vendor details for better matches.
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  const form = saveNudge.form;
                  setSaveNudge(null);
                  setTimeout(() => {
                    if (form === 'edit') editNameInputRef.current?.focus();
                    else document.getElementById('new-item-name')?.focus();
                  }, 0);
                }}
              >
                Review details
              </Button>
              <Button
                onClick={() => {
                  if (saveNudge.kind !== 'low_quality') return;
                  const form = saveNudge.form;
                  setSaveNudge(null);
                  if (form === 'edit' && editingId != null) void performSaveItem(editingId);
                  else void performAddItem();
                }}
              >
                Save anyway
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Item Match Editor Modal */}
      {matchEditorItem && (
        <ItemMatchEditor
          isOpen={!!matchEditorItem}
          onClose={() => {
            setMatchEditorItem(null);
          }}
          item={{
            id: matchEditorItem.id,
            name: matchEditorItem.name,
            upc: matchEditorItem.upc,
            vendorName: matchEditorItem.vendorName,
            productBrand: matchEditorItem.productBrand,
            category: matchEditorItem.category,
            baselinePrice: matchEditorItem.baselinePrice,
            baselineUnitPrice: matchEditorItem.baselineUnitPrice ?? undefined,
            lastPaidPrice: matchEditorItem.lastPaidPrice,
            matchedRetailer: matchEditorItem.matchedRetailer,
            matchedUrl: matchEditorItem.matchUrl || null,
            matchedPrice: matchEditorItem.matchedPrice || null,
            matchConfidence: matchEditorItem.matchConfidence,
            matchStatus: matchEditorItem.matchStatus,
            isManuallyMatched: matchEditorItem.isManuallyMatched,
            matchProvider: matchEditorItem.matchProvider,
            matchUrl: matchEditorItem.matchUrl,
            matchTitle: matchEditorItem.matchTitle,
            matchReasons: (matchEditorItem as any).matchReasons,
            manualMatchProvider: matchEditorItem.manualMatchProvider,
            manualMatchUrl: matchEditorItem.manualMatchUrl,
            manualMatchTitle: matchEditorItem.manualMatchTitle,
            lastMatchedAt: matchEditorItem.lastMatchedAt,
          }}
          onMatchUpdated={async () => {
            const editorId = matchEditorItem?.id;
            await refreshDashboardMetrics();
            if (editorId == null) return;
            const simulate = getSimulateQuickBooksConnected();
            const itemsPath = simulate ? '/api/simulate/items' : '/api/items';
            const res = await apiFetch(apiUrl(itemsPath));
            if (res.ok) {
              const data = await res.json();
              const updatedItem = data.items?.find((i: Item) => i.id === editorId);
              if (updatedItem) {
                setMatchEditorItem(updatedItem);
              } else {
                setMatchEditorItem(null);
              }
            } else {
              setMatchEditorItem(null);
            }
          }}
        />
      )}
      </WalkthroughProvider>
    </div>
  );
}

