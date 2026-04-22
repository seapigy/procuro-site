import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, FileText, Users, Bell, BarChart3, ExternalLink } from 'lucide-react';
import { Dashboard } from '../components/Dashboard';
import { TestModeBanner } from '../components/TestModeBanner';
import { apiUrl, apiFetchWithTimeout } from '../utils/api';

const ACTIVATION_FETCH_MS = 20000;

export function QuickBooksShell() {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [activationChecked, setActivationChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsEmbedded(window?.top !== window?.self);
  }, []);

  useEffect(() => {
    const checkActivation = async () => {
      try {
        const res = await apiFetchWithTimeout(
          apiUrl('/api/company/activation'),
          {},
          ACTIVATION_FETCH_MS
        );
        const data = await res.json();
        if (data.nextStep && data.nextStep !== 'READY') {
          navigate('/activate', { replace: true });
          return;
        }
      } catch {
        // On error or timeout, allow through (e.g. no company yet / API unreachable)
      }
      setActivationChecked(true);
    };
    checkActivation();
  }, [navigate]);

  useEffect(() => {
    if (activationChecked) {
      const t = setTimeout(() => setIsReady(true), 300);
      return () => clearTimeout(t);
    }
  }, [activationChecked]);

  if (!activationChecked || !isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F8]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#0077C5] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#0077C5] font-medium">Loading Procura...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen font-[system-ui] bg-[#F4F5F8] ${isEmbedded ? 'p-2' : ''}`}>
      {/* QuickBooks Sidebar */}
      <aside className={`${isEmbedded ? 'w-16' : 'w-60'} bg-white border-r border-[#DFE5EB] flex flex-col transition-all duration-300`}>
        {/* QuickBooks Logo */}
        <div className={`px-4 py-4 ${isEmbedded ? 'px-2' : ''}`}>
          {isEmbedded ? (
            <div className="w-8 h-8 bg-[#0077C5] rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">QB</span>
            </div>
          ) : (
            <h1 className="text-lg font-semibold text-[#0077C5]">QuickBooks</h1>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${isEmbedded ? 'px-1' : 'px-2'} space-y-1 text-sm`}>
          <NavItem icon={Home} label="Dashboard" embedded={isEmbedded} />
          {!isEmbedded && <NavItem icon={FileText} label="Expenses" />}
          {!isEmbedded && <NavItem icon={Users} label="Vendors" />}
          <NavItem 
            icon={Bell} 
            label="Procurement Alerts" 
            active 
            embedded={isEmbedded}
          />
          {!isEmbedded && <NavItem icon={BarChart3} label="Reports" />}
        </nav>

        {/* Footer - Company Info */}
        {!isEmbedded && (
          <div className="px-4 py-3 border-t border-[#DFE5EB] text-xs text-gray-500">
            <p>Demo Corp</p>
            <p className="mt-1">Fiscal Year 2024</p>
          </div>
        )}

        {/* Open in Browser View Link (embedded only) */}
        {isEmbedded && (
          <div className="px-2 py-3 border-t border-[#DFE5EB]">
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-[#0077C5] hover:text-[#005a9e] transition-colors"
              title="Open in Browser View"
            >
              <ExternalLink className="w-3 h-3" />
              {!isEmbedded && <span>Open in Browser</span>}
            </a>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-[#F4F5F8]">
        {/* Test Mode Banner */}
        <TestModeBanner />
        {/* Procuro Dashboard Content - Dashboard has its own header */}
        <main className="flex-1 overflow-auto p-0">
          <Dashboard />
        </main>
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  embedded?: boolean;
}

function NavItem({ icon: Icon, label, active = false, embedded = false }: NavItemProps) {
  return (
    <button
      className={`
        w-full flex items-center ${embedded ? 'justify-center' : 'gap-3'} ${embedded ? 'px-2' : 'px-3'} py-2 rounded-md text-sm font-medium transition-colors relative
        ${active 
          ? 'bg-[#E3F2FD] text-[#0077C5] before:content-[""] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-[#0077C5] before:rounded-r' 
          : 'text-[#1A1A1A] hover:bg-[#F1F7FB]'
        }
      `}
      title={embedded ? label : undefined}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!embedded && <span className="flex-1 text-left">{label}</span>}
    </button>
  );
}
