import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Unplug, AlertCircle, User, BookOpen } from 'lucide-react';
import { useGuide } from '../context/GuideContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { apiUrl, apiFetch } from '../utils/api';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const guide = useGuide();
  const [qbStatus, setQbStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [qbStatusLoading, setQbStatusLoading] = useState(true);
  const [isConnectionBroken, setIsConnectionBroken] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

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
        setCompanyName(data.companyName || null);
        // Note: lastSync would need to be added to the API response if available
        setLastSync(null);
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

      // Update status immediately
      setQbStatus('disconnected');
      setIsConnectionBroken(false);
      setCompanyName(null);
      setLastSync(null);
      setShowDisconnectConfirm(false);
      
      // Refresh the page to update Dashboard CTA
      window.location.reload();
    } catch (err) {
      console.error('Error disconnecting QuickBooks', err);
      alert('An error occurred while disconnecting QuickBooks.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getStatusDisplay = () => {
    if (qbStatusLoading) {
      return { text: 'Loading...', color: 'text-muted-foreground' };
    }
    
    if (isConnectionBroken && qbStatus === 'connected') {
      return { text: 'Connection Needs Attention', color: 'text-yellow-600 dark:text-yellow-400' };
    }
    
    if (qbStatus === 'connected') {
      return { text: 'Connected', color: 'text-green-600 dark:text-green-400' };
    }
    
    return { text: 'Not Connected', color: 'text-gray-600 dark:text-gray-400' };
  };

  const statusDisplay = getStatusDisplay();

  if (!isOpen) return null;

  const modalContent = (
    <>
      <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 99999, position: 'fixed' }}>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
          style={{ zIndex: 99999, position: 'fixed' }}
        />

        {/* Modal */}
        <div className="relative flex min-h-full items-center justify-center p-4" style={{ zIndex: 100000, position: 'relative' }}>
          <div
            className="relative w-full max-w-2xl bg-card rounded-xl shadow-lg transform transition-all"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-2xl font-bold">Account & Integrations</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your QuickBooks connection
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">

          <div className="space-y-6">
            {/* QuickBooks Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">QuickBooks</CardTitle>
                <CardDescription>Manage your QuickBooks Online connection</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Status Display */}
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">Status:</p>
                      <p className={`text-sm ${statusDisplay.color} flex items-center gap-2 mt-1`}>
                        {statusDisplay.text}
                        {isConnectionBroken && qbStatus === 'connected' && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                            ⚠️ Connection Lost
                          </span>
                        )}
                      </p>
                      {companyName && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Company: {companyName}
                        </p>
                      )}
                      {lastSync && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last sync: {lastSync}
                        </p>
                      )}
                    </div>
                    {qbStatus === 'connected' && !isConnectionBroken && (
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
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Action Buttons */}
                  {qbStatus === 'connected' && !isConnectionBroken ? (
                    <Button
                      onClick={() => setShowDisconnectConfirm(true)}
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
                  ) : isConnectionBroken ? (
                    <Button
                      onClick={handleReconnectQuickBooks}
                      disabled={isReconnecting}
                      className="w-full"
                    >
                      {isReconnecting ? 'Connecting...' : 'Reconnect QuickBooks'}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* User Guide link */}
            {guide && (
              <div className="pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    guide.openGuide();
                  }}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <BookOpen className="h-4 w-4" />
                  User Guide — icons and how to use Procuro
                </button>
              </div>
            )}
          </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Dialog */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 100001, position: 'fixed' }}>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowDisconnectConfirm(false)}
            aria-hidden="true"
            style={{ zIndex: 100001, position: 'fixed' }}
          />

          {/* Modal */}
          <div className="relative flex min-h-full items-center justify-center p-4" style={{ zIndex: 100002, position: 'relative' }}>
            <div
              className="relative w-full max-w-md bg-card rounded-xl shadow-lg transform transition-all"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">Disconnect QuickBooks?</h3>
                  <p className="text-sm text-muted-foreground">
                    This will stop price monitoring and alerts until you reconnect.
                    Your data will not be deleted.
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDisconnectConfirm(false)}
                    disabled={isDisconnecting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnectQuickBooks}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(modalContent, document.body);
}

export function AccountButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-label="Account & Integrations"
        title="Account & Integrations"
      >
        <User className="h-5 w-5" />
      </button>
      <AccountModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

