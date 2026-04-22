import { AlertTriangle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, apiUrl } from '../utils/api';
import { useState, useEffect } from 'react';
import { TestUserSwitcher } from './TestUserSwitcher';

export function TestModeBanner() {
  const [testMode, setTestMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTestMode = async () => {
      try {
        const res = await apiFetch(apiUrl('/api/test/status'));
        const data = await res.json();
        setTestMode(data.testMode || false);
      } catch (error) {
        // If test endpoint doesn't exist or fails, assume not in test mode
        setTestMode(false);
      } finally {
        setLoading(false);
      }
    };

    checkTestMode();
  }, []);

  if (loading || !testMode) {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
      <div className="container mx-auto flex flex-wrap items-center gap-4 text-amber-800 dark:text-amber-200">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">⚠️ TEST MODE ACTIVE</p>
          <p className="text-xs">View-as switcher and Test Admin available. Use Test Admin to setup and import sample data.</p>
        </div>
        <Link
          to="/test-admin"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline"
        >
          <Settings className="w-3.5 h-3.5" />
          Test Admin (Setup & Import)
        </Link>
        <TestUserSwitcher />
      </div>
    </div>
  );
}

