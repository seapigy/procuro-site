# 📋 QUICKBOOKS APP SUBMISSION GUIDE

**App Name:** Procuro - Smart Purchasing Alerts  
**Version:** 1.1.0  
**Submission Date:** November 13, 2025  
**Developer:** Procuro Inc.  
**Contact:** procuroapp@gmail.com

---

## 🎯 OVERVIEW

This guide provides step-by-step instructions for submitting Procuro to the Intuit Developer Dashboard for QuickBooks App Store approval.

---

## 📝 PRE-SUBMISSION CHECKLIST

Before starting the submission process, ensure:

- [ ] All public pages are live (privacy, terms, support)
- [ ] Landing page is polished and accessible
- [ ] OAuth redirect URIs are configured
- [ ] Manifest.json is complete and valid
- [ ] Branding assets are prepared (logo, banner, screenshots)
- [ ] Local testing is complete
- [ ] Security review passed
- [ ] Documentation is up-to-date

---

## 🔐 INTUIT DEVELOPER DASHBOARD SETUP

### Step 1: Create Developer Account

1. Go to [developer.intuit.com](https://developer.intuit.com)
2. Sign in or create an account
3. Navigate to **My Apps**
4. Click **Create an App**

### Step 2: App Configuration

**App Name:** Procuro - Smart Purchasing Alerts

**App Type:** QuickBooks Online App

**Integration Type:** Embedded App (iframe)

**Description:**
```
Procuro helps businesses save money on the items they already buy. Automatically monitor your company's recurring purchases in QuickBooks, compare prices across major retailers, and receive instant savings alerts directly inside QuickBooks Online.
```

**Category:** Accounting, Business Efficiency, Savings Tools

**Target Audience:** Small to medium businesses using QuickBooks Online

---

## 🔑 OAUTH CONFIGURATION

### Redirect URIs

Add these redirect URIs in the OAuth settings:

**Production:**
```
https://procuroapp.com/oauth/callback
```

**Development (optional):**
```
http://localhost:5000/api/qb/callback
```

### Scopes

Select the following scopes:

- [x] `com.intuit.quickbooks.accounting` - Read/write access to accounting data
- [x] `openid` - User identity verification
- [x] `profile` - User profile information
- [x] `email` - User email address

**Justification:**
- **Accounting:** Required to read Purchase transactions and vendor data
- **OpenID/Profile/Email:** Required for user authentication and support

---

## 🖼️ BRANDING ASSETS

### Required Files

Upload these assets to the Developer Dashboard:

1. **App Icon** (512x512 PNG)
   - Location: `/client/public/assets/appstore/procuro-logo-512.png`
   - Specs: 512x512px, PNG format, under 2MB
   - Features: Shopping cart with dollar sign, blue (#0077C5) background

2. **Banner Image** (1280x640 PNG)
   - Location: `/client/public/assets/appstore/banner-1280x640.png`
   - Specs: 1280x640px (2:1 ratio), PNG format, under 2MB
   - Features: Logo, tagline, key benefits, CTA

3. **Screenshots** (1920x1080 PNG recommended)
   - Dashboard view: `/client/public/assets/appstore/screenshot-dashboard.png`
   - Alerts view: `/client/public/assets/appstore/screenshot-alerts.png`
   - Reports view: `/client/public/assets/appstore/screenshot-reports.png`
   - Settings view: `/client/public/assets/appstore/screenshot-settings.png`

### Screenshot Guidelines

- **Resolution:** 1920x1080 or higher
- **Format:** PNG (preferred) or JPG
- **Content:** Show actual app interface with realistic data
- **No browser chrome:** Crop to show only the app content
- **Professional appearance:** Use clean, realistic mock data

---

## 🌐 PUBLIC URLS

### Required Pages

Ensure these URLs are live and accessible:

| Page | URL | Status |
|------|-----|--------|
| Landing Page | https://procuroapp.com/ | ✅ Live |
| Privacy Policy | https://procuroapp.com/privacy | ✅ Live |
| Terms of Service | https://procuroapp.com/terms | ✅ Live |
| Support | https://procuroapp.com/support | ✅ Live |
| OAuth Callback | https://procuroapp.com/oauth/callback | ✅ Configured |
| Launch URL | https://procuroapp.com/qbo_embed/iframe-loader.html | ✅ Live |

---

## 💰 PRICING CONFIGURATION

### Subscription Details

**Model:** Subscription-based

**Free Trial:** 14 days (no credit card required)

**Pricing Tiers:**

1. **Monthly Plan**
   - Price: $9.99/month
   - Billing: Monthly recurring
   - Features: All features included

2. **Annual Plan** (Recommended)
   - Price: $99.00/year
   - Billing: Annual recurring
   - Savings: $20/year vs monthly
   - Features: All features + priority support

**Currency:** USD

**Cancellation Policy:** Cancel anytime, no questions asked. Access continues until end of billing period. No refunds for partial periods.

---

## 📋 SUBMISSION FORM FIELDS

### App Information

**App Name:**
```
Procuro - Smart Purchasing Alerts
```

**Short Tagline (60 chars max):**
```
Save money on what you already buy.
```

**Long Description (1000 chars max):**
```
Procuro automatically scans your recurring business purchases and finds better prices from trusted vendors like Amazon, Walmart, and Staples. Embedded directly inside QuickBooks, it helps your company save money without changing your workflow.

✓ Seamless QuickBooks Integration - Works directly inside QBO
✓ Multi-Retailer Price Comparison - Amazon, Walmart, Staples, and more
✓ Instant Savings Alerts - Get notified when prices drop
✓ Zero Setup Required - Connect and start saving in 30 seconds
✓ Bank-Level Security - AES-256 encrypted data storage

Perfect for businesses that regularly purchase office supplies, operational materials, and recurring items. No manual data entry, no CSV uploads—just connect your QuickBooks and let Procuro do the work.

14-day free trial. Cancel anytime.
```

**Key Features (bullet points):**
```
• Embedded directly inside QuickBooks Online
• Real-time savings alerts for recurring purchases
• Compare vendors across Amazon, Walmart, Staples, and more
• Secure AES-256 encrypted QuickBooks token handling
• Easy setup – no manual uploads or CSVs
• Analytics dashboard with savings reports
• Daily automated price monitoring
```

**Target Industries:**
```
• Professional Services
• Retail
• Wholesale/Distribution
• Manufacturing
• Construction
• Healthcare
• Hospitality
```

**Company Size:**
```
• 1-10 employees (Small Business)
• 11-50 employees (Medium Business)
• 51-200 employees (Enterprise)
```

---

## 🔐 SECURITY & COMPLIANCE

### Data Handling Statement

```
Procuro accesses only Purchase transaction data from QuickBooks Online to identify recurring supply items and their prices. We do NOT access customer data, invoices, sales transactions, or bank accounts.

All QuickBooks OAuth tokens are encrypted using AES-256-GCM encryption before storage. We do NOT sell, share, or distribute user data to third parties.

Data Encryption: AES-256-GCM
Transport Security: HTTPS/TLS 1.2+
Token Storage: Encrypted at rest
Third-Party Sharing: NONE

Compliance: GDPR, CCPA, Intuit Data Protection Standards
```

### Privacy Policy URL

```
https://procuroapp.com/privacy
```

### Terms of Service URL

```
https://procuroapp.com/terms
```

### Support URL

```
https://procuroapp.com/support
```

---

## 🧪 SANDBOX TESTING INSTRUCTIONS

### For Intuit Reviewers

**Test Account Credentials:**
- Email: test@procuroapp.com
- Password: [Provided separately via secure channel]

**Testing Steps:**

1. **Install the App:**
   - Navigate to QuickBooks Sandbox environment
   - Search for "Procuro" in Apps menu
   - Click "Get App Now"

2. **OAuth Connection:**
   - Click "Connect" button
   - Authorize Procuro with Accounting, OpenID, Profile, Email scopes
   - Verify successful redirect to Procuro dashboard

3. **Data Sync:**
   - App automatically imports Purchase transactions
   - Wait 30-60 seconds for initial sync
   - Verify items appear in Dashboard → Items tab

4. **Price Alerts:**
   - Navigate to Alerts tab
   - Verify alerts are displayed (mock data pre-loaded)
   - Click "View" to see alert details

5. **Reports:**
   - Navigate to Reports tab
   - Verify Top Vendors chart displays
   - Verify savings metrics display correctly
   - Test CSV export

6. **Settings:**
   - Click Settings icon (gear)
   - Verify auto-check toggle works
   - Test database backup download

7. **Disconnect:**
   - QuickBooks → Apps → Manage Apps → Procuro → Disconnect
   - Verify clean disconnection

**Expected Behavior:**
- ✅ OAuth flow completes successfully
- ✅ Items import from Purchase transactions
- ✅ Dashboard displays items, alerts, savings
- ✅ Reports page renders with charts
- ✅ Settings modal opens and saves preferences
- ✅ No console errors in browser
- ✅ Responsive on desktop/tablet

**Known Limitations (Private Beta):**
- Amazon & Target APIs pending approval (Walmart API active)
- Price matching accuracy: 75-85%
- Price checks run daily at 3:00 AM

---

## 📊 TECHNICAL SPECIFICATIONS

### Architecture

**Backend:**
- Node.js 18+
- Express server
- Prisma ORM
- SQLite (local) / PostgreSQL (production)

**Frontend:**
- React 18
- TypeScript
- Tailwind CSS
- Vite build tool

**Security:**
- AES-256-GCM token encryption
- HTTPS/TLS transport
- CORS configuration
- Security middleware blocking sensitive paths

### System Requirements

**For End Users:**
- QuickBooks Online account (any plan)
- Modern web browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Cookies enabled

**For Developers:**
- Node.js 18+
- npm 9+
- Git

---

## 📝 SUBMISSION CHECKLIST

Before clicking "Submit for Review":

### App Configuration
- [ ] App name is correct: "Procuro - Smart Purchasing Alerts"
- [ ] Description is compelling and accurate
- [ ] Categories are selected
- [ ] Target audience is defined
- [ ] Pricing tiers are configured

### OAuth & Technical
- [ ] Redirect URIs are added (production + dev)
- [ ] Scopes are selected (Accounting, OpenID, Profile, Email)
- [ ] Launch URL is correct
- [ ] Webhook URLs configured (if applicable)

### Branding Assets
- [ ] App icon uploaded (512x512 PNG)
- [ ] Banner image uploaded (1280x640 PNG)
- [ ] Screenshots uploaded (4+ images)
- [ ] All images under 2MB each
- [ ] Images are professional quality

### Public Pages
- [ ] Landing page is live and accessible
- [ ] Privacy policy is live and complete
- [ ] Terms of service are live and complete
- [ ] Support page is live with contact info
- [ ] All pages use HTTPS
- [ ] All links work (no 404s)

### Testing
- [ ] App tested in QuickBooks Sandbox
- [ ] OAuth flow works end-to-end
- [ ] Data sync works correctly
- [ ] All features functional
- [ ] No critical bugs
- [ ] Mobile responsive

### Documentation
- [ ] README.md is up-to-date
- [ ] API documentation exists
- [ ] Reviewer guide provided
- [ ] Support email is active
- [ ] Contact information is current

### Compliance
- [ ] Privacy policy covers data usage
- [ ] Terms of service are legally sound
- [ ] Security measures documented
- [ ] Data handling statement provided
- [ ] GDPR/CCPA compliance addressed

---

## 🚀 SUBMISSION PROCESS

### Step 1: Final Review

1. Test app in QuickBooks Sandbox one more time
2. Verify all public URLs are accessible
3. Check that all assets are uploaded
4. Review description for typos/errors

### Step 2: Submit for Review

1. Log into Intuit Developer Dashboard
2. Navigate to your app
3. Click **"Submit for Review"**
4. Select **"Private Beta"** distribution mode
5. Add reviewer notes (see below)

### Step 3: Reviewer Notes

Include this in the "Notes for Reviewer" field:

```
Thank you for reviewing Procuro!

TESTING CREDENTIALS:
- Sandbox test data is pre-loaded
- OAuth flow can be tested immediately

KEY FEATURES TO TEST:
1. OAuth connection (Accounting, OpenID, Profile, Email scopes)
2. Dashboard with items imported from Purchase transactions
3. Alerts tab showing price drop notifications
4. Reports page with Top Vendors chart and savings metrics
5. Settings modal with auto-check toggle and backup feature

KNOWN LIMITATIONS:
- Amazon & Target price APIs pending approval (Walmart active)
- Daily price checks run at 3:00 AM
- Initial sync may take 30-60 seconds

DOCUMENTATION:
- User guide: https://github.com/seapigy/procuro-site/tree/main/docs
- Support: procuroapp@gmail.com

Please let us know if you need any additional information!
```

### Step 4: Post-Submission

**Expected Timeline:**
- Initial review: 5-10 business days
- Feedback (if needed): 2-3 days to address
- Final approval: 2-5 business days

**Common Review Feedback:**
- Screenshot clarity
- Description improvements
- Privacy policy updates
- OAuth scope justifications

**Response Plan:**
- Monitor procuroapp@gmail.com daily
- Respond to feedback within 24 hours
- Make requested changes immediately
- Resubmit within 48 hours

---

## 📧 SUPPORT & CONTACT

**Developer Email:** procuroapp@gmail.com

**Support Page:** https://procuroapp.com/support

**Documentation:** https://github.com/seapigy/procuro-site/tree/main/docs

**GitHub Repo:** https://github.com/seapigy/procuro-site

---

## ✅ POST-APPROVAL STEPS

Once approved:

1. **Activate Listing:**
   - Review app store listing
   - Enable "Live" status
   - Monitor for first installs

2. **Monitor Performance:**
   - Check error logs daily
   - Monitor OAuth success rate
   - Track user signups

3. **Customer Support:**
   - Respond to support emails within 24 hours
   - Monitor app store reviews
   - Address bugs promptly

4. **Updates:**
   - Plan regular feature updates
   - Submit update reviews as needed
   - Maintain backward compatibility

---

**Last Updated:** November 13, 2025  
**Version:** 1.1.0  
**Status:** Ready for Submission

