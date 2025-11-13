# Procuro App Store Assets

This folder contains branding assets for QuickBooks App Store submission.

## Files

### Required Assets

1. **procuro-logo-512.svg** (512x512)
   - App icon for QuickBooks App Store listing
   - Square format with transparent/white background
   - Features shopping cart with dollar sign
   - Primary color: #0077C5 (QuickBooks blue)

2. **banner-1280x640.svg** (1280x640)
   - Hero banner for app store listing
   - 2:1 aspect ratio
   - Includes logo, tagline, key features, CTA
   - Gradient background: #0077C5 → #00A699

### Screenshot Placeholders

For actual submission, replace these with real screenshots:

- **screenshot-dashboard.png** - Main dashboard view with items/alerts
- **screenshot-alerts.png** - Alerts tab showing price drop notifications
- **screenshot-reports.png** - Reports page with savings charts
- **screenshot-settings.png** - Settings modal with preferences

## Generating PNG Files

To convert SVG to PNG (required format for Intuit):

```bash
# Using ImageMagick
convert -background none procuro-logo-512.svg procuro-logo-512.png
convert banner-1280x640.svg banner-1280x640.png

# Using Inkscape
inkscape procuro-logo-512.svg --export-filename=procuro-logo-512.png --export-width=512 --export-height=512
inkscape banner-1280x640.svg --export-filename=banner-1280x640.png --export-width=1280 --export-height=640
```

## Screenshot Guidelines

When taking actual screenshots:

1. **Dashboard** - Show:
   - Top navigation with tabs
   - 3-4 items in the items table
   - At least 1 alert notification
   - Clean, professional appearance

2. **Alerts** - Show:
   - Multiple price drop alerts
   - Savings amounts clearly visible
   - "View" and "Delete" actions
   - Unread badge on bell icon

3. **Reports** - Show:
   - Top vendors chart with bars
   - Key metrics cards (monthly/annual savings)
   - Top 5 items list
   - Export CSV button

4. **Settings** - Show:
   - Settings modal open
   - Auto-check toggle
   - Backup button
   - Theme selector

### Screenshot Best Practices

- Resolution: 1920x1080 or higher
- Format: PNG with transparency if needed
- No browser chrome/UI (just app content)
- Use realistic mock data
- Ensure all text is legible
- Professional, clean layout
- Consistent theming

## Brand Colors

- **Primary Blue:** #0077C5 (QuickBooks brand color)
- **Accent Green:** #00A699 (success/savings indicator)
- **Background:** #F8F9FA (light mode)
- **Text:** #1A1A1A (dark)
- **Border:** #E0E0E0 (subtle)

## Usage

These assets are referenced in:
- `/qbo_embed/appstore-metadata.json`
- `/qbo_embed/manifest.json`
- Intuit Developer Dashboard submission form

## Notes

- SVG files are placeholders for initial submission
- Replace with high-quality PNG screenshots before final submission
- Ensure all assets meet Intuit's guidelines:
  - Logo: 512x512px minimum
  - Banner: 1280x640px (2:1 ratio)
  - Screenshots: 1920x1080px recommended
  - All images under 2MB each

