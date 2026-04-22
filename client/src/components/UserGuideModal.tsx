import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Bell,
  Package,
  BarChart3,
  User,
  Settings,
  ExternalLink,
  Shield,
  Lock,
  Play,
  Pause,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Info,
  AlertCircle,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Flame,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  MoreVertical,
  Sparkles,
  CreditCard,
  Unplug,
  Sun,
  Moon,
  Download,
} from 'lucide-react';
import { Modal } from './ui/modal';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Renders the icon (when provided) plus the descriptive name for the Icon column. */
function IconCell({ icon: Icon, label, iconClassName }: { icon?: LucideIcon; label: string; iconClassName?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {Icon ? <Icon className={`h-4 w-4 shrink-0 ${iconClassName ?? 'text-foreground'}`} /> : null}
      <span>{label}</span>
    </span>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto my-3 rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-medium text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/70 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-muted-foreground align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UserGuideModal({ isOpen, onClose }: UserGuideModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Guide" maxWidth="xl">
      <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6 text-sm">
        <p className="text-muted-foreground">
          This guide explains how to use Procuro and what the icons and indicators in the app mean.
        </p>

        <section>
          <h3 className="text-base font-semibold text-foreground mb-2">Icons and What They Mean</h3>

          <h4 className="text-sm font-medium text-foreground mt-4 mb-2">Navigation and main areas</h4>
          <p className="text-muted-foreground mb-2">
            When the app is inside QuickBooks, the <strong>left sidebar</strong> is QuickBooks'
            (Dashboard, Procurement Alerts, and optionally Expenses, Vendors, Reports). The{' '}
            <strong>main Procuro area</strong> has the price-monitoring dashboard with a{' '}
            <strong>Tracked Items</strong> list on the left and <strong>Overview</strong> /{' '}
            <strong>Alerts</strong> tabs on the right.
          </p>
          <Table
            headers={['Icon', 'Where you see it', 'Meaning']}
            rows={[
              [<IconCell key="home" icon={Home} label="Home" />, 'Left sidebar (QuickBooks shell)', 'Opens the main Procuro dashboard.'],
              [<IconCell key="bell" icon={Bell} label="Bell" />, 'Header (top right), Alerts tab', 'Price-drop alerts. The badge number is how many unread alerts you have. Clicking the bell switches to the Alerts tab.'],
              [<IconCell key="pkg" icon={Package} label="Package" />, 'Tracked Items section, Overview metrics', 'Represents a product/item you\'re tracking.'],
              [<IconCell key="bar" icon={BarChart3} label="Bar chart" />, 'Left sidebar (when not embedded)', 'QuickBooks "Reports" entry; Procuro\'s own reports may appear in the main area depending on deployment.'],
              [<IconCell key="user" icon={User} label="User" />, 'Header (top right)', 'Opens Account & Integrations (QuickBooks connection, disconnect, company).'],
              [<IconCell key="settings" icon={Settings} label="Settings (gear)" />, 'Some views (e.g. standalone)', 'App settings, backup; when present, use for preferences.'],
              [<IconCell key="ext" icon={ExternalLink} label="External link" />, 'Alerts, match editor, "Open in Browser" (embedded)', 'Opens a retailer product page, or opens the app in a full browser window when embedded.'],
            ]}
          />
        </section>

        <section>
          <h4 className="text-sm font-medium text-foreground mt-4 mb-2">Item and monitoring status (next to each tracked item)</h4>
          <p className="text-muted-foreground mb-2">
            These appear next to item names in the <strong>Tracked Items</strong> list (left panel on the dashboard).
          </p>
          <Table
            headers={['Icon', 'Meaning']}
            rows={[
              [<IconCell key="shield-blue" icon={Shield} label="Shield (blue)" iconClassName="text-blue-600" />, 'This item is actively monitored in daily price checks. You\'ll see a priority score in the tooltip.'],
              [<IconCell key="shield-gray" icon={Shield} label="Shield (gray)" iconClassName="text-gray-400" />, 'Not monitored — either paused, or the name is too vague to monitor, or it\'s not in the top priority list. Hover for the exact reason.'],
              [<IconCell key="lock" icon={Lock} label="Lock (gray)" iconClassName="text-gray-400" />, 'Subscription required — monitoring would be on but you need an active subscription to enable it.'],
              [<IconCell key="play" icon={Play} label="Play" />, 'Resume monitoring — use this (e.g. from the ⋮ menu) to turn price checks back on for this item.'],
              [<IconCell key="pause" icon={Pause} label="Pause" />, 'Pause monitoring — use this to temporarily stop price checks for this item.'],
              [<IconCell key="plus" icon={Plus} label="Plus" />, 'Add item — add a new item to track (in the Tracked Items section).'],
            ]}
          />
        </section>

        <section>
          <h4 className="text-sm font-medium text-foreground mt-4 mb-2">Match and name quality (next to item names)</h4>
          <p className="text-muted-foreground mb-2">
            These show how good the match to a retailer product is and whether the name is specific enough.
          </p>
          <Table
            headers={['Icon', 'Meaning']}
            rows={[
              [<IconCell key="check-green" icon={CheckCircle2} label="Check in circle (green)" iconClassName="text-green-600" />, 'Verified — item name is specific enough and the match has good confidence. May say "Match locked" if you\'ve confirmed or overridden the match.'],
              [<IconCell key="alert-red" icon={AlertTriangle} label="Alert triangle (red)" iconClassName="text-red-600" />, 'Needs clarification — the name is too vague (e.g. "paper") and cannot be monitored until you add more detail. Edit the item to fix.'],
              [<IconCell key="info" icon={Info} label="Info (yellow)" iconClassName="text-yellow-600" />, 'Vague name — the name is generic; consider adding more details for better matching. Item can still be monitored.'],
              [<IconCell key="alert-orange" icon={AlertCircle} label="Alert circle (orange)" iconClassName="text-orange-600" />, 'Low confidence match — the matched product may be wrong. Consider improving the item name.'],
              [<IconCell key="alert-yellow" icon={AlertTriangle} label="Alert triangle (yellow)" iconClassName="text-yellow-600" />, 'Needs match review — the match may need verification, or the item is unmatched. Use "Fix match" from the ⋮ menu to review.'],
            ]}
          />
          <p className="text-muted-foreground text-xs mt-2">
            <strong>Match status badges (text)</strong> you may see: Unmatched, Needs Review, Auto Matched, Verified, Overridden, or Unknown.
          </p>
        </section>

        <section>
          <h4 className="text-sm font-medium text-foreground mt-4 mb-2">Alerts and savings</h4>
          <Table
            headers={['Icon', 'Where', 'Meaning']}
            rows={[
              [<IconCell key="bell2" icon={Bell} label="Bell" />, 'Alerts list, Overview', 'Price-drop alert; a better price was found.'],
              [<IconCell key="dollar" icon={DollarSign} label="Dollar sign" />, 'Overview, Reports', 'Savings or money-related metrics (e.g. estimated monthly savings).'],
              [<IconCell key="trending" icon={TrendingUp} label="Trending up" />, 'Overview, Reports', 'Growth or positive trend (e.g. savings over time).'],
              [<IconCell key="arrow" icon={ArrowUpRight} label="Arrow up-right" />, 'Overview', 'Often used with "alerts found" or similar metrics.'],
              [<IconCell key="flame" icon={Flame} label="Flame" />, 'Alert cards', 'Highlights alerts with a large price drop (e.g. big % OFF).'],
              [<IconCell key="ext2" icon={ExternalLink} label="External link" />, 'On an alert', 'Opens the retailer\'s product page for that price.'],
            ]}
          />
        </section>

        <section>
          <h4 className="text-sm font-medium text-foreground mt-4 mb-2">Actions (buttons and menus)</h4>
          <Table
            headers={['Icon', 'Meaning']}
            rows={[
              [<IconCell key="edit" icon={Edit2} label="Edit (pencil)" />, 'Edit this item.'],
              [<IconCell key="trash" icon={Trash2} label="Trash" />, 'Delete this item (or remove an alert).'],
              [<IconCell key="refresh" icon={RefreshCw} label="Refresh / reload" />, 'Refresh data or retry (e.g. after an error).'],
              [<IconCell key="check" icon={CheckCircle2} label="Check in circle (green)" iconClassName="text-green-600" />, 'Confirm, success, or "done".'],
              [<IconCell key="x" icon={X} label="X" />, 'Close, cancel, or remove.'],
              [<IconCell key="more" icon={MoreVertical} label="More (⋮ vertical dots)" />, 'Open more options for this row (e.g. Pause/Resume, Edit, Delete, Fix match).'],
            ]}
          />
        </section>

        <section>
          <h4 className="text-sm font-medium text-foreground mt-4 mb-2">Subscription and upgrade</h4>
          <Table
            headers={['Icon', 'Meaning']}
            rows={[
              [<IconCell key="lock-sub" icon={Lock} label="Lock (gray)" iconClassName="text-gray-400" />, 'Feature is locked; subscription required to unlock (e.g. monitoring or reports).'],
              [<IconCell key="shield-up" icon={Shield} label="Shield" />, 'Often used for "Upgrade" or protected/premium features.'],
              [<IconCell key="sparkles" icon={Sparkles} label="Sparkles" />, 'Used on upgrade prompts (e.g. "Unlock monitoring").'],
              [<IconCell key="credit" icon={CreditCard} label="Credit card" />, 'Billing or subscription management (e.g. in Settings).'],
            ]}
          />
        </section>

        <section>
          <h4 className="text-sm font-medium text-foreground mt-4 mb-2">Account and connection</h4>
          <Table
            headers={['Icon', 'Meaning']}
            rows={[
              [<IconCell key="user-acc" icon={User} label="User" />, 'Account & Integrations — opens the modal for QuickBooks connection status, disconnect, and company info.'],
              [<IconCell key="unplug" icon={Unplug} label="Unplug" />, 'Disconnect QuickBooks (inside the Account modal).'],
              [<IconCell key="alert-warn" icon={AlertCircle} label="Alert circle (yellow/red)" iconClassName="text-yellow-600" />, 'Warning or error (e.g. connection issue, or a message in Account/QuickBooks).'],
            ]}
          />
        </section>

        <section>
          <h4 className="text-sm font-medium text-foreground mt-4 mb-2">Theme and UI</h4>
          <Table
            headers={['Icon', 'Meaning']}
            rows={[
              [<IconCell key="sun" icon={Sun} label="Sun" />, 'Light theme.'],
              [<IconCell key="moon" icon={Moon} label="Moon" />, 'Dark theme.'],
              [<IconCell key="download" icon={Download} label="Download" />, 'Export or download (e.g. backup, CSV).'],
            ]}
          />
        </section>

        <section>
          <h4 className="text-sm font-medium text-foreground mt-4 mb-2">Toasts and notifications</h4>
          <p className="text-muted-foreground">
            Small pop-up messages: <strong>Green check</strong> — Success. <strong>Red X</strong> — Error. <strong>Yellow warning</strong> — Warning. <strong>Blue info</strong> — Informational.
          </p>
        </section>

        <section>
          <h4 className="text-sm font-medium text-foreground mt-4 mb-2">Quick reference: where to do what</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li><strong>Overview tab</strong> — Estimated monthly savings, items monitored, recent alerts, and "How Procuro Works" (first time).</li>
            <li><strong>Tracked Items (left panel)</strong> — Your list of items. Use the <strong>+</strong> button to add an item. Use the <strong>⋮</strong> menu on an item to Resume / Pause monitoring, Edit, Delete, or Fix match. Click an item for price history where available.</li>
            <li><strong>Alerts tab</strong> — All price-drop alerts, filter by period, open retailer links (View), and remove alerts (Delete).</li>
            <li><strong>Account (User icon in header)</strong> — QuickBooks connection status, disconnect, and company info.</li>
            <li><strong>Reports</strong> — If your deployment includes a Reports view, use it for savings and trends; export when available.</li>
            <li><strong>Settings</strong> — When a Settings (gear) option is present, use it for app preferences and backup.</li>
          </ul>
        </section>

        <p className="text-muted-foreground text-xs pt-2 border-t border-border">
          Hover over any icon in the app for a short tooltip. For match and monitoring status next to items, the tooltips explain exactly why an icon is shown.
        </p>
      </div>
    </Modal>
  );
}
