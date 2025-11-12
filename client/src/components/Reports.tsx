import { useState, useEffect } from 'react';
import { BarChart3, Download, TrendingUp, Package, Bell, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { LoadingState } from './ui/spinner';
import { EmptyState } from './ui/empty-state';

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
  item: {
    name: string;
  };
}

export function Reports() {
  const [summary, setSummary] = useState<SavingsSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, alertsRes] = await Promise.all([
        fetch('http://localhost:5000/api/savings-summary'),
        fetch('http://localhost:5000/api/alerts')
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
        <Button onClick={exportToCSV} className="bg-primary hover:bg-primary/90">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

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

