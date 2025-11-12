import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

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
  const [settings, setSettings] = useState<SettingsConfig>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);

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
      const response = await fetch('http://localhost:5000/api/backup');
      
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

