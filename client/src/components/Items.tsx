import { useState, useEffect } from 'react';
import { Package, Search, X, Check, Edit2, XCircle, DollarSign, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { LoadingState } from './ui/spinner';
import { EmptyState } from './ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { checkAllRetailers, BrowserPriceResult } from '../providers_browser';

interface Item {
  id: number;
  name: string;
  vendorName: string | null;
  sku: string | null;
  category: string | null;
  lastPaidPrice: number;
  reorderIntervalDays: number;
}

interface ItemWithPriceCheck extends Item {
  priceResults?: BrowserPriceResult[];
  checkingPrice?: boolean;
}

export function Items() {
  const [items, setItems] = useState<ItemWithPriceCheck[]>([]);
  const [filteredItems, setFilteredItems] = useState<ItemWithPriceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<Item>>({});
  const [saving, setSaving] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  useEffect(() => {
    fetchItems();
    // Load last search query from localStorage
    const lastSearch = localStorage.getItem('items-search-query');
    if (lastSearch) {
      setSearchQuery(lastSearch);
    }
  }, []);

  useEffect(() => {
    // Filter items based on search query
    if (searchQuery.trim() === '') {
      setFilteredItems(items);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.vendorName?.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
      );
      setFilteredItems(filtered);
    }
    // Save search query to localStorage
    localStorage.setItem('items-search-query', searchQuery);
  }, [searchQuery, items]);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/items');
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

  const startEditing = (item: Item) => {
    setEditingId(item.id);
    setEditValues({
      name: item.name,
      vendorName: item.vendorName,
      sku: item.sku,
      category: item.category,
      lastPaidPrice: item.lastPaidPrice
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveItem = async (itemId: number) => {
    if (!editValues.name || editValues.name.trim() === '') {
      alert('Item name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editValues)
      });

      if (res.ok) {
        const data = await res.json();
        // Update local state
        setItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, ...editValues } : item
        ));
        setEditingId(null);
        setEditValues({});
        
        // Show success feedback
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const checkPriceForItem = async (item: ItemWithPriceCheck) => {
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
      
      // Run all browser providers in parallel
      const results = await checkAllRetailers(item.name);
      
      console.log(`Price check complete: ${results.length} results`);

      // Update items with results
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, checkingPrice: false, priceResults: results } : i
      ));
      setFilteredItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, checkingPrice: false, priceResults: results } : i
      ));

      // Send results to backend
      if (results.length > 0) {
        try {
          const response = await fetch('/api/store-price/bulk', {
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

  if (loading) {
    return <LoadingState text="Loading items..." />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No items yet"
        description="Connect your QuickBooks account to import items, or add items manually."
      />
    );
  }

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
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by name, vendor, SKU, or category..."
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
        </CardContent>
      </Card>

      {/* Items Table */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Search}
              title="No items found"
              description={`No items match "${searchQuery}". Try a different search term.`}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Items</CardTitle>
            <CardDescription>Click on any field to edit inline</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Last Paid</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <>
                      <TableRow
                        key={item.id}
                        data-item-id={item.id}
                        className="transition-colors"
                      >
                      <TableCell>
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editValues.name || ''}
                            onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                            className="w-full px-2 py-1 border border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium">{item.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editValues.vendorName || ''}
                            onChange={(e) => setEditValues({ ...editValues, vendorName: e.target.value })}
                            className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Vendor name"
                          />
                        ) : (
                          <span>{item.vendorName || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editValues.sku || ''}
                            onChange={(e) => setEditValues({ ...editValues, sku: e.target.value })}
                            className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="SKU"
                          />
                        ) : (
                          <span className="font-mono text-sm">{item.sku || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editValues.category || ''}
                            onChange={(e) => setEditValues({ ...editValues, category: e.target.value })}
                            className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Category"
                          />
                        ) : (
                          <span>{item.category || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.lastPaidPrice || ''}
                            onChange={(e) => setEditValues({ ...editValues, lastPaidPrice: parseFloat(e.target.value) })}
                            className="w-24 px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <span className="font-bold text-primary">{formatPrice(item.lastPaidPrice)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === item.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveItem(item.id)}
                              disabled={saving}
                              className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                              disabled={saving}
                              className="h-8 w-8 p-0"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(item)}
                              className="h-8 w-8 p-0"
                              title="Edit item"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => checkPriceForItem(item)}
                              disabled={item.checkingPrice}
                              className="gap-1"
                              title="Check prices across retailers"
                            >
                              {item.checkingPrice ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Checking...</span>
                                </>
                              ) : (
                                <>
                                  <DollarSign className="h-3 w-3" />
                                  <span>Check Price</span>
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    
                    {/* Expandable Price Results Row */}
                    {expandedItemId === item.id && (item.priceResults || item.checkingPrice) && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/50 p-4">
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
                                  Checking prices across 6 retailers...
                                </span>
                              </div>
                            ) : item.priceResults && item.priceResults.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {item.priceResults.map((result, idx) => (
                                  <div
                                    key={idx}
                                    className={`rounded-lg border p-3 ${
                                      result.price && result.price < item.lastPaidPrice
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
                                    
                                    {result.price ? (
                                      <>
                                        <div className="text-2xl font-bold text-primary mb-1">
                                          {formatPrice(result.price)}
                                        </div>
                                        {result.price < item.lastPaidPrice && (
                                          <div className="text-xs text-green-600 dark:text-green-500 font-semibold mb-2">
                                            Save {formatPrice(item.lastPaidPrice - result.price)} (
                                            {(((item.lastPaidPrice - result.price) / item.lastPaidPrice) * 100).toFixed(1)}
                                            % off)
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
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-sm text-muted-foreground">
                                No price data available
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
    </div>
  );
}

