import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { apiFetch, apiUrl } from '../utils/api';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          prompt: () => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: string;
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
            }
          ) => void;
        };
      };
    };
  }
}

interface ImportRunRow {
  id: number;
  status: string;
  source: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  importedItemCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  company: { id: number; name: string | null };
  user: { id: number; email: string } | null;
}

interface CompanyAlertRow {
  companyId: number;
  companyName: string | null;
  consecutiveFailures: number;
  slowRunCount: number;
  lastSuccessAt: string | null;
  staleNoSuccess24h: boolean;
}

export function AdminOps() {
  const googleButtonContainerId = 'google-admin-signin-button';
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [runs, setRuns] = useState<ImportRunRow[]>([]);
  const [alerts, setAlerts] = useState<CompanyAlertRow[]>([]);
  const [errorBreakdown, setErrorBreakdown] = useState<Array<{ errorCode: string; count: number }>>([]);
  const [refreshing, setRefreshing] = useState(false);

  const warningCompanies = useMemo(
    () => alerts.filter((item) => item.consecutiveFailures >= 3 || item.slowRunCount > 0 || item.staleNoSuccess24h),
    [alerts]
  );

  const loadDashboard = async () => {
    setRefreshing(true);
    try {
      const [runsRes, summaryRes] = await Promise.all([
        apiFetch(apiUrl('/api/admin/import-runs?limit=100')),
        apiFetch(apiUrl('/api/admin/import-summary')),
      ]);
      if (!runsRes.ok || !summaryRes.ok) throw new Error('Unauthorized');

      const runsData = await runsRes.json();
      const summaryData = await summaryRes.json();
      setRuns(runsData.runs || []);
      setAlerts(summaryData.companyAlerts || []);
      setErrorBreakdown(summaryData.errorBreakdown || []);
      setAuthenticated(true);
    } catch (error) {
      setAuthenticated(false);
      setAuthError(error instanceof Error ? error.message : 'Failed to load admin data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        const configRes = await apiFetch(apiUrl('/api/admin/auth/config'));
        if (!configRes.ok) {
          throw new Error('Admin portal is disabled');
        }
        const config = await configRes.json();
        const clientId = String(config.googleClientId || '');
        if (!clientId) {
          throw new Error('Missing GOOGLE_ADMIN_CLIENT_ID configuration');
        }

        const sessionRes = await apiFetch(apiUrl('/api/admin/session'));
        if (sessionRes.ok) {
          const session = await sessionRes.json();
          setAdminEmail(session.email || '');
          setAuthenticated(true);
          await loadDashboard();
          setAuthReady(true);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          window.google?.accounts?.id?.initialize({
            client_id: clientId,
            callback: async (response) => {
              const idToken = response.credential;
              if (!idToken) {
                setAuthError('Google did not return an ID token');
                return;
              }
              try {
                const loginRes = await apiFetch(apiUrl('/api/admin/auth/login'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken }),
                });
                if (!loginRes.ok) throw new Error('Login failed');
                const verifyRes = await apiFetch(apiUrl('/api/admin/session'));
                if (!verifyRes.ok) throw new Error('Session verification failed');
                const verifyBody = await verifyRes.json();
                setAdminEmail(verifyBody.email || '');
                setAuthenticated(true);
                setAuthError(null);
                await loadDashboard();
              } catch (e) {
                setAuthError(e instanceof Error ? e.message : 'Admin login failed');
              }
            },
          });
          const buttonRoot = document.getElementById(googleButtonContainerId);
          if (buttonRoot && window.google?.accounts?.id?.renderButton) {
            buttonRoot.innerHTML = '';
            window.google.accounts.id.renderButton(buttonRoot, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              shape: 'rectangular',
            });
          }
          setAuthReady(true);
        };
        script.onerror = () => setAuthError('Failed to load Google Identity script');
        document.body.appendChild(script);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Failed to initialize admin portal');
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, []);

  const signOut = async () => {
    await apiFetch(apiUrl('/api/admin/auth/logout'), { method: 'POST' });
    setAuthenticated(false);
    setAdminEmail('');
    setRuns([]);
    setAlerts([]);
    setErrorBreakdown([]);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Admin Operations Login</CardTitle>
            <CardDescription>Owner-only access via Google</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authError ? (
              <div className="text-sm flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{authError}</span>
              </div>
            ) : null}
            <div id={googleButtonContainerId} />
            {!authReady ? <p className="text-sm text-muted-foreground">Loading Google sign-in...</p> : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Operations</h1>
          <p className="text-muted-foreground mt-1">Signed in as {adminEmail || 'owner'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadDashboard()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Logout
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational Warnings</CardTitle>
          <CardDescription>Consecutive failures, slow imports, stale success</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {warningCompanies.length === 0 ? (
            <p className="text-muted-foreground">No warning thresholds exceeded.</p>
          ) : (
            warningCompanies.map((item) => (
              <div key={item.companyId} className="border rounded p-2">
                <div className="font-medium">{item.companyName || `Company ${item.companyId}`}</div>
                <div className="text-muted-foreground">
                  Consecutive failures: {item.consecutiveFailures} | Slow runs: {item.slowRunCount} | Stale 24h:{' '}
                  {item.staleNoSuccess24h ? 'yes' : 'no'}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Import Runs</CardTitle>
          <CardDescription>Latest-first run history across companies</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Source</th>
                <th className="py-2 pr-2">Company</th>
                <th className="py-2 pr-2">User</th>
                <th className="py-2 pr-2">Started</th>
                <th className="py-2 pr-2">Duration</th>
                <th className="py-2 pr-2">Count</th>
                <th className="py-2 pr-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b align-top">
                  <td className="py-2 pr-2">{run.status}</td>
                  <td className="py-2 pr-2">{run.source}</td>
                  <td className="py-2 pr-2">{run.company?.name || `#${run.company?.id}`}</td>
                  <td className="py-2 pr-2">{run.user?.email || 'system'}</td>
                  <td className="py-2 pr-2">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="py-2 pr-2">{run.durationMs ?? 0} ms</td>
                  <td className="py-2 pr-2">{run.importedItemCount}</td>
                  <td className="py-2 pr-2">{run.errorCode || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Error Code Breakdown</CardTitle>
          <CardDescription>Recent normalized import failures</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {errorBreakdown.length === 0 ? (
            <p className="text-muted-foreground">No recent import errors.</p>
          ) : (
            errorBreakdown.map((row) => (
              <div key={row.errorCode}>
                {row.errorCode}: <strong>{row.count}</strong>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
