import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, Search, X, Edit2, DollarSign, ExternalLink, Loader2, AlertTriangle, Info, CheckCircle2, AlertCircle, Plus, Trash2, Lock, Shield, Pause, Play, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { LoadingState } from './ui/spinner';
import { EmptyState } from './ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tooltip } from './ui/tooltip';
import { Modal } from './ui/modal';
import { DropdownMenu, DropdownMenuItem } from './ui/dropdown-menu';
import { BrowserPriceResult } from '../providers_browser';
import { apiUrl, apiFetch } from '../utils/api';
import { useSubscription } from '../context/SubscriptionContext';
import { useUpgradeModal } from './UpgradeModalProvider';
import { InfoTooltip } from './InfoTooltip';
import { ItemMatchEditor } from './ItemMatchEditor';
import {
  computeMatchQuality,
  hasConcreteMatchEvidence,
  getNoPriceCheckStreak,
  isHighRiskForSaveNudge,
  qualityLevelBadgeClass,
  recordNoPriceCheckResult,
  type MatchQualityContext,
} from '../utils/itemMatchQuality';
import {
  needsClarificationAttention,
  needsMatchReviewAttention,
  parseAttentionParam,
} from '../utils/itemAttention';

const BASELINE_TOOLTIP = 'Baseline is set from your QuickBooks purchase history (typically your higher recent price) so savings stays consistent month to month.';
const LAST_PAID_TOOLTIP =
  'Most recent per-unit price from QuickBooks (purchase line amount divided by quantity when available). Aligns with retail unit prices for matching and Amazon checks.';
const MATCH_COLUMN_TOOLTIP =
  'Suggested matches represent the best current product candidate. Verify in Fix Match to confirm, or override if you found a better product.';
const PRODUCT_BRAND_TOOLTIP =
  'Product or manufacturer brand (what is on the package). This is not the same as vendor — vendor is who you pay.';
const AMAZON_HINT_TOOLTIP =
  'Extra search keywords for Amazon discovery only. Your accounting item name stays unchanged.';

interface Item {
  id: number;
  name: string;
  vendorName: string | null;
  /** Package / manufacturer brand (not supplier). Used for discovery matching. */
  productBrand?: string | null;
  /** Optional extra keywords for Amazon/Bright Data search without changing the accounting name. */
  amazonSearchHint?: string | null;
  upc?: string | null;
  category: string | null;
  baselinePrice?: number;
  baselineUnitPrice?: number | null; // Sticky baseline for savings (preferred)
  lastPaidPrice: number; // Most recent purchase price (for display)
  reorderIntervalDays: number;
  matchConfidence: number | null;
  isVagueName: boolean;
  needsClarification: boolean;
  matchedRetailer: string | null;
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
}

type DealStatus = 'deal' | 'no_deal' | 'no_price' | 'no_baseline';

type SaveNudgeState =
  | null
  | { kind: 'missing_brand'; form: 'add' | 'edit' }
  | { kind: 'low_quality'; form: 'add' | 'edit' };

interface ItemWithPriceCheck extends Item {
  priceResults?: BrowserPriceResult[];
  checkingPrice?: boolean;
  /** From last check-price response; used for baseline-based messaging */
  dealStatus?: DealStatus;
  bestPriceToday?: number | null;
  baselineUnitPrice?: number | null;
  savingsAmount?: number | null;
  savingsPercent?: number | null;
  newLowSinceLastCheck?: boolean;
  priceCheckHint?: { kind: string; message: string };
  searchKeywordUsed?: string;
  baselineHelp?: string;
}

export function Items() {
  const { isSubscribed } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<ItemWithPriceCheck[]>([]);
  const [filteredItems, setFilteredItems] = useState<ItemWithPriceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [matchEditorItem, setMatchEditorItem] = useState<Item | null>(null);
  
  // Separate state for item editing modal (from dropdown)
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [editProductBrand, setEditProductBrand] = useState('');
  const [editAmazonHint, setEditAmazonHint] = useState('');
  
  // Add item modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemBrand, setNewItemBrand] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newAmazonHint, setNewAmazonHint] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemVendor, setNewItemVendor] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  const [saveNudge, setSaveNudge] = useState<SaveNudgeState>(null);
  const [brandReinforcement, setBrandReinforcement] = useState<'add' | 'edit' | null>(null);

  const addBrandInputRef = useRef<HTMLInputElement>(null);
  const editBrandInputRef = useRef<HTMLInputElement>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const prevAddBrandRef = useRef('');
  const prevEditBrandRef = useRef('');

  const editingSourceItem = useMemo(
    () => (editingNameId != null ? items.find((i) => i.id === editingNameId) : undefined),
    [editingNameId, items]
  );

  const addMatchCtx: MatchQualityContext = useMemo(
    () => ({
      name: newItemName,
      productBrand: newItemBrand,
      vendorName: newItemVendor,
      amazonSearchHint: newAmazonHint,
    }),
    [newItemName, newItemBrand, newItemVendor, newAmazonHint]
  );

  const editMatchCtx: MatchQualityContext = useMemo(
    () => ({
      name: editName,
      productBrand: editProductBrand,
      vendorName: editVendor,
      amazonSearchHint: editAmazonHint,
      needsClarification: editingSourceItem?.needsClarification,
      isVagueName: editingSourceItem?.isVagueName,
      matchStatus: editingSourceItem?.matchStatus ?? null,
      matchConfidence: editingSourceItem?.matchConfidence ?? null,
      noPriceCheckStreak: editingSourceItem ? getNoPriceCheckStreak(editingSourceItem.id) : 0,
    }),
    [editName, editProductBrand, editVendor, editAmazonHint, editingSourceItem]
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
    if (editingNameId == null) {
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
  }, [editProductBrand, editingNameId]);

  useEffect(() => {
    fetchItems();
    // Load last search query from localStorage
    const lastSearch = localStorage.getItem('items-search-query');
    if (lastSearch) {
      setSearchQuery(lastSearch);
    }
  }, []);

  const attentionParam = parseAttentionParam(searchParams.get('attention'));

  const attentionCounts = useMemo(() => {
    let clarification = 0;
    let matchReview = 0;
    for (const item of items) {
      if (needsClarificationAttention(item)) clarification += 1;
      else if (needsMatchReviewAttention(item)) matchReview += 1;
    }
    return { clarification, matchReview };
  }, [items]);

  useEffect(() => {
    let list = items;
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      list = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.vendorName?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query) ||
          item.productBrand?.toLowerCase().includes(query) ||
          item.amazonSearchHint?.toLowerCase().includes(query)
      );
    }
    if (attentionParam === 'clarification') {
      list = list.filter((item) => needsClarificationAttention(item));
    } else if (attentionParam === 'match_review') {
      list = list.filter((item) => needsMatchReviewAttention(item));
    }
    setFilteredItems(list);
    localStorage.setItem('items-search-query', searchQuery);
  }, [searchQuery, items, attentionParam]);

  const fetchItems = async () => {
    try {
      const res = await apiFetch(apiUrl('/api/items'));
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setFilteredItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditItemModal = (item: Item) => {
    setEditingNameId(item.id);
    setEditProductBrand(item.productBrand || '');
    setEditAmazonHint(item.amazonSearchHint || '');
    setEditName(item.name);
    setEditPrice(String(item.lastPaidPrice));
    setEditCategory(item.category || '');
    setEditVendor(item.vendorName || '');
  };

  const cancelEditingName = () => {
    setEditingNameId(null);
    setSaveNudge(null);
    setEditName('');
    setEditPrice('');
    setEditCategory('');
    setEditVendor('');
    setEditProductBrand('');
    setEditAmazonHint('');
  };

  const performSaveItemName = async (itemId: number) => {
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
          lastPaidPrice: price,
          category: editCategory.trim() || undefined,
          vendorName: editVendor.trim() || undefined,
          productBrand: editProductBrand.trim() || null,
          amazonSearchHint: editAmazonHint.trim() || null,
        })
      });

      if (res.ok) {
        await fetchItems();
        cancelEditingName();
        setSaveNudge(null);

        const row = document.querySelector(`[data-item-id="${itemId}"]`);
        if (row) {
          row.classList.add('bg-green-50', 'dark:bg-green-900/20');
          setTimeout(() => {
            row.classList.remove('bg-green-50', 'dark:bg-green-900/20');
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

  const requestSaveItemName = (itemId: number) => {
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

    void performSaveItemName(itemId);
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
          name: newItemName.trim(),
          lastPaidPrice: price,
          category: newItemCategory.trim() || undefined,
          vendorName: newItemVendor.trim() || undefined,
          productBrand: newItemBrand.trim() || undefined,
          amazonSearchHint: newAmazonHint.trim() || undefined,
        }),
      });

      if (res.ok) {
        await fetchItems();
        setShowAddModal(false);
        setSaveNudge(null);
        setNewItemBrand('');
        setNewItemName('');
        setNewAmazonHint('');
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const hasMatchEvidence = (item: Item): boolean =>
    hasConcreteMatchEvidence({
      itemName: item.name,
      matchProvider: item.matchProvider,
      matchedRetailer: item.matchedRetailer,
      matchUrl: item.matchUrl,
      matchTitle: item.matchTitle,
      manualMatchTitle: item.manualMatchTitle,
      matchedPrice: item.matchedPrice,
      matchConfidence: item.matchConfidence,
    });

  const checkPriceForItem = async (item: ItemWithPriceCheck) => {
    // Check subscription before allowing price check
    if (!isSubscribed) {
      openUpgradeModal();
      return;
    }

    // Set loading state
    setItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, checkingPrice: true, priceResults: [] } : i
    ));
    setFilteredItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, checkingPrice: true, priceResults: [] } : i
    ));
    setExpandedItemId(item.id);

    try {
      console.log(`Starting price check for: ${item.name}`);
      
      // Use backend API for price check (requires subscription)
      const response = await apiFetch(apiUrl(`/api/items/check-price/${item.id}`));
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresSubscription) {
          openUpgradeModal();
          return;
        }
        throw new Error(errorData.error || 'Failed to check price');
      }

      const data = await response.json();
      
      const results: BrowserPriceResult[] = (data.results || []).map((r: any) => ({
        retailer: r.retailer,
        price: r.price,
        url: r.url || null,
        title: r.title || item.name,
        stock: r.stock,
        image: r.image || null,
        error: null,
      }));

      const dealStatus = data.dealStatus as DealStatus | undefined;
      const bestPriceToday = data.bestPriceToday ?? null;
      const baselineUnitPrice = data.baselineUnitPrice ?? null;
      const savingsAmount = data.savingsAmount ?? null;
      const savingsPercent = data.savingsPercent ?? null;
      const newLowSinceLastCheck = Boolean(data.newLowSinceLastCheck);
      const priceCheckHint = data.priceCheckHint as ItemWithPriceCheck['priceCheckHint'];
      const searchKeywordUsed = typeof data.searchKeywordUsed === 'string' ? data.searchKeywordUsed : undefined;
      const baselineHelp = typeof data.baselineHelp === 'string' ? data.baselineHelp : undefined;
      
      console.log(`Price check complete: ${results.length} results, dealStatus=${dealStatus}`);

      const hadAnyRetailerPrice = results.some((r) => r.price != null && r.price > 0);
      recordNoPriceCheckResult(item.id, hadAnyRetailerPrice);

      const updated = {
        ...item,
        checkingPrice: false,
        priceResults: results,
        dealStatus,
        bestPriceToday,
        baselineUnitPrice,
        savingsAmount,
        savingsPercent,
        newLowSinceLastCheck,
        priceCheckHint,
        searchKeywordUsed,
        baselineHelp,
      };
      setItems(prev => prev.map(i => (i.id === item.id ? updated : i)));
      setFilteredItems(prev => prev.map(i => (i.id === item.id ? updated : i)));

      // Send results to backend
      if (results.length > 0) {
        try {
          const response = await apiFetch(apiUrl('/api/store-price/bulk'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemId: item.id,
              results: results
            })
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`✅ Stored ${data.pricesStored} prices, created ${data.alertsCreated} alerts`);
          }
        } catch (error) {
          console.error('Error storing prices:', error);
        }
      }
    } catch (error) {
      console.error('Error checking prices:', error);
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, checkingPrice: false } : i
      ));
      setFilteredItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, checkingPrice: false } : i
      ));
    }
  };

  const toggleExpanded = (itemId: number) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
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
        // Refresh items
        await fetchItems();
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
        await fetchItems();
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
        await fetchItems();
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

  if (loading) {
    return <LoadingState text="Loading items..." />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No items yet"
        description="Add items manually to start tracking prices and finding savings."
      />
    );
  }

  const addQuality = computeMatchQuality(addMatchCtx);
  const editQuality = computeMatchQuality(editMatchCtx);

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Items</h1>
          <p className="text-muted-foreground mt-1">
            {filteredItems.length} of {items.length} items
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="h-7 w-7 p-0"
          variant="outline"
          title="Add Item"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by name, brand, vendor, category, or search hint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {(attentionCounts.clarification > 0 ||
            attentionCounts.matchReview > 0 ||
            attentionParam != null) && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by items needing attention">
              <span className="text-xs text-muted-foreground mr-1">Attention:</span>
              <button
                type="button"
                onClick={() => {
                  setSearchParams((prev) => {
                    const p = new URLSearchParams(prev);
                    const cur = p.get('attention');
                    if (cur === 'clarification') p.delete('attention');
                    else p.set('attention', 'clarification');
                    return p;
                  });
                }}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                  attentionParam === 'clarification'
                    ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100'
                    : 'border-border bg-background hover:bg-accent/50'
                }`}
              >
                Clarification ({attentionCounts.clarification})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchParams((prev) => {
                    const p = new URLSearchParams(prev);
                    const cur = p.get('attention');
                    if (cur === 'match_review') p.delete('attention');
                    else p.set('attention', 'match_review');
                    return p;
                  });
                }}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                  attentionParam === 'match_review'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                    : 'border-border bg-background hover:bg-accent/50'
                }`}
              >
                Match review ({attentionCounts.matchReview})
              </button>
              {attentionParam != null && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const p = new URLSearchParams(prev);
                      p.delete('attention');
                      return p;
                    });
                  }}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Clear attention filter
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Table */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Search}
              title="No items found"
              description={
                searchQuery.trim()
                  ? `No items match "${searchQuery}". Try a different search term.`
                  : attentionParam === 'clarification'
                    ? 'No items need name clarification right now.'
                    : attentionParam === 'match_review'
                      ? 'No items need match review right now.'
                      : 'No items to show.'
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Items</CardTitle>
            <CardDescription>Use Edit Item to update name, product brand, Amazon search hint, vendor, and category.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        Product brand
                        <InfoTooltip text={PRODUCT_BRAND_TOOLTIP} />
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        Amazon search
                        <InfoTooltip text={AMAZON_HINT_TOOLTIP} />
                      </span>
                    </TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        Last Paid
                        <InfoTooltip text={LAST_PAID_TOOLTIP} />
                      </span>
                    </TableHead>
                        <TableHead>Monitored</TableHead>
                        {isSubscribed && (
                          <TableHead>
                            <span className="inline-flex items-center gap-1">
                              Match
                              <InfoTooltip text={MATCH_COLUMN_TOOLTIP} />
                            </span>
                          </TableHead>
                        )}
                        <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <>
                      <TableRow
                        key={item.id}
                        data-item-id={item.id}
                        className={`transition-colors ${item.isPaused ? "opacity-50" : ""}`}
                      >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {item.name}
                            </span>
                            {/* Status Indicators - Icons only, no badge wrapper */}
                            <div className="flex items-center gap-1.5">
                              {item.needsClarification && !(item.isManuallyMatched && item.matchStatus === 'overridden') && (
                                <Tooltip content="Needs clarification — name is too vague to monitor. Edit the item (brand, size, pack) or add an Amazon search hint.">
                                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 cursor-help" />
                                </Tooltip>
                              )}
                              {(item.matchStatus === 'needs_review' || (item.matchStatus === 'unmatched' && hasMatchEvidence(item))) &&
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
                                hasMatchEvidence(item) &&
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
                          </div>
                          {/* Show matched product title if different from item name */}
                          {hasMatchEvidence(item) && item.matchTitle && item.matchTitle !== item.name && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              Matched: {item.matchTitle}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[140px]">
                        <span className="text-sm line-clamp-2">{item.productBrand || '—'}</span>
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <span className="text-sm line-clamp-2 text-muted-foreground">{item.amazonSearchHint || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span>{item.vendorName || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span>{item.category || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-primary">{formatPrice(item.lastPaidPrice)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.isPaused ? (
                            <Tooltip content="Monitoring paused — will not check prices">
                              <Shield className="h-4 w-4 text-gray-400" />
                            </Tooltip>
                          ) : item.needsClarification ? (
                            <Tooltip content="Cannot be monitored - Item name is too vague. Clarify the name to enable price tracking.">
                              <Shield className="h-4 w-4 text-gray-300" />
                            </Tooltip>
                          ) : item.isMonitored ? (
                            <Tooltip content={`Priority: ${(item.priorityScore || 0).toFixed(2)} - This item is actively monitored in daily price checks.`}>
                              <Shield className="h-4 w-4 text-blue-500" />
                            </Tooltip>
                          ) : (
                            <Tooltip content="Not monitored - This item is not in the top priority list for daily price checks.">
                              <Shield className="h-4 w-4 text-gray-300" />
                            </Tooltip>
                          )}
                          <Badge variant={item.isPaused ? "secondary" : item.needsClarification ? "secondary" : item.isMonitored ? "default" : "secondary"} className={item.isPaused ? "" : item.needsClarification ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" : item.isMonitored ? "bg-green-600 hover:bg-green-700" : ""}>
                            {item.isPaused ? "Paused" : item.needsClarification ? "Needs Clarification" : item.isMonitored ? "Monitored" : "Not monitored"}
                          </Badge>
                        </div>
                      </TableCell>
                      {isSubscribed && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {/* Match Status Badge */}
                            {(item.matchStatus === 'unmatched' ||
                              ((item.matchStatus === 'needs_review' || item.matchStatus === 'auto_matched') &&
                                !hasMatchEvidence(item))) && (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                Unmatched
                              </Badge>
                            )}
                            {item.matchStatus === 'needs_review' && hasMatchEvidence(item) && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                Needs Review
                              </Badge>
                            )}
                            {item.matchStatus === 'auto_matched' && hasMatchEvidence(item) && (
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
                            {!item.matchStatus && (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                Unknown
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Tooltip content={!isSubscribed ? "Subscription required - Upgrade to unlock manual price checks" : "Check prices across retailers"}>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => checkPriceForItem(item)}
                                disabled={item.checkingPrice || !isSubscribed}
                                className={`gap-1 ${!isSubscribed ? "opacity-50 cursor-not-allowed" : ""}`}
                              >
                                {item.checkingPrice ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Checking...</span>
                                  </>
                                ) : !isSubscribed ? (
                                  <>
                                    <Lock className="h-3 w-3" />
                                    <span>Check Price</span>
                                  </>
                                ) : (
                                  <>
                                    <DollarSign className="h-3 w-3" />
                                    <span>Check Price</span>
                                  </>
                                )}
                              </Button>
                            </Tooltip>
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
                              <DropdownMenuItem onClick={() => openEditItemModal(item)}>
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
                      </TableCell>
                    </TableRow>
                    
                    {/* Guidance/Warning for items needing clarification */}
                    {item.needsClarification && (
                      <TableRow>
                        <TableCell colSpan={isSubscribed ? 9 : 8} className="bg-yellow-50 dark:bg-yellow-900/20 p-4 border-l-4 border-yellow-500">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm text-yellow-900 dark:text-yellow-100 mb-1">
                                Item Name Needs Clarification
                              </h4>
                              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                                {item.isVagueName 
                                  ? `"${item.name}" is too generic. Add more details like brand, size, model, or specifications to improve price matching accuracy.`
                                  : item.matchConfidence !== null && item.matchConfidence < 0.5
                                  ? `Low match confidence (${(item.matchConfidence * 100).toFixed(0)}%). Consider adding more specific details to the item name for better matching.`
                                  : 'This item may not match correctly. Please add more specific details to the name.'}
                              </p>
                              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                <strong>Example:</strong> Instead of "Nails", use "Simpson Strong-Tie 3-in x 0.148-in 10d Hot-dipped galvanized Smooth Shank Framing nails"
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {/* Expandable Price Results Row */}
                    {expandedItemId === item.id && (item.priceResults || item.checkingPrice) && (
                      <TableRow>
                        <TableCell colSpan={isSubscribed ? 9 : 8} className="bg-muted/50 p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm">Price Check Results</h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleExpanded(item.id)}
                                className="h-6 px-2"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            {item.checkingPrice ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                                <span className="text-sm text-muted-foreground">
                                  Checking prices from configured retailers (Amazon, Home Depot, Office Depot, …)…
                                </span>
                              </div>
                            ) : item.priceResults && item.priceResults.length > 0 ? (
                              <div className="space-y-3">
                                {item.searchKeywordUsed ? (
                                  <p className="text-xs text-muted-foreground">
                                    Search keyword used: <span className="font-mono">{item.searchKeywordUsed}</span>
                                  </p>
                                ) : null}
                                {item.baselineHelp ? (
                                  <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">{item.baselineHelp}</p>
                                ) : null}
                                {item.newLowSinceLastCheck ? (
                                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                    New low since last check — today&apos;s best beat your previous best stored price.
                                  </p>
                                ) : null}
                                {/* Baseline-based summary: never show $0 savings */}
                                {(item.dealStatus != null || item.baselineUnitPrice != null) && (
                                  <div className="text-sm">
                                    {item.baselineUnitPrice != null && item.baselineUnitPrice > 0 && (
                                      <p className="text-muted-foreground mb-1 flex items-center gap-1">
                                        Baseline price: <InfoTooltip text={BASELINE_TOOLTIP} /> <span className="font-semibold">{formatPrice(item.baselineUnitPrice)}</span>
                                      </p>
                                    )}
                                    {item.dealStatus === 'deal' && item.savingsAmount != null && item.savingsPercent != null && (
                                      <p className="text-green-600 dark:text-green-500 font-semibold">
                                        Save {formatPrice(item.savingsAmount)} ({item.savingsPercent.toFixed(1)}%) vs baseline
                                      </p>
                                    )}
                                    {item.dealStatus === 'no_deal' && (
                                      <p className="text-muted-foreground italic">No deal today — we&apos;ll keep watching</p>
                                    )}
                                    {item.dealStatus === 'no_price' && (
                                      <p className="text-muted-foreground italic">No price available today</p>
                                    )}
                                    {item.dealStatus === 'no_baseline' && (
                                      <p className="text-muted-foreground italic">Baseline not set yet (import more history)</p>
                                    )}
                                  </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {item.priceResults.map((result, idx) => {
                                  const baselineUnitPrice = item.baselineUnitPrice ?? null;
                                  const resultPrice = result.price ?? null;
                                  const hasDeal = baselineUnitPrice != null && resultPrice != null && resultPrice > 0 && resultPrice < baselineUnitPrice;
                                  const savings = hasDeal && baselineUnitPrice != null ? baselineUnitPrice - resultPrice! : null;
                                  const savingsPercentVal = hasDeal && baselineUnitPrice && savings != null ? (savings / baselineUnitPrice) * 100 : null;
                                  
                                  return (
                                  <div
                                    key={idx}
                                    className={`rounded-lg border p-3 ${
                                      hasDeal
                                        ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                                        : 'border-border bg-background'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <h5 className="font-semibold text-sm">{result.retailer}</h5>
                                      {result.stock !== null && (
                                        <Badge
                                          variant={result.stock ? 'default' : 'secondary'}
                                          className="text-xs"
                                        >
                                          {result.stock ? 'In Stock' : 'Out of Stock'}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {result.price != null && result.price > 0 ? (
                                      <>
                                        <div className="text-2xl font-bold text-primary mb-1">
                                          {formatPrice(result.price)}
                                        </div>
                                        {hasDeal && savings != null && savingsPercentVal != null && (
                                          <div className="text-xs text-green-600 dark:text-green-500 font-semibold mb-2">
                                            Save {formatPrice(savings)} ({savingsPercentVal.toFixed(1)}% vs baseline)
                                          </div>
                                        )}
                                        {result.url && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            asChild
                                            className="w-full mt-2"
                                          >
                                            <a
                                              href={result.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center justify-center gap-2"
                                            >
                                              View Deal
                                              <ExternalLink className="h-3 w-3" />
                                            </a>
                                          </Button>
                                        )}
                                      </>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">
                                        <Badge variant="secondary" className="mb-2">No Data</Badge>
                                        <p className="text-xs">
                                          {result.error || 'Price not available'}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2 text-sm text-muted-foreground">
                                {item.searchKeywordUsed ? (
                                  <p className="text-xs">
                                    Search keyword used: <span className="font-mono">{item.searchKeywordUsed}</span>
                                  </p>
                                ) : null}
                                {item.priceCheckHint?.message ? (
                                  <div className="rounded-md border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-amber-900 dark:text-amber-100">
                                    {item.priceCheckHint.message}
                                  </div>
                                ) : null}
                                <p className="text-center py-2">
                                  {item.dealStatus === 'no_price'
                                    ? 'No retailer prices returned this run.'
                                    : item.dealStatus === 'no_baseline'
                                      ? 'Baseline not set yet (import more history)'
                                      : 'No price data available'}
                                </p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Item Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSaveNudge(null);
          setNewItemBrand('');
          setNewItemName('');
          setNewAmazonHint('');
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
              id="new-item-brand-items"
              type="text"
              value={newItemBrand}
              onChange={(e) => setNewItemBrand(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
              placeholder="e.g., Clorox"
              disabled={addingItem}
              aria-describedby="new-item-brand-hint"
            />
            {!newItemBrand.trim() ? (
              <p id="new-item-brand-hint" className="text-xs text-amber-700 dark:text-amber-400">
                Add brand to improve match accuracy.
              </p>
            ) : null}
            {brandReinforcement === 'add' ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Great — this usually improves matching.
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="new-item-name-items" className="block text-sm font-medium mb-2">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              id="new-item-name-items"
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Disinfecting wipes 75 count"
              autoFocus
              disabled={addingItem}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Keep your QuickBooks-style description; add more detail in the name or an Amazon hint below for discovery.
            </p>
          </div>
          <div>
            <label htmlFor="new-amazon-hint-items" className="block text-sm font-medium mb-2">
              <span className="inline-flex items-center gap-1">
                Amazon search hint
                <InfoTooltip text={AMAZON_HINT_TOOLTIP} />
              </span>
            </label>
            <input
              id="new-amazon-hint-items"
              type="text"
              value={newAmazonHint}
              onChange={(e) => setNewAmazonHint(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Optional keywords for Amazon only"
              disabled={addingItem}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-item-price-items" className="block text-sm font-medium mb-2">
                Last Paid Price <span className="text-red-500">*</span>
              </label>
              <input
                id="new-item-price-items"
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
              <label htmlFor="new-item-category-items" className="block text-sm font-medium mb-2">
                Category
              </label>
              <input
                id="new-item-category-items"
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
            <label htmlFor="new-item-vendor-items" className="block text-sm font-medium mb-2">
              Vendor name
            </label>
            <input
              id="new-item-vendor-items"
              type="text"
              value={newItemVendor}
              onChange={(e) => setNewItemVendor(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Who you buy from (supplier), not the product brand"
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
                setNewAmazonHint('');
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
        isOpen={editingNameId !== null}
        onClose={cancelEditingName}
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
              id="edit-item-brand-items"
              type="text"
              value={editProductBrand}
              onChange={(e) => setEditProductBrand(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
              placeholder="Package / manufacturer brand"
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
            <label htmlFor="edit-item-name-items" className="block text-sm font-medium mb-2">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={editNameInputRef}
              id="edit-item-name-items"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Accounting / catalog name"
              autoFocus
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Add product brand above or an Amazon hint below without changing how you name items in QuickBooks.
            </p>
          </div>
          <div>
            <label htmlFor="edit-amazon-hint-items" className="block text-sm font-medium mb-2">
              <span className="inline-flex items-center gap-1">
                Amazon search hint
                <InfoTooltip text={AMAZON_HINT_TOOLTIP} />
              </span>
            </label>
            <input
              id="edit-amazon-hint-items"
              type="text"
              value={editAmazonHint}
              onChange={(e) => setEditAmazonHint(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Optional keywords for Amazon discovery"
              disabled={saving}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-item-price-items" className="block text-sm font-medium mb-2">
                Last Paid Price <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-item-price-items"
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
              <label htmlFor="edit-item-category-items" className="block text-sm font-medium mb-2">
                Category
              </label>
              <input
                id="edit-item-category-items"
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
            <label htmlFor="edit-item-vendor-items" className="block text-sm font-medium mb-2">
              Vendor name
            </label>
            <input
              id="edit-item-vendor-items"
              type="text"
              value={editVendor}
              onChange={(e) => setEditVendor(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Who you buy from (supplier)"
              disabled={saving}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={cancelEditingName}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingNameId !== null) {
                  requestSaveItemName(editingNameId);
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
              . You can still save; consider refining the item name or Amazon search hint for better matches.
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  const form = saveNudge.form;
                  setSaveNudge(null);
                  setTimeout(() => {
                    if (form === 'edit') editNameInputRef.current?.focus();
                    else document.getElementById('new-amazon-hint-items')?.focus();
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
                  if (form === 'edit' && editingNameId != null) void performSaveItemName(editingNameId);
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
            await fetchItems();
            if (editorId == null) return;
            const res = await apiFetch(apiUrl('/api/items'));
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
    </div>
  );
}

