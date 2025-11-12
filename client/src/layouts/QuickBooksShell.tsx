import { Home, FileText, Users, Bell, BarChart3, Settings } from 'lucide-react';
import { Dashboard } from '../components/Dashboard';

export function QuickBooksShell() {
  return (
    <div className="flex h-screen font-[system-ui] bg-[#F4F5F8]">
      {/* QuickBooks Sidebar */}
      <aside className="w-60 bg-white border-r border-[#DFE5EB] flex flex-col">
        {/* QuickBooks Logo */}
        <div className="px-4 py-4">
          <h1 className="text-lg font-semibold text-[#0077C5]">QuickBooks</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-1 text-sm">
          <NavItem icon={Home} label="Dashboard" />
          <NavItem icon={FileText} label="Expenses" />
          <NavItem icon={Users} label="Vendors" />
          <NavItem 
            icon={Bell} 
            label="Procurement Alerts" 
            active 
          />
          <NavItem icon={BarChart3} label="Reports" />
          <NavItem icon={Settings} label="Settings" />
        </nav>

        {/* Footer - Company Info */}
        <div className="px-4 py-3 border-t border-[#DFE5EB] text-xs text-gray-500">
          <p>Demo Corp</p>
          <p className="mt-1">Fiscal Year 2024</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-[#F4F5F8]">
        {/* Top Bar */}
        <header className="flex items-center justify-between bg-white border-b border-[#DFE5EB] px-6 py-3">
          <h2 className="text-xl font-medium text-gray-900">Procure & Save</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">ACME Corp</span>
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600">AC</span>
            </div>
          </div>
        </header>

        {/* Procuro Dashboard Content */}
        <main className="flex-1 overflow-auto p-6">
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
}

function NavItem({ icon: Icon, label, active = false }: NavItemProps) {
  return (
    <button
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative
        ${active 
          ? 'bg-[#E3F2FD] text-[#0077C5] before:content-[""] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-[#0077C5] before:rounded-r' 
          : 'text-[#1A1A1A] hover:bg-[#F1F7FB]'
        }
      `}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}
