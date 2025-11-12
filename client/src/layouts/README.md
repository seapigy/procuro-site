# Layout Components

## QuickBooksShell

A mock QuickBooks Online UI shell for previewing how ProcuroApp will look when embedded inside QuickBooks as an iframe app.

### Purpose
This layout is purely for visual preview and design validation. It does not include any real QuickBooks functionality or authentication.

### Features
- **Left Sidebar**: Styled like QuickBooks Online with navigation items
- **Active Item**: "Procurement Alerts" is highlighted as the active nav item
- **Badge**: Shows "ProcuroApp" badge on the active item
- **QuickBooks Mode Indicator**: Blue badge at the top of the content area
- **Responsive**: Full-screen height with proper overflow handling

### QuickBooks Styling
The shell uses QuickBooks Online's color palette:
- Sidebar background: `#F8F9FA` (light gray)
- Active item background: `#E3F2FD` (light blue)
- Accent color: `#0077C5` (QB blue)
- QuickBooks green: `#2CA01C` (logo)

### Routes
- `/` - ProcuroApp embedded in QuickBooks shell (default)
- `/standalone` - ProcuroApp standalone dashboard (no shell)

### Usage
The QuickBooksShell wraps the existing Dashboard component without modifying its functionality. The dashboard renders inside the main content area.

```tsx
<QuickBooksShell>
  <Dashboard />  {/* Rendered in main content area */}
</QuickBooksShell>
```

### Navigation Items
1. Dashboard
2. Expenses
3. Vendors
4. **Procurement Alerts** (active, with ProcuroApp badge)
5. Reports
6. Settings

### Future Enhancements
When integrating with real QuickBooks:
- Replace mock sidebar with QuickBooks API navigation
- Implement proper OAuth authentication
- Add iframe embedding support
- Handle QuickBooks events and callbacks
- Sync company data from QuickBooks
