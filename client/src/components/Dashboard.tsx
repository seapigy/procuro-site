import { useState, useEffect } from 'react';
import { Package, Bell, ShoppingCart, AlertCircle, ExternalLink, TrendingUp, DollarSign, Target, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ThemeToggle } from './theme-toggle';
import { LoadingState } from './ui/spinner';
import { EmptyState } from './ui/empty-state';

interface Item {
  id: number;
  name: string;
  category: string | null;
  lastPaidPrice: number;
  upc: string | null;
  createdAt: string;
  prices?: Price[];
}

interface Price {
  id: number;
  retailer: string;
  price: number;
  date: string;
}

interface Alert {
  id: number;
  retailer: string;
  newPrice: number;
  oldPrice: number;
  url: string | null;
  savingsPerOrder: number;
  estimatedMonthlySavings: number;
  alertDate: string;
  item: {
    name: string;
  };
}

interface SavingsSummary {
  totalMonthlySavings: number;
  totalItemsMonitored: number;
  alertsThisMonth: number;
  topSavingsItem: {
    name: string;
    savingsPerOrder: number;
    estimatedMonthlySavings: number;
    retailer: string;
    url: string | null;
  } | null;
  estimatedAnnualSavings: number;
}

export function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [savingsSummary, setSavingsSummary] = useState<SavingsSummary | null>(null);
  const [savingsLoading, setSavingsLoading] = useState(true);

  useEffect(() => {
    fetchData();
    fetchUnreadCount();
    fetchSavingsSummary();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, alertsRes] = await Promise.all([
        fetch('/api/items'),
        fetch('/api/alerts'),
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
      const res = await fetch('/api/alerts/unreadCount');
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
      const res = await fetch('/api/savings-summary');
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

  const handleBellClick = async () => {
    // Switch to alerts tab
    setActiveTab('alerts');

    // Mark all as seen
    try {
      const res = await fetch('/api/alerts/markAllSeen', {
        method: 'POST',
      });
      if (res.ok) {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking alerts as seen:', error);
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

  return (
    <div className="min-h-full bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center px-4">
          <div className="mr-4 flex">
            <ShoppingCart className="mr-2 h-6 w-6 text-primary" />
            <span className="text-xl font-bold">ProcuroApp</span>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <span className="text-sm text-muted-foreground">Price Monitoring Dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Notification Bell */}
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
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="container mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Sidebar - Tracked Items */}
          <div className="lg:col-span-3">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5" />
                  Tracked Items
                </CardTitle>
                <CardDescription>
                  {items.length} items monitored
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <LoadingState text="Loading items..." />
                ) : items.length === 0 ? (
                  <div className="py-8">
                    <EmptyState
                      icon={Package}
                      title="No items yet"
                      description="Connect your QuickBooks account to start tracking items and finding savings."
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border p-3 hover:bg-accent/50 transition-all cursor-pointer group"
                      >
                        <div className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                          {item.name}
                        </div>
                        {item.category && (
                          <Badge variant="secondary" className="mb-2 text-xs">
                            {item.category}
                          </Badge>
                        )}
                        <div className="text-lg font-bold text-primary">
                          {formatPrice(item.lastPaidPrice)}
                        </div>
                        {item.prices && item.prices.length > 0 && (
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{item.prices.length} price point{item.prices.length !== 1 ? 's' : ''}</span>
                            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Panel - Tabs */}
          <div className="lg:col-span-6">
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
                    <TabsTrigger value="savings">Savings</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-4">
                    {loading ? (
                      <LoadingState text="Loading alerts..." />
                    ) : alerts.length === 0 ? (
                      <EmptyState
                        icon={Bell}
                        title="No alerts yet"
                        description="Price alerts will appear here when tracked items have significant price changes. We monitor prices daily across major retailers."
                      />
                    ) : (
                      <div className="space-y-4">
                        {alerts.slice(0, 5).map((alert) => (
                          <div
                            key={alert.id}
                            className="flex items-start gap-4 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                          >
                            <div className="rounded-full bg-primary/10 p-2">
                              <Bell className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="font-medium leading-none">
                                {alert.item.name}
                              </p>
                              <div className="flex items-center gap-2 text-sm">
                                <Badge variant="outline">{alert.retailer}</Badge>
                                <span className="text-muted-foreground">•</span>
                                <span className="font-semibold text-green-600 dark:text-green-500">
                                  {formatPrice(alert.newPrice)}
                                </span>
                                <span className="text-muted-foreground text-xs line-through">
                                  {formatPrice(alert.oldPrice)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-green-600 dark:text-green-500">
                                  Save {formatPrice(alert.savingsPerOrder)}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">
                                  ~{formatPrice(alert.estimatedMonthlySavings)}/mo
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(alert.alertDate)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="alerts">
                    {loading ? (
                      <LoadingState text="Loading alerts..." />
                    ) : alerts.length === 0 ? (
                      <EmptyState
                        icon={Bell}
                        title="No alerts yet"
                        description="Price alerts will appear here when tracked items have better prices available. We check prices from Amazon, Walmart, and other major retailers."
                      />
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item Name</TableHead>
                              <TableHead>Retailer</TableHead>
                              <TableHead>Old Price</TableHead>
                              <TableHead>New Price</TableHead>
                              <TableHead>Savings</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {alerts.map((alert) => (
                              <TableRow key={alert.id}>
                                <TableCell className="font-medium">
                                  {alert.item.name}
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
                                    <div className="text-xs text-muted-foreground">
                                      ~{formatPrice(alert.estimatedMonthlySavings)}/month
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
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
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="savings">
                    {savingsLoading ? (
                      <LoadingState text="Calculating savings..." />
                    ) : !savingsSummary ? (
                      <EmptyState
                        icon={DollarSign}
                        title="No savings data available"
                        description="Savings data will appear once items are tracked and price alerts are created. Connect QuickBooks to get started."
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
                              {savingsSummary.alertsThisMonth} {savingsSummary.alertsThisMonth === 1 ? 'alert' : 'alerts'}
                            </span>
                            found this month
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
                            <p className="text-xs text-muted-foreground mt-2">Projected yearly savings</p>
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
                            <p className="text-xs text-muted-foreground mt-2">Total tracked items</p>
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
                            <p className="text-xs text-muted-foreground mt-2">Last 30 days</p>
                          </div>
                        </div>

                        {/* Top Savings Item */}
                        {savingsSummary.topSavingsItem && (
                          <div className="rounded-lg border p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Target className="h-5 w-5 text-primary" />
                              <h3 className="text-sm font-semibold">Top Savings Opportunity</h3>
                            </div>
                            <div className="space-y-2">
                              <p className="font-medium">{savingsSummary.topSavingsItem.name}</p>
                              <div className="flex items-center gap-4 text-sm">
                                <Badge variant="outline">{savingsSummary.topSavingsItem.retailer}</Badge>
                                <span className="text-green-600 dark:text-green-500 font-semibold">
                                  Save {formatPrice(savingsSummary.topSavingsItem.savingsPerOrder)} per order
                                </span>
                                <span className="text-muted-foreground">
                                  ~{formatPrice(savingsSummary.topSavingsItem.estimatedMonthlySavings)}/month
                                </span>
                              </div>
                              {savingsSummary.topSavingsItem.url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  className="mt-2"
                                >
                                  <a
                                    href={savingsSummary.topSavingsItem.url}
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
                          </div>
                        )}

                        {/* Placeholder for Future Chart */}
                        <div className="rounded-lg border border-dashed p-8 text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                            <TrendingUp className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <h3 className="font-semibold mb-2">Savings Trend Chart</h3>
                          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                            Historical savings visualization coming soon. Track your savings over time.
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Connected Retailers */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Connected Retailers</CardTitle>
                <CardDescription>Integration status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <RetailerStatus
                    name="Amazon"
                    status="pending"
                    statusText="Awaiting API Activation"
                  />
                  <RetailerStatus
                    name="Best Buy"
                    status="inactive"
                    statusText="Not Connected"
                  />
                  <RetailerStatus
                    name="Walmart"
                    status="inactive"
                    statusText="Not Connected"
                  />
                </div>

                <div className="mt-6 p-4 rounded-lg bg-muted">
                  <h4 className="font-semibold text-sm mb-2">QuickBooks</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Connect your QuickBooks account to import purchase history
                  </p>
                  <a
                    href="/api/qb/connect"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 w-full"
                  >
                    Connect QuickBooks
                  </a>
                </div>
              </CardContent>
            </Card>
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
            © 2025 Procuro. All rights reserved. | Last synced with QuickBooks: {new Date().toLocaleString()}
          </div>
        </footer>
      </div>
    </div>
  );
}

interface RetailerStatusProps {
  name: string;
  status: 'active' | 'pending' | 'inactive';
  statusText: string;
}

function RetailerStatus({ name, status, statusText }: RetailerStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'inactive':
        return 'bg-gray-300 dark:bg-gray-700';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${getStatusColor()}`} />
        <div>
          <div className="font-medium text-sm">{name}</div>
          <div className="text-xs text-muted-foreground">{statusText}</div>
        </div>
      </div>
    </div>
  );
}
