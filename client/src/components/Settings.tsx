import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Download, CreditCard, CheckCircle2, Unplug, AlertCircle, Shield, Info } from 'lucide-react';
import { Tooltip } from './ui/tooltip';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { apiUrl, apiFetch } from '../utils/api';
import { useSubscription } from '../context/SubscriptionContext';

interface SettingsConfig {
  notificationFrequency: 'daily' | 'weekly' | 'manual';
  minPriceDropPercent: number;
  theme: 'light' | 'dark' | 'system';
  autoCheckEnabled: boolean;
}

const DEFAULT_SETTINGS: SettingsConfig = {
  notificationFrequency: 'daily',
  minPriceDropPercent: 5,
  theme: 'system',
  autoCheckEnabled: true
};

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { isSubscribed, openPortal, stripeCustomerId } = useSubscription();
  const [settings, setSettings] = useState<SettingsConfig>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qbStatus, setQbStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [qbStatusLoading, setQbStatusLoading] = useState(true);
  const [isConnectionBroken, setIsConnectionBroken] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const stored = localStorage.getItem('procuro-settings');
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    }
  }, [isOpen]);

  // Fetch QuickBooks connection status when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchQuickBooksStatus();
    }
  }, [isOpen]);

  const fetchQuickBooksStatus = async () => {
    try {
      setQbStatusLoading(true);
      const res = await apiFetch(apiUrl('/api/qb/status'));
      const data = await res.json();
      
      if (res.ok && data.success) {
        setQbStatus(data.isQuickBooksConnected ? 'connected' : 'disconnected');
        setIsConnectionBroken(data.isConnectionBroken || false);
      } else {
        setQbStatus('disconnected');
        setIsConnectionBroken(false);
      }
    } catch (error) {
      console.error('Error fetching QuickBooks status:', error);
      setQbStatus('disconnected');
      setIsConnectionBroken(false);
    } finally {
      setQbStatusLoading(false);
    }
  };

  const handleReconnectQuickBooks = async () => {
    try {
      setIsReconnecting(true);
      const res = await apiFetch(apiUrl('/api/qb/reconnect'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error('Failed to get reconnect URL', data);
        alert(data.message || 'Failed to get reconnect URL.');
        return;
      }

      // Redirect to QuickBooks OAuth
      if (data.connectUrl) {
        window.location.href = data.connectUrl;
      }
    } catch (err) {
      console.error('Error reconnecting QuickBooks', err);
      alert('An error occurred while reconnecting QuickBooks.');
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleDisconnectQuickBooks = async () => {
    if (!window.confirm('Are you sure you want to disconnect QuickBooks? This will stop importing purchases and disable automated price checks for QuickBooks data.')) {
      return;
    }

    try {
      setIsDisconnecting(true);
      const res = await apiFetch(apiUrl('/api/qb/disconnect'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error('Failed to disconnect QuickBooks', data);
        alert(data.message || 'Failed to disconnect QuickBooks.');
        return;
      }

      // Update UI state
      setQbStatus('disconnected');
      alert('QuickBooks has been disconnected successfully.');
    } catch (err) {
      console.error('Error disconnecting QuickBooks', err);
      alert('An error occurred while disconnecting QuickBooks.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSave = () => {
    localStorage.setItem('procuro-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('procuro-settings');
  };

  const handleBackup = async () => {
    setDownloading(true);
    try {
      const response = await apiFetch(apiUrl('/api/backup'));
      
      if (!response.ok) {
        throw new Error('Failed to download backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `procuro-backup-${timestamp}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Show success message
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error downloading backup:', error);
      alert('Failed to download backup. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-card rounded-xl shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Settings</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {/* Notification Frequency */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notification Frequency</CardTitle>
                <CardDescription>How often do you want to receive price alerts?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { value: 'daily', label: 'Daily', description: 'Get notified every day' },
                    { value: 'weekly', label: 'Weekly', description: 'Get a weekly summary' },
                    { value: 'manual', label: 'Manual Only', description: 'No automatic notifications' }
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="frequency"
                        value={option.value}
                        checked={settings.notificationFrequency === option.value}
                        onChange={(e) =>
                          setSettings({ ...settings, notificationFrequency: e.target.value as any })
                        }
                        className="h-4 w-4 text-primary"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Price Drop Threshold */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Minimum Price Drop %</CardTitle>
                <CardDescription>Only alert me when savings exceed this threshold</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={settings.minPriceDropPercent}
                      onChange={(e) =>
                        setSettings({ ...settings, minPriceDropPercent: Number(e.target.value) })
                      }
                      className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="w-16 text-center">
                      <span className="text-2xl font-bold text-primary">
                        {settings.minPriceDropPercent}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Current: Only show alerts with {settings.minPriceDropPercent}% or more savings
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Theme Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Theme Preference</CardTitle>
                <CardDescription>Choose your preferred color scheme</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', label: 'Light', icon: '☀️' },
                    { value: 'dark', label: 'Dark', icon: '🌙' },
                    { value: 'system', label: 'System', icon: '💻' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSettings({ ...settings, theme: option.value as any })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        settings.theme === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-3xl mb-2">{option.icon}</div>
                      <div className="font-medium">{option.label}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Auto-Check Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Automatic Price Checking</CardTitle>
                <CardDescription>Enable or disable daily automatic price checks</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors">
                  <div>
                    <div className="font-medium">Enable automatic daily price checks</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      When enabled, prices are checked automatically at 3 AM daily
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.autoCheckEnabled}
                      onChange={(e) => setSettings({ ...settings, autoCheckEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </div>
                </label>
              </CardContent>
            </Card>

            {/* Billing & Subscription */}
            {isSubscribed && stripeCustomerId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Billing & Subscription</CardTitle>
                  <CardDescription>Manage your subscription and payment methods</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">Active Subscription</p>
                        <p className="text-sm text-green-700 dark:text-green-300">$19/month - Automated Monitoring</p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <Button
                      onClick={openPortal}
                      className="w-full bg-primary hover:bg-primary/90"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Manage Billing
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Update payment methods, view invoices, or cancel your subscription
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* QuickBooks Connection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">QuickBooks Connection</CardTitle>
                <CardDescription>Manage your QuickBooks Online connection</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">Status:</p>
                      <p className="text-sm text-muted-foreground">
                        {qbStatusLoading ? (
                          'Loading...'
                        ) : qbStatus === 'connected' ? (
                          <span className="text-green-600 dark:text-green-400">Connected</span>
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            Not Connected
                            {isConnectionBroken && (
                              <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                                ⚠️ Connection Lost
                              </span>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                    {qbStatus === 'connected' && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>

                  {/* Connection Broken Warning */}
                  {isConnectionBroken && qbStatus === 'connected' && (
                    <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                              Connection Lost
                            </p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                              QuickBooks access was revoked. Please reconnect to continue monitoring.
                            </p>
                            <Button
                              onClick={handleReconnectQuickBooks}
                              disabled={isReconnecting}
                              className="mt-3"
                              size="sm"
                            >
                              {isReconnecting ? 'Connecting...' : 'Reconnect QuickBooks'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {qbStatus === 'connected' && !isConnectionBroken ? (
                    <Button
                      onClick={handleDisconnectQuickBooks}
                      disabled={isDisconnecting}
                      variant="destructive"
                      className="w-full"
                    >
                      <Unplug className="h-4 w-4 mr-2" />
                      {isDisconnecting ? 'Disconnecting...' : 'Disconnect QuickBooks'}
                    </Button>
                  ) : qbStatus === 'disconnected' && !isConnectionBroken ? (
                    <Button
                      asChild
                      className="w-full"
                    >
                      <a href={apiUrl('/api/qb/connect')}>Connect QuickBooks</a>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Data & Privacy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Data & Privacy
                </CardTitle>
                <CardDescription>Information about data we store from QuickBooks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      Data We Store From QuickBooks
                      <Tooltip content="Required for App Store approval">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Tooltip>
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li>Item name</li>
                      <li>Price paid</li>
                      <li>Vendor</li>
                      <li>Purchase date</li>
                      <li>Quantity</li>
                      <li>Last purchase date</li>
                    </ul>
                  </div>
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      <strong>Important:</strong> No account numbers are stored. No payroll or tax data is accessed. Only purchase-related data is processed.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Backup Database */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Database Backup</CardTitle>
                <CardDescription>Download a copy of your local database</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Create a backup of your local SQLite database. This includes all items, prices, alerts, and settings.
                  </p>
                  <Button
                    onClick={handleBackup}
                    disabled={downloading}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {downloading ? 'Downloading...' : 'Download Backup'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <Button variant="outline" onClick={handleReset}>
              Reset to Defaults
            </Button>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-sm text-green-600 font-medium">✓ Settings saved!</span>
              )}
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-label="Settings"
      >
        <SettingsIcon className="h-5 w-5" />
      </button>
      <SettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

