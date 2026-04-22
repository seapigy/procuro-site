import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, apiUrl, setTestUserEmail } from '../utils/api';

interface TestUser {
  email: string;
  name: string;
  companyId: number | null;
  companyName: string | null;
}

export function TestUserSwitcher() {
  const [users, setUsers] = useState<TestUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string>(() => {
    try {
      return sessionStorage.getItem('testUserEmail') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setFetchError(null);
        const res = await apiFetch(apiUrl('/api/test/users'));
        if (cancelled) return;
        if (res.status === 403) {
          setFetchError('Test mode off on server (set TEST_MODE=true)');
          setUsers([]);
          return;
        }
        if (!res.ok) {
          setFetchError(`Could not load test users (${res.status})`);
          setUsers([]);
          return;
        }
        const data = await res.json();
        if (Array.isArray(data.users)) setUsers(data.users);
        else setUsers([]);
      } catch {
        if (!cancelled) {
          setFetchError('Network error loading test users');
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (email: string) => {
    const value = email || '';
    setTestUserEmail(value || null);
    setCurrentEmail(value);
    window.location.reload();
  };

  if (loading) {
    return (
      <span className="text-xs text-amber-700 dark:text-amber-300 whitespace-nowrap">Loading users…</span>
    );
  }

  if (fetchError) {
    return (
      <span className="text-xs text-amber-900 dark:text-amber-100 whitespace-nowrap" title={fetchError}>
        View as: {fetchError}
      </span>
    );
  }

  if (users.length === 0) {
    return (
      <span className="text-xs text-amber-800 dark:text-amber-200 max-w-[220px]">
        No test users found.{' '}
        <Link to="/test-admin" className="underline font-medium">
          Test Admin → Setup
        </Link>
      </span>
    );
  }

  const displayValue = currentEmail || '';
  const defaultLabel =
    users[0]?.companyName != null && users[0].companyName !== ''
      ? users[0].companyName
      : `company ${users[0]?.companyId ?? '?'}`;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="test-user-switcher" className="text-xs font-medium text-amber-800 dark:text-amber-200 whitespace-nowrap">
        View as:
      </label>
      <select
        id="test-user-switcher"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded px-2 py-1 text-xs text-amber-900 dark:text-amber-100 focus:ring-1 focus:ring-amber-500 max-w-[240px]"
      >
        <option value="">Default test user ({defaultLabel})</option>
        {users.map((u) => (
          <option key={u.email} value={u.email}>
            {u.name} – {u.companyName ?? 'No company'}
          </option>
        ))}
      </select>
    </div>
  );
}
