import { useState, useEffect } from 'react';
import { Package, TestTube, Database, Play, AlertCircle, Check, Loader2, Bug } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tooltip } from '../components/ui/tooltip';
// Providers are imported via backend API calls, not directly
// import * as officedepot from '../providers_browser/officedepot.browser';
import { BrowserPriceResult } from '../providers_browser/types';
import { apiUrl, apiFetch } from '../utils/api';

interface TestItem {
  id: number;
  name: string;
  baselinePrice: number; // Stable price for savings calculations
  lastPaidPrice: number; // Most recent purchase price (for display)
  vendorName?: string;
  category?: string;
}

interface DebugInfo {
  provider: string;
  url: string;
  htmlSize: number;
  timestamp: string;
  validHTML: boolean;
  errorMessage?: string;
}

/**
 * PROVIDER TEST PAGE - 100% BROWSER-BASED FETCHING
 * 
 * This page ONLY uses browser providers from client/src/providers_browser/
 * NO backend API calls for price fetching
 * All retailer HTML is fetched directly from the user's browser
 */
export function ProviderTest() {
  // Test Item Creation
  const [itemName, setItemName] = useState('');
  const [itemVendor, setItemVendor] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);

  // Provider Testing
  const [keyword, setKeyword] = useState('ASUDESIRE 3 Pack Men\'s Sweatpants');
  const [testing, setTesting] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('');
  const [result, setResult] = useState<BrowserPriceResult | null>(null);
  const [rawHtml, setRawHtml] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [envWarning, setEnvWarning] = useState(false);

  // Check if running on correct domain
  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname !== 'dev.procuroapp.com' && hostname !== 'procuroapp.com') {
      setEnvWarning(true);
      console.warn('⚠️ Provider tests may be limited on localhost due to CORS. Use dev.procuroapp.com for full functionality.');
    }
  }, []);

  // Fetch test items on mount
  const fetchTestItems = async () => {
    try {
      const res = await apiFetch(apiUrl('/api/items'));
      if (res.ok) {
        const data = await res.json();
        setTestItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  useEffect(() => {
    fetchTestItems();
  }, []);

  /**
   * VALIDATE RETAILER HTML
   * Ensures we're getting real retailer HTML, not Vite dev server HTML
   * Note: Some providers (like Target) use API calls and don't return HTML
   */
  const validateRetailerHTML = (html: string | undefined | null, retailerName: string): { valid: boolean; error?: string } => {
    // API-based providers (like Target RedSky API, Rakuten) don't return HTML
    const apiBasedProviders = ['target', 'rakuten'];
    if (apiBasedProviders.includes(retailerName.toLowerCase())) {
      // For API-based providers, HTML validation is not applicable
      return { valid: true };
    }

    // If HTML is missing for non-API providers, that's an error
    if (!html || typeof html !== 'string') {
      return {
        valid: false,
        error: 'No HTML response received',
      };
    }

    // Check if it's the Vite dev server index.html
    if (html.includes('<title>ProcuroApp') || html.includes('Vite') || html.includes('/src/main.tsx')) {
      return {
        valid: false,
        error: '🚨 ERROR: Provider is hitting the DEV SERVER instead of the retailer! This means the provider is wired incorrectly.',
      };
    }

    // Check minimum size (real retailer pages are usually > 50KB)
    if (html.length < 2000) {
      return {
        valid: false,
        error: `⚠️ HTML too small (${html.length} chars) — likely not real retailer HTML.`,
      };
    }

    // Check for retailer-specific signatures
    const signatures: Record<string, string[]> = {
      // Target - Disabled
      // Target: ['target.com', 'data-'],
      // HomeDepot - Disabled
      // 'Home Depot': ['homedepot.com', 'product'],
      // Lowes - Disabled
      // Lowes: ['lowes.com', 'pdp'],
      // Staples - Disabled
      // Staples: ['staples.com', 'product'],
      'Office Depot': ['officedepot.com', 'product'],
    };

    const sigs = signatures[retailerName] || [];
    const hasSignature = sigs.some(sig => html.toLowerCase().includes(sig.toLowerCase()));

    if (!hasSignature && html.length < 100000) {
      return {
        valid: false,
        error: `⚠️ HTML doesn't contain expected ${retailerName} signatures. May be blocked or redirected.`,
      };
    }

    return { valid: true };
  };

  /**
   * FETCH FROM BACKEND PROVIDER PROXY
   * No more CORS issues - backend handles all retailer requests
   */
  const fetchFromBackendProvider = async (retailer: string, keyword: string): Promise<{
    success: boolean;
    html?: string;
    parsed?: any;
    url?: string;
    error?: string;
    items?: any[];
    retailer?: string;
  }> => {
    try {
      const endpoint = `/api/provider/${retailer.toLowerCase().replace(/\s+/g, '')}?keyword=${encodeURIComponent(keyword)}`;
      
      console.log(`🔌 Calling backend provider: ${endpoint}`);
      console.log(`🔵 Full URL would be: ${apiUrl(endpoint)}`);
      
      const res = await apiFetch(apiUrl(endpoint));
      console.log(`🔵 Response status: ${res.status} ${res.statusText}`);
      
      if (!res.ok) {
        console.error(`🔴 Response not OK: ${res.status} ${res.statusText}`);
        const errorText = await res.text();
        console.error(`🔴 Error response body:`, errorText);
      }
      
      const data = await res.json();
      console.log(`🔵 Response data:`, data);
      
      return data;
    } catch (error: any) {
      console.error(`🔴 fetchFromBackendProvider error:`, error);
      console.error(`🔴 Error message:`, error.message);
      console.error(`🔴 Error stack:`, error.stack);
      return {
        success: false,
        html: '',
        parsed: null,
        url: '',
        error: error.message || 'Backend request failed',
      };
    }
  };

  /**
   * TEST A PROVIDER - BACKEND PROXY (NO CORS!)
   */
  const testProvider = async (providerName: string) => {
    console.log(`🔵 testProvider called with: ${providerName}, keyword: ${keyword}`);
    
    if (!keyword.trim()) {
      setError('Please enter a keyword');
      return;
    }

    setTesting(true);
    setCurrentProvider(providerName);
    setResult(null);
    setRawHtml('');
    setError('');
    setDebugInfo(null);
    setSaveSuccess(false);

    try {
      console.log(`🧪 Testing ${providerName} via backend proxy...`);

      // Call backend provider proxy (NO CORS!)
      const backendResponse = await fetchFromBackendProvider(providerName, keyword);
      console.log(`🔵 Backend response received:`, backendResponse);

      // Validate the HTML
      const validation = validateRetailerHTML(backendResponse.html, providerName);

      // Set debug info
      const debug: DebugInfo = {
        provider: providerName,
        url: backendResponse.url || '',
        htmlSize: backendResponse.html?.length || 0,
        timestamp: new Date().toLocaleString(),
        validHTML: validation.valid && backendResponse.success,
        errorMessage: backendResponse.error || validation.error,
      };

      setDebugInfo(debug);

      // Set raw HTML
      if (backendResponse.html) {
        setRawHtml(backendResponse.html.substring(0, 50000));
      }

      // Handle errors
      if (!backendResponse.success) {
        setError(`Backend Error: ${backendResponse.error || 'Unknown error'}`);
        setResult({
          retailer: providerName,
          price: null,
          url: null,
          title: null,
          stock: null,
          image: null,
          error: backendResponse.error,
        });
        return;
      }

      // Handle providers with items array format (Rakuten, Staples)
      const itemsArrayProviders = ['rakuten', 'staples'];
      if (itemsArrayProviders.includes(providerName.toLowerCase()) && backendResponse.items) {
        if (backendResponse.items.length > 0) {
          const firstItem = backendResponse.items[0];
          setResult({
            retailer: firstItem.retailer || providerName,
            price: firstItem.price,
            title: firstItem.title,
            url: firstItem.url,
            image: firstItem.image,
            stock: null,
          });
          if (firstItem.price) {
            console.log(`✅ ${providerName}: Found price $${firstItem.price.toFixed(2)}`);
          }
        } else {
          setError(`⚠️ ${providerName} returned no items for this keyword.`);
          setResult({
            retailer: providerName,
            price: null,
            url: null,
            title: null,
            stock: null,
            image: null,
          });
        }
      } else if (backendResponse.parsed) {
        // Standard parsed format for HTML-based providers
        setResult(backendResponse.parsed);
        
        if (!backendResponse.parsed.price) {
          setError('⚠️ Provider found no price. Check raw HTML for parsing issues.');
        } else {
          console.log(`✅ ${providerName}: Found price $${backendResponse.parsed.price.toFixed(2)}`);
        }
      } else {
        setError('⚠️ Provider could not parse results. Check raw HTML.');
        setResult({
          retailer: providerName,
          price: null,
          url: null,
          title: null,
          stock: null,
          image: null,
        });
      }

    } catch (error: any) {
      console.error(`❌ ${providerName} test failed:`, error);
      setError(`Test failed: ${error.message}`);
      setResult({
        retailer: providerName,
        price: null,
        url: null,
        title: null,
        stock: null,
        image: null,
        error: error.message,
      });
    } finally {
      setTesting(false);
      setCurrentProvider('');
    }
  };

  /**
   * CREATE TEST ITEM IN DATABASE
   */
  const createTestItem = async () => {
    if (!itemName || !itemPrice) {
      alert('Item name and price are required');
      return;
    }

    const parsedPrice = parseFloat(itemPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      alert('Please enter a valid price');
      return;
    }

    setCreatingItem(true);
    try {
      const res = await apiFetch(apiUrl('/api/items'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemName,
          vendorName: itemVendor || undefined,
          category: itemCategory || undefined,
          lastPaidPrice: parsedPrice,
          quantityPerOrder: 1,
          reorderIntervalDays: 30,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchTestItems();
        // Clear form
        setItemName('');
        setItemVendor('');
        setItemPrice('');
        setItemCategory('');
        // Auto-select new item
        setSelectedItemId(data.item.id);
        alert(`✅ Test item created with ID: ${data.item.id}`);
      } else {
        const errorData = await res.json();
        alert(`Failed to create item: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error creating item:', error);
      alert('Failed to create test item');
    } finally {
      setCreatingItem(false);
    }
  };

  /**
   * SAVE RESULT TO DATABASE AND GENERATE ALERTS
   */
  const saveToDatabase = async () => {
    if (!selectedItemId) {
      alert('Please select a test item first');
      return;
    }

    if (!result || !result.price) {
      alert('No valid price result to save');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      // Save price to database
      const res = await apiFetch(apiUrl('/api/store-price'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItemId,
          retailer: result.retailer,
          price: result.price,
          url: result.url,
          title: result.title,
          stock: result.stock,
          image: result.image,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save price');
      }

      const data = await res.json();
      console.log('✅ Price saved:', data);

      // Generate alerts
      const alertRes = await apiFetch(apiUrl('/api/alerts/generate'), {
        method: 'POST',
      });

      if (alertRes.ok) {
        console.log('✅ Alerts generated');
      }

      setSaveSuccess(true);
      alert('✅ Result saved to database! Alerts generated. Check DB Inspector.');
    } catch (error: any) {
      console.error('Error saving to database:', error);
      alert(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectedItem = testItems.find(item => item.id === selectedItemId);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[2000px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <TestTube className="w-8 h-8 text-blue-600" />
            Provider Test Page - Backend Proxy Mode
          </h1>
          <p className="text-gray-600 mt-2">
            Test all providers via backend proxy - NO CORS issues, real retailer HTML fetching!
          </p>
          
          {/* Domain Warning */}
          {envWarning && (
            <div className="mt-3 p-4 bg-red-50 border-2 border-red-300 rounded-md">
              <p className="text-sm text-red-900 font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                ⚠️ Provider tests will NOT work fully on localhost due to CORS restrictions.
              </p>
              <p className="text-sm text-red-800 mt-2">
                <strong>Use this URL instead:</strong>{' '}
                <a 
                  href="http://dev.procuroapp.com:5173/provider-test" 
                  className="underline font-semibold hover:text-red-600"
                >
                  http://dev.procuroapp.com:5173/provider-test
                </a>
              </p>
              <p className="text-xs text-red-700 mt-2">
                Current domain: <code className="bg-red-100 px-1 rounded">{window.location.hostname}</code>
              </p>
            </div>
          )}

          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-900 font-medium">
              ✅ All providers now use backend proxy - NO MORE CORS ERRORS!
              <span className="block mt-1">
                • Backend fetches HTML from retailers with proper User-Agents
              </span>
              <span className="block mt-1">
                • Results parsed server-side and returned as structured JSON
              </span>
              <span className="block mt-1">
                • Real prices can be tested and saved to database
              </span>
              {!envWarning && (
                <span className="block mt-1">
                  <strong>Environment:</strong> {window.location.hostname === 'dev.procuroapp.com' ? '✅ dev.procuroapp.com (Optimal)' : window.location.hostname}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Test Item Seeder */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Test Item Seeder
            </CardTitle>
            <CardDescription>
              Create test items with high prices to trigger savings alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <input
                type="text"
                placeholder="Item Name *"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="px-3 py-2 border rounded-md"
              />
              <input
                type="text"
                placeholder="Vendor Name"
                value={itemVendor}
                onChange={(e) => setItemVendor(e.target.value)}
                className="px-3 py-2 border rounded-md"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Last Paid Price * (e.g., 49.99)"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                className="px-3 py-2 border rounded-md"
              />
              <input
                type="text"
                placeholder="Category"
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className="px-3 py-2 border rounded-md"
              />
            </div>
            <Button onClick={createTestItem} disabled={creatingItem} className="mb-4">
              {creatingItem ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  Create Test Item
                </>
              )}
            </Button>

            {/* Test Items List */}
            {testItems.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Test Items ({testItems.length})</h3>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">ID</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Last Paid</th>
                        <th className="px-4 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testItems.map((item) => (
                        <tr
                          key={item.id}
                          className={`border-t ${selectedItemId === item.id ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-4 py-2">{item.id}</td>
                          <td className="px-4 py-2">{item.name}</td>
                          <td className="px-4 py-2">${item.lastPaidPrice.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <Button
                              size="sm"
                              variant={selectedItemId === item.id ? 'default' : 'outline'}
                              onClick={() => setSelectedItemId(item.id)}
                            >
                              {selectedItemId === item.id ? 'Selected' : 'Select'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Inputs & Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Test Providers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Keyword Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Search Keyword</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g., ASUDESIRE 3 Pack Men's Sweatpants"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              {/* Provider Buttons */}
              <div className="space-y-2 mb-6">
                {/* Target - Disabled */}
                {/* <Button
                  onClick={() => testProvider('Target')}
                  disabled={true}
                  className="w-full opacity-50 cursor-not-allowed"
                  variant="outline"
                  title="Target provider disabled"
                >
                  🎯 Test Target (Disabled)
                </Button> */}

                {/* HomeDepot - Disabled */}
                {/* <Button
                  onClick={() => testProvider('Home Depot')}
                  disabled={true}
                  className="w-full opacity-50 cursor-not-allowed"
                  variant="outline"
                  title="Home Depot provider disabled"
                >
                  🏠 Test Home Depot (Disabled)
                </Button> */}

                {/* Lowes - Disabled */}
                {/* <Button
                  onClick={() => testProvider('Lowes')}
                  disabled={true}
                  className="w-full opacity-50 cursor-not-allowed"
                  variant="outline"
                  title="Lowes provider disabled"
                >
                  🔨 Test Lowes (Disabled)
                </Button> */}

                {/* Staples - Disabled */}
                {/* <Button
                  onClick={() => testProvider('Staples')}
                  disabled={true}
                  className="w-full opacity-50 cursor-not-allowed"
                  variant="outline"
                  title="Staples provider disabled"
                >
                  📎 Test Staples (Disabled)
                </Button> */}

                <Button
                  onClick={() => testProvider('Office Depot')}
                  disabled={testing}
                  className="w-full"
                  variant={currentProvider === 'Office Depot' ? 'default' : 'outline'}
                >
                  {currentProvider === 'Office Depot' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing Office Depot...
                    </>
                  ) : (
                    '🖊️ Test Office Depot (Backend Proxy)'
                  )}
                </Button>

                <div className="w-full">
                  <Tooltip
                    content="Rakuten (Connected, no products yet): API is reachable and authenticated, but currently returns 0 items. This is usually due to advertiser approval or account configuration on Rakuten's side, not a code issue."
                    side="top"
                  >
                    <Button
                      onClick={() => testProvider('rakuten')}
                      disabled={testing}
                      className="w-full"
                      variant={currentProvider === 'rakuten' ? 'default' : 'outline'}
                    >
                      {currentProvider === 'rakuten' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Testing Rakuten...
                        </>
                      ) : (
                        '🎁 Test Rakuten (Standby Mode)'
                      )}
                    </Button>
                  </Tooltip>
                  <div className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Connected, no products yet</span>
                  </div>
                </div>

                <Tooltip
                  content="Staples provider is OFFICIALLY PARKED. Cannot be used without official API access and agreement with Staples. All scraping attempts are blocked."
                  side="top"
                >
                  <Button
                    onClick={() => testProvider('staples')}
                    disabled={testing}
                    className="w-full"
                    variant={currentProvider === 'staples' ? 'default' : 'outline'}
                  >
                    {currentProvider === 'staples' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing Staples...
                      </>
                    ) : (
                      '🛒 Test Staples (PARKED - Requires API Access)'
                    )}
                  </Button>
                </Tooltip>
                <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Officially Parked - Not Functional</span>
                </div>
              </div>


              {/* Save to Database */}
              {selectedItem && (
                <div className="border-t pt-4">
                  <div className="mb-2 p-2 bg-blue-50 rounded text-sm">
                    <p className="font-medium">Selected Item:</p>
                    <p className="text-gray-700">{selectedItem.name}</p>
                    <p className="text-gray-600">Last Paid: ${selectedItem.lastPaidPrice.toFixed(2)}</p>
                  </div>
                  <Button
                    onClick={saveToDatabase}
                    disabled={!result || saving}
                    className="w-full"
                    variant="default"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4 mr-2" />
                        Save Result to Database
                      </>
                    )}
                  </Button>
                  {saveSuccess && (
                    <p className="text-green-600 text-sm mt-2">
                      ✅ Saved! Check DB Inspector for updates.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column 2: Parsed Results & Debug Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Parsed Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              {result && (
                <div className="space-y-3">
                  <div className="p-4 border rounded-md bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{result.retailer}</h3>
                      {result.price ? (
                        <Badge className="bg-green-500">
                          ${result.price.toFixed(2)}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No Price</Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><strong>Title:</strong> {result.title || 'N/A'}</p>
                      <p><strong>URL:</strong> {result.url ? (
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          Link
                        </a>
                      ) : 'N/A'}</p>
                      <p><strong>Stock:</strong> {result.stock ? '✅ In Stock' : '❌ Out of Stock'}</p>
                      {result.image && (
                        <img src={result.image} alt="Product" className="mt-2 w-32 h-32 object-contain" />
                      )}
                    </div>
                  </div>

                  {/* JSON Result */}
                  <div>
                    <h4 className="font-semibold mb-2">JSON Response:</h4>
                    <pre className="p-3 bg-gray-900 text-green-400 rounded-md text-xs overflow-auto max-h-[300px]">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {!result && !error && (
                <p className="text-gray-500">No results yet. Click a provider button to test.</p>
              )}

              {/* Debug Info Panel */}
              {debugInfo && (
                <div className="mt-6 p-4 bg-gray-50 border rounded-md">
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Bug className="w-4 h-4" />
                    Debug Info
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Provider:</strong> {debugInfo.provider}</p>
                    <p><strong>URL:</strong> <span className="text-xs break-all">{debugInfo.url}</span></p>
                    <p><strong>HTML Size:</strong> {(debugInfo.htmlSize / 1024).toFixed(2)} KB ({debugInfo.htmlSize.toLocaleString()} bytes)</p>
                    <p><strong>Timestamp:</strong> {debugInfo.timestamp}</p>
                    <p>
                      <strong>Valid HTML:</strong>{' '}
                      {debugInfo.validHTML ? (
                        <span className="text-green-600 font-semibold">✅ YES</span>
                      ) : (
                        <span className="text-red-600 font-semibold">❌ NO</span>
                      )}
                    </p>
                    {debugInfo.errorMessage && (
                      <p className="text-red-600"><strong>Error:</strong> {debugInfo.errorMessage}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column 3: Raw HTML */}
          <Card>
            <CardHeader>
              <CardTitle>Raw HTML</CardTitle>
              <CardDescription>
                First 50,000 characters of retailer response
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rawHtml ? (
                <pre className="whitespace-pre-wrap overflow-auto max-h-[80vh] p-3 bg-gray-900 text-green-400 rounded-md text-xs">
                  {rawHtml.substring(0, 50000)}
                  {rawHtml.length > 50000 && '\n\n... (truncated)'}
                </pre>
              ) : (
                <p className="text-gray-500">Raw HTML will appear here after testing a provider.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
