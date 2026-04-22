import { useState, useEffect } from 'react';
import { BarChart3, Download, TrendingUp, Package, Bell, DollarSign, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { LoadingState } from './ui/spinner';
import { EmptyState } from './ui/empty-state';
import { apiUrl, apiFetch } from '../utils/api';
import { useSubscription } from '../context/SubscriptionContext';
import { useUpgradeModal } from './UpgradeModalProvider';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SavingsSummary {
  totalMonthlySavings: number;
  totalItemsMonitored: number;
  alertsThisMonth: number;
  topSavingsItem: {
    name: string;
    savingsPerOrder: number;
    estimatedMonthlySavings: number;
    retailer: string;
  } | null;
  estimatedAnnualSavings: number;
}

interface Alert {
  id: number;
  retailer: string;
  newPrice: number;
  oldPrice: number;
  savingsPerOrder: number;
  estimatedMonthlySavings: number;
  alertDate: string;
  item: {
    name: string;
  };
}

export function Reports() {
  const { isSubscribed } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const [summary, setSummary] = useState<SavingsSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, alertsRes] = await Promise.all([
        apiFetch(apiUrl('/api/savings-summary')),
        apiFetch(apiUrl('/api/alerts'))
      ]);

      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate vendor savings
  const vendorSavings = alerts.reduce((acc, alert) => {
    const vendor = alert.retailer;
    if (!acc[vendor]) {
      acc[vendor] = 0;
    }
    acc[vendor] += alert.estimatedMonthlySavings;
    return acc;
  }, {} as Record<string, number>);

  const topVendors = Object.entries(vendorSavings)
    .map(([name, savings]) => ({ name, savings }))
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 5);

  // Prepare monthly savings data for bar chart
  const monthlySavingsData = alerts.reduce((acc, alert) => {
    const month = new Date(alert.alertDate).toLocaleDateString('en-US', { month: 'short' });
    if (!acc[month]) {
      acc[month] = 0;
    }
    acc[month] += alert.estimatedMonthlySavings;
    return acc;
  }, {} as Record<string, number>);

  const monthlyChartData = [
    { month: 'Jan', savings: monthlySavingsData['Jan'] || 0 },
    { month: 'Feb', savings: monthlySavingsData['Feb'] || 0 },
    { month: 'Mar', savings: monthlySavingsData['Mar'] || 0 },
    { month: 'Apr', savings: monthlySavingsData['Apr'] || 0 },
    { month: 'May', savings: monthlySavingsData['May'] || 0 },
    { month: 'Jun', savings: monthlySavingsData['Jun'] || 0 },
    { month: 'Jul', savings: monthlySavingsData['Jul'] || 0 },
    { month: 'Aug', savings: monthlySavingsData['Aug'] || 0 },
    { month: 'Sep', savings: monthlySavingsData['Sep'] || 0 },
    { month: 'Oct', savings: monthlySavingsData['Oct'] || 0 },
    { month: 'Nov', savings: monthlySavingsData['Nov'] || 0 },
    { month: 'Dec', savings: monthlySavingsData['Dec'] || 0 },
  ];

  // Prepare price drop timeline data
  const priceDropTimeline = alerts
    .map(alert => ({
      date: new Date(alert.alertDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dropPercent: ((alert.oldPrice - alert.newPrice) / alert.oldPrice) * 100,
      itemName: alert.item.name,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 30); // Last 30 alerts

  // Prepare category data for donut chart
  const categoryData = alerts.reduce((acc, alert) => {
    // We need to get category from item - for now use a placeholder
    const category = 'Uncategorized'; // TODO: Get from item.category
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += alert.estimatedMonthlySavings;
    return acc;
  }, {} as Record<string, number>);

  const categoryChartData = Object.entries(categoryData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const COLORS = ['#2D8CFF', '#51C39C', '#FFB84D', '#FF6B6B', '#9B59B6'];

  const exportToCSV = () => {
    if (alerts.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Item Name', 'Retailer', 'Old Price', 'New Price', 'Savings Per Order', 'Est. Monthly Savings'];
    const rows = alerts.map(a => [
      a.item.name,
      a.retailer,
      `$${a.oldPrice.toFixed(2)}`,
      `$${a.newPrice.toFixed(2)}`,
      `$${a.savingsPerOrder.toFixed(2)}`,
      `$${a.estimatedMonthlySavings.toFixed(2)}`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `procuro-savings-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingState text="Loading reports..." />;
  }

  if (!summary || alerts.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No report data available"
        description="Reports will appear once you have items tracked and price alerts generated."
      />
    );
  }

  // Calculate top 5 items by savings
  const topItems = [...alerts]
    .sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Comprehensive view of your savings and opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          {!isSubscribed && (
            <Button
              onClick={openUpgradeModal}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Upgrade to View Reports
            </Button>
          )}
          <Button onClick={exportToCSV} className="bg-primary hover:bg-primary/90" disabled={!isSubscribed}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Upgrade Banner for Non-Subscribers */}
      {!isSubscribed && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Subscription Required</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Upgrade to unlock full reports and analytics. View historical savings, export data, and access advanced insights.
              </p>
            </div>
            <Button onClick={openUpgradeModal} className="bg-blue-600 hover:bg-blue-700 text-white">
              Upgrade Now
            </Button>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Savings</p>
                <p className="text-2xl font-bold text-primary">
                  ${summary.totalMonthlySavings.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-3">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Annual Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  ${summary.estimatedAnnualSavings.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-3">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Items Tracked</p>
                <p className="text-2xl font-bold text-blue-600">
                  {summary.totalItemsMonitored}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-100 p-3">
                <Bell className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold text-orange-600">
                  {summary.alertsThisMonth}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Savings Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Savings Summary
          </CardTitle>
          <CardDescription>Total savings by month</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              <Bar dataKey="savings" fill="#2D8CFF" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Price Drop Timeline */}
      {priceDropTimeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Price Drop Timeline
            </CardTitle>
            <CardDescription>Price reduction percentage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={priceDropTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Drop %', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                <Line type="monotone" dataKey="dropPercent" stroke="#51C39C" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Category Donut Chart */}
      {categoryChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Spend by Category
            </CardTitle>
            <CardDescription>Savings breakdown by item category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top 5 Savings Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top 5 Items by Monthly Savings
          </CardTitle>
          <CardDescription>Your best opportunities for cost reduction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topItems.map((alert, index) => (
              <div key={alert.id} className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{alert.item.name}</p>
                  <p className="text-sm text-muted-foreground">{alert.retailer}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    ${alert.estimatedMonthlySavings.toFixed(2)}/mo
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Save ${alert.savingsPerOrder.toFixed(2)} per order
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Vendors Chart */}
      {topVendors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Vendors by Savings
            </CardTitle>
            <CardDescription>Which retailers offer the best prices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topVendors.map((vendor, index) => {
                const maxSavings = topVendors[0].savings;
                const percentage = (vendor.savings / maxSavings) * 100;
                return (
                  <div key={vendor.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {index + 1}
                        </span>
                        <span className="font-medium">{vendor.name}</span>
                      </div>
                      <span className="font-bold text-green-600">
                        ${vendor.savings.toFixed(2)}/mo
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-green-600 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Savings Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Savings Breakdown</CardTitle>
            <CardDescription>How your savings add up</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Total Opportunities Found</span>
                <span className="font-bold">{alerts.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Average Savings per Alert</span>
                <span className="font-bold text-green-600">
                  ${(summary.totalMonthlySavings / alerts.length).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Highest Single Savings</span>
                <span className="font-bold text-green-600">
                  ${Math.max(...alerts.map(a => a.savingsPerOrder)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Items with 10%+ Savings</span>
                <span className="font-bold">
                  {alerts.filter(a => a.savingsPerOrder / a.oldPrice >= 0.1).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ROI Projection</CardTitle>
            <CardDescription>Estimated return over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">3 Months</span>
                  <span className="font-bold text-green-600">
                    ${(summary.totalMonthlySavings * 3).toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-600" style={{ width: '25%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">6 Months</span>
                  <span className="font-bold text-green-600">
                    ${(summary.totalMonthlySavings * 6).toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-600" style={{ width: '50%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">1 Year</span>
                  <span className="font-bold text-green-600">
                    ${summary.estimatedAnnualSavings.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-600" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

