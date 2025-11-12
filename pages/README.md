# Legal & Support Pages

This folder contains required legal and support pages for QuickBooks App Store verification.

## 📄 Files

### support.html
**URL:** `/support` or `https://procuroapp.com/support`

Customer support page with:
- Contact information (support@procuroapp.com)
- Response time (24 business hours)
- Common questions and answers
- Technical support information
- Feature request contact

### privacy.html
**URL:** `/privacy` or `https://procuroapp.com/privacy`

Privacy Policy detailing:
- Data we access from QuickBooks
- Data we never access
- How we use your information
- Data security measures (HTTPS/TLS 1.3, encryption)
- Your rights (access, correction, deletion, disconnect)
- Data retention policies
- Cookie usage
- Contact: privacy@procuroapp.com

**Effective Date:** January 1, 2025

### terms.html
**URL:** `/terms` or `https://procuroapp.com/terms`

Terms of Use covering:
- Service description
- QuickBooks integration authorization
- Pricing information disclaimers
- No purchase fulfillment (comparison tool only)
- User responsibilities
- Intellectual property and trademarks
- Limitation of liability
- Termination rights
- Contact: legal@procuroapp.com

**Effective Date:** January 1, 2025

## 🚀 Deployment

### For Static File Hosting (Netlify, Vercel, etc.)

Upload the entire `/pages` folder to your hosting provider. Ensure these URLs are accessible:

- `https://procuroapp.com/support`
- `https://procuroapp.com/privacy`
- `https://procuroapp.com/terms`

### For Express.js Server

Add static file serving to your `server/src/index.ts`:

```javascript
import path from 'path';

// Serve static pages
app.use(express.static(path.join(__dirname, '../../pages')));

// OR serve with explicit routes:
app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, '../../pages/support.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '../../pages/privacy.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, '../../pages/terms.html'));
});
```

### For Separate Static Site

If you're deploying the frontend separately (e.g., on Netlify):

1. Copy `/pages` folder to your frontend build directory
2. Configure your hosting to serve HTML files without extensions:
   - `/support.html` → `/support`
   - `/privacy.html` → `/privacy`
   - `/terms.html` → `/terms`

## 📋 QuickBooks App Store Requirements

These pages are **required** for QuickBooks App Store submission:

### Privacy Policy
- ✅ Must be publicly accessible
- ✅ Must detail what data is accessed from QuickBooks
- ✅ Must explain how data is used and protected
- ✅ Must include contact information

### Terms of Use
- ✅ Must be publicly accessible
- ✅ Must outline service description and limitations
- ✅ Must include liability disclaimers
- ✅ Must include contact information

### Support Page
- ✅ Must provide customer support contact information
- ✅ Must include response time expectations
- ✅ Recommended: Include FAQs and troubleshooting

## 🔗 Dashboard Integration

Footer links have been added to the Dashboard component (`client/src/components/Dashboard.tsx`):

```tsx
<footer className="mt-8 pt-6 border-t text-center">
  <a href="/support">Support</a> • 
  <a href="/privacy">Privacy Policy</a> • 
  <a href="/terms">Terms of Use</a>
</footer>
```

## 🧪 Testing

### Local Testing

1. Serve the pages folder:
   ```bash
   npx serve pages -p 8080
   ```

2. Test URLs:
   - http://localhost:8080/support.html
   - http://localhost:8080/privacy.html
   - http://localhost:8080/terms.html

### Production Testing

After deployment, verify:
- [ ] https://procuroapp.com/support loads correctly
- [ ] https://procuroapp.com/privacy loads correctly
- [ ] https://procuroapp.com/terms loads correctly
- [ ] All links work (cross-linking between pages)
- [ ] Footer links in dashboard work
- [ ] Pages are mobile-responsive

## 📧 Contact Emails

These email addresses are referenced in the legal pages:

- **support@procuroapp.com** - Customer support inquiries
- **privacy@procuroapp.com** - Privacy and data protection inquiries
- **legal@procuroapp.com** - Legal and terms inquiries
- **feedback@procuroapp.com** - Feature requests and feedback

**Action Required:** Ensure these email addresses are:
1. Created and active
2. Monitored regularly
3. Set up with auto-responders (optional)
4. Documented in team runbooks

## 🎨 Styling

All pages use consistent styling:
- **Font:** Inter, with system font fallbacks
- **Max Width:** 700px (centered)
- **Color Scheme:** 
  - Primary: #1E40AF (blue)
  - Background: #f9fafb (light gray)
  - Container: White with shadow
- **Responsive:** Mobile-friendly with proper viewport meta tags

## 📝 Updating Pages

When updating legal pages:

1. Update the **Effective Date** at the top
2. Notify users of significant changes (email or dashboard banner)
3. Keep archived versions for legal compliance
4. Update the corresponding URLs in the Intuit Developer Dashboard

## ✅ Intuit Developer Dashboard

Add these URLs to your QuickBooks app listing:

**App Settings → Legal Information:**
- Privacy Policy URL: `https://procuroapp.com/privacy`
- Terms of Use URL: `https://procuroapp.com/terms`
- Support URL: `https://procuroapp.com/support`

## 🔒 Security & Compliance

- ✅ All pages served over HTTPS
- ✅ No cookies or tracking scripts on legal pages
- ✅ Privacy policy complies with GDPR principles
- ✅ Terms include proper liability disclaimers
- ✅ Support page provides clear contact methods

## 📊 Monitoring

Consider adding:
- Page view analytics (privacy-compliant)
- Link click tracking for footer links
- Support email response time tracking
- Legal page update notifications

---

**Status:** ✅ All required legal pages created and ready for deployment

**Last Updated:** January 2025

