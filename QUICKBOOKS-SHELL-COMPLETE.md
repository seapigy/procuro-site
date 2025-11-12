# QuickBooks Online UI Shell - Complete! 🎉

## ✅ What Was Built

A mock QuickBooks Online interface to preview how ProcuroApp will look when embedded inside QuickBooks as an iframe app.

**Purpose**: Pure visual preview - no functionality, just layout and design simulation.

---

## 📁 Files Created

### 1. **QuickBooks Shell Layout**
`client/src/layouts/QuickBooksShell.tsx`

**Features**:
- Left sidebar styled like QuickBooks Online
- QuickBooks logo and branding
- Navigation items with icons
- Active state highlighting
- ProcuroApp badge on active item
- QuickBooks Mode indicator badge
- Full-screen flex layout
- Dashboard rendered in main content area

### 2. **Updated Routes**
`client/src/App.tsx`

**Routes**:
- `/` - ProcuroApp in QuickBooks shell (default)
- `/standalone` - ProcuroApp standalone dashboard

### 3. **Documentation**
`client/src/layouts/README.md` - Layout usage and styling guide

---

## 🎨 QuickBooks Styling

### Color Palette
Matches QuickBooks Online's authentic colors:

```css
/* QuickBooks Brand Colors */
--qb-green: #2CA01C        /* QuickBooks logo */
--qb-blue: #0077C5         /* Accent/primary actions */
--qb-sidebar-bg: #F8F9FA   /* Light gray sidebar */
--qb-active-bg: #E3F2FD    /* Light blue for active items */
```

### Sidebar Styling
- **Background**: `#F8F9FA` (QuickBooks light gray)
- **Width**: 256px (16rem)
- **Border**: Right border for separation
- **Logo**: QuickBooks green (`#2CA01C`)
- **Active Item**: Light blue background (`#E3F2FD`)
- **Active Text**: QB blue (`#0077C5`)

---

## 📐 Layout Structure

```
┌─────────────────────────────────────────────────────┐
│                  FULL SCREEN                        │
├──────────────┬──────────────────────────────────────┤
│              │  QuickBooks Mode Badge               │
│ QuickBooks   ├──────────────────────────────────────┤
│              │                                       │
│   Sidebar    │        ProcuroApp Dashboard          │
│              │                                       │
│  - Logo      │  ┌─────────────────────────────┐    │
│  - Nav Menu  │  │ Top Bar + Theme Toggle      │    │
│    • Dashboard│  ├─────┬─────────────┬────────┤    │
│    • Expenses│  │Items│Price Alerts │Retailers│    │
│    • Vendors │  │     │             │         │    │
│    • Procure │  │     │             │         │    │
│    • Reports │  │     │             │         │    │
│    • Settings│  └─────┴─────────────┴─────────┘    │
│              │                                       │
│  - Footer    │                                       │
└──────────────┴──────────────────────────────────────┘
```

---

## 🔹 Navigation Items

### Sidebar Menu
1. **Dashboard** - Home icon
2. **Expenses** - FileText icon
3. **Vendors** - Users icon
4. **Procurement Alerts** ⭐ - Bell icon
   - **Active state** (highlighted in blue)
   - **Badge**: "ProcuroApp" in QB blue
5. **Reports** - BarChart3 icon
6. **Settings** - Settings icon

### Active Item Styling
```tsx
<NavItem 
  icon={Bell} 
  label="Procurement Alerts" 
  active 
  badge="ProcuroApp"
/>
```

**Visual appearance**:
- Background: `#E3F2FD` (light blue)
- Text color: `#0077C5` (QB blue)
- Badge: QB blue with white text
- Icon: Highlighted in QB blue

---

## 🏷️ QuickBooks Mode Indicator

At the top of the content area:

```tsx
<Badge variant="secondary" className="bg-[#E3F2FD] text-[#0077C5]">
  QuickBooks Mode
</Badge>
```

**Purpose**: Visual indicator that this is a QuickBooks-embedded view

**Styling**:
- Light blue background (`#E3F2FD`)
- QB blue text (`#0077C5`)
- Secondary badge style
- Positioned above dashboard content

---

## 📱 Layout Features

### Flex Layout
```tsx
<div className="flex h-screen">
  <aside className="w-64">...</aside>
  <main className="flex-1 flex flex-col overflow-hidden">
    <div className="bg-white border-b">QuickBooks Mode Badge</div>
    <div className="flex-1 overflow-auto">Dashboard</div>
  </main>
</div>
```

**Key Properties**:
- `h-screen` - Full viewport height
- `flex` - Flexbox layout
- `w-64` - Fixed sidebar width (256px)
- `flex-1` - Main content takes remaining space
- `overflow-auto` - Scrollable content area

### Sidebar Features
- **Fixed width**: 256px
- **Logo section**: Top with border-bottom
- **Navigation**: Middle section (flex-1)
- **Footer**: Bottom with company info
- **Hover effects**: Gray background on non-active items

### Main Content Area
- **Full height**: Uses remaining screen space
- **Overflow**: Scrollable content
- **Mode badge**: Fixed at top
- **Dashboard**: Renders below badge

---

## 🚀 How to View

### Start the Application

```bash
cd client
npm run dev
```

### View Routes

**QuickBooks Mode** (default):
```
http://localhost:5173/
```
Shows ProcuroApp embedded in QuickBooks shell

**Standalone Mode**:
```
http://localhost:5173/standalone
```
Shows ProcuroApp without QuickBooks shell

---

## 📸 Visual Preview

### QuickBooks Mode (`/`)

```
┌────────────────────────────────────────────────┐
│ ┌──────────┬────────────────────────────────┐ │
│ │QuickBooks│ [QuickBooks Mode Badge]        │ │
│ │  Online  ├────────────────────────────────┤ │
│ ├──────────┤                                 │ │
│ │Dashboard │     ProcuroApp Dashboard       │ │
│ │Expenses  │                                 │ │
│ │Vendors   │  ┌──────┬────────┬─────────┐  │ │
│ │┏━━━━━━━┓ │  │Items │Alerts  │Retailers│  │ │
│ │┃Procure┃ │  │      │        │         │  │ │
│ │┃Alerts ┃ │  │      │        │         │  │ │
│ │┗━━━━━━━┛ │  └──────┴────────┴─────────┘  │ │
│ │Reports   │                                 │ │
│ │Settings  │                                 │ │
│ └──────────┴────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Standalone Mode (`/standalone`)

```
┌─────────────────────────────────────────────┐
│ ProcuroApp Dashboard                        │
│                                             │
│  ┌──────────┬────────────┬──────────────┐  │
│  │  Tracked │   Price    │  Connected   │  │
│  │   Items  │   Alerts   │  Retailers   │  │
│  │          │            │              │  │
│  └──────────┴────────────┴──────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 🎯 Design Details

### QuickBooks Sidebar
```tsx
// Logo Section
<div className="p-6 border-b">
  <h1 className="text-xl font-bold text-[#2CA01C]">QuickBooks</h1>
  <p className="text-xs text-gray-500 mt-1">Online</p>
</div>

// Navigation Section
<nav className="flex-1 p-4">
  <NavItem icon={Bell} label="Procurement Alerts" active badge="ProcuroApp" />
</nav>

// Footer Section
<div className="p-4 border-t text-xs text-gray-500">
  <p>Company: Demo Corp</p>
  <p>Fiscal Year: 2024</p>
</div>
```

### NavItem Component
```tsx
interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: string;
}
```

**States**:
- **Normal**: Gray text, hover background
- **Active**: Blue background, blue text, badge visible
- **Hover**: Light gray background

---

## ✨ Key Features

✅ **Authentic QuickBooks Styling**
- Official QB color palette
- Matching typography
- Professional spacing

✅ **Fully Responsive Layout**
- Full-screen height
- Proper overflow handling
- Flexible content area

✅ **No Functionality Changes**
- Dashboard works exactly as before
- Only visual wrapping
- Theme toggle still works

✅ **Two View Modes**
- QuickBooks mode: `/`
- Standalone mode: `/standalone`

✅ **Visual Indicators**
- Active nav item highlighted
- ProcuroApp badge on nav
- QuickBooks Mode badge
- Company info in footer

---

## 🔄 Dashboard Integration

### Before (Standalone)
```tsx
<Dashboard />  // Full screen, own top bar
```

### After (QuickBooks Shell)
```tsx
<QuickBooksShell>
  <Dashboard />  // Rendered in main content area
</QuickBooksShell>
```

**Changes Made**:
- Dashboard uses `min-h-full` instead of `min-h-screen`
- Dashboard renders inside shell's content area
- No functionality changes
- Theme toggle preserved
- All features work identically

---

## 📋 Future Real Integration

When connecting to actual QuickBooks:

### Phase 1: OAuth & Authentication
- Implement QuickBooks OAuth 2.0
- Handle tokens and session
- User identity from QB

### Phase 2: Iframe Embedding
- Register app in Intuit Developer Portal
- Configure iframe settings
- Handle parent-child communication

### Phase 3: Data Sync
- Fetch real QB company data
- Sync navigation items
- Update sidebar dynamically
- Real company info in footer

### Phase 4: QB API Integration
- Use QB API for vendor data
- Sync purchase orders
- Real-time data updates

---

## 🎨 Color Reference

### Sidebar
```css
background-color: #F8F9FA;
border-right: 1px solid #E2E8F0;
```

### Active Nav Item
```css
background-color: #E3F2FD;
color: #0077C5;
```

### QuickBooks Logo
```css
color: #2CA01C;  /* QB Green */
```

### QuickBooks Mode Badge
```css
background-color: #E3F2FD;
color: #0077C5;
```

### Nav Item Hover
```css
background-color: #F3F4F6;
```

---

## ✅ Summary

**Status**: 🟢 QuickBooks Shell Complete!

✅ Mock QuickBooks UI created  
✅ Professional QB styling  
✅ Sidebar with navigation  
✅ Active item highlighting  
✅ ProcuroApp badge  
✅ QuickBooks Mode indicator  
✅ Full-screen flex layout  
✅ Dashboard integrated  
✅ Two view modes  
✅ Zero functionality changes  
✅ Ready for design preview  

The shell is purely visual and perfect for stakeholder demos, design validation, and previewing the QuickBooks integration experience! 🎯
