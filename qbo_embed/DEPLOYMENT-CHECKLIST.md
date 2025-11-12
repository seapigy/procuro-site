# 🚀 QuickBooks Online Embed - Deployment Checklist

Complete these steps to deploy Procuro as an embedded QuickBooks Online app.

---

## ✅ Pre-Deployment Verification

### Local Testing Complete

- [ ] Backend server runs without errors (`cd server && npm run dev`)
- [ ] Frontend client runs without errors (`cd client && npm run dev`)
- [ ] QBO embed files served successfully (`npx serve qbo_embed -p 3000`)
- [ ] iframe-loader.html displays dashboard correctly
- [ ] OAuth flow works end-to-end (connect → authorize → callback → success)
- [ ] Dashboard tabs all functional (Overview, Alerts, Savings)
- [ ] Theme toggle working
- [ ] No console errors in browser DevTools

### Files Ready

- [x] ✅ `/qbo_embed/manifest.json` - QuickBooks app manifest
- [x] ✅ `/qbo_embed/iframe-loader.html` - Main iframe wrapper
- [x] ✅ `/qbo_embed/index.html` - Redirect entry point
- [x] ✅ `/qbo_embed/README.md` - Documentation
- [x] ✅ `/qbo_embed/SETUP-VERIFICATION.md` - Setup guide
- [x] ✅ `/qbo_embed/test-local.html` - Local testing page
- [x] ✅ Backend OAuth scopes updated

---

## 📋 Step-by-Step Deployment

### Step 1: Intuit Developer Dashboard Setup

**Navigate to:** [developer.intuit.com](https://developer.intuit.com)

1. **Create/Access Your App:**
   - [ ] Log in to Intuit Developer Portal
   - [ ] Go to "My Apps" dashboard
   - [ ] Select your Procuro app (or create new app)

2. **Configure OAuth Settings:**
   - [ ] Click "Keys & OAuth" tab
   - [ ] Add Production Redirect URI: `https://procuroapp.com/oauth/callback`
   - [ ] Add Development Redirect URI: `http://localhost:5000/api/qb/callback` (for testing)
   - [ ] Save changes

3. **Enable Required Scopes:**
   - [ ] Navigate to Scopes section
   - [ ] Enable: ✅ Accounting
   - [ ] Enable: ✅ OpenID
   - [ ] Enable: ✅ Profile
   - [ ] Enable: ✅ Email
   - [ ] Save changes

4. **Copy Production Credentials:**
   - [ ] Copy Production Client ID
   - [ ] Copy Production Client Secret
   - [ ] Save these securely (you'll need them for .env)

---

### Step 2: Backend Deployment

1. **Update Environment Variables:**

Create/update `server/.env` with production values:

```bash
# Database (use PostgreSQL in production)
DATABASE_URL="postgresql://user:password@host:5432/procuro_db"

# QuickBooks OAuth - PRODUCTION
QUICKBOOKS_CLIENT_ID=your_production_client_id
QUICKBOOKS_CLIENT_SECRET=your_production_client_secret
QUICKBOOKS_REDIRECT_URI=https://procuroapp.com/oauth/callback
QUICKBOOKS_ENVIRONMENT=production

# Server
PORT=5000
NODE_ENV=production

# CORS
CLIENT_URL=https://procuroapp.com
```

**Checklist:**
- [ ] Production credentials added to .env
- [ ] DATABASE_URL points to production database (PostgreSQL recommended)
- [ ] QUICKBOOKS_REDIRECT_URI matches Intuit Developer Dashboard
- [ ] QUICKBOOKS_ENVIRONMENT set to "production"
- [ ] CLIENT_URL set to production domain

2. **Database Migration:**

```bash
cd server
npm run build
npx prisma migrate deploy
```

**Checklist:**
- [ ] Database migrations applied
- [ ] Database schema verified
- [ ] Seed data loaded (if needed)

3. **Deploy Backend:**

Deploy to your hosting provider (Heroku, Railway, DigitalOcean, AWS, etc.)

```bash
# Example for git-based deployment
git add .
git commit -m "QuickBooks embed ready for production"
git push production main
```

**Checklist:**
- [ ] Backend deployed and running
- [ ] Environment variables set on hosting platform
- [ ] API accessible at https://procuroapp.com/api/
- [ ] Test endpoint: https://procuroapp.com/api/qb/connect

---

### Step 3: Frontend Deployment

1. **Update Client Configuration:**

Verify `client/src/components/Dashboard.tsx` uses production API URL or environment variables.

If hardcoded, update API calls:
```typescript
// Change from:
fetch('http://localhost:5000/api/items')

// To:
fetch('https://procuroapp.com/api/items')
```

Or use environment variables:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'https://procuroapp.com/api';
```

2. **Build Frontend:**

```bash
cd client
npm run build
```

**Checklist:**
- [ ] Build completes without errors
- [ ] `dist/` folder created with production assets

3. **Deploy Frontend:**

Upload `client/dist/` contents to your web server at:
- Root: `https://procuroapp.com/`
- Dashboard: `https://procuroapp.com/dashboard`

**Checklist:**
- [ ] Frontend deployed
- [ ] Dashboard accessible at https://procuroapp.com/dashboard
- [ ] Assets loading correctly (no 404s)
- [ ] API calls working

---

### Step 4: Deploy QBO Embed Files

Upload the entire `/qbo_embed/` folder to your web server:

**Required URLs:**
- `https://procuroapp.com/qbo_embed/manifest.json`
- `https://procuroapp.com/qbo_embed/iframe-loader.html`
- `https://procuroapp.com/qbo_embed/index.html`

**Deployment Methods:**

**Option A: Manual Upload (FTP/SFTP)**
```bash
# Upload entire qbo_embed folder to server
scp -r qbo_embed/* user@server:/var/www/procuroapp.com/qbo_embed/
```

**Option B: Git Deployment**
```bash
# Commit and push
git add qbo_embed/
git commit -m "Add QuickBooks embed files"
git push origin main

# Deploy via CI/CD or hosting platform
```

**Option C: Static File Hosting**
- Upload to Netlify, Vercel, or similar
- Ensure custom domain points to deployment

**Checklist:**
- [ ] All files uploaded to `/qbo_embed/` directory
- [ ] manifest.json accessible
- [ ] iframe-loader.html loads correctly
- [ ] index.html redirects properly

---

### Step 5: Production Testing

**Test All URLs:**

1. **Backend API:**
   - [ ] https://procuroapp.com/api/items
   - [ ] https://procuroapp.com/api/alerts
   - [ ] https://procuroapp.com/api/savings-summary
   - [ ] https://procuroapp.com/api/qb/connect

2. **Frontend:**
   - [ ] https://procuroapp.com
   - [ ] https://procuroapp.com/dashboard

3. **QBO Embed:**
   - [ ] https://procuroapp.com/qbo_embed/manifest.json
   - [ ] https://procuroapp.com/qbo_embed/iframe-loader.html
   - [ ] https://procuroapp.com/qbo_embed/index.html

**Test OAuth Flow:**

```
1. Visit: https://procuroapp.com/api/qb/connect
2. Authorize with QuickBooks account
3. Verify redirect to: https://procuroapp.com/oauth/callback
4. Check success page displays
5. Verify tokens saved to database
```

**Checklist:**
- [ ] All URLs return 200 OK
- [ ] OAuth flow completes successfully
- [ ] Tokens saved to database
- [ ] Dashboard loads in iframe
- [ ] No CORS errors
- [ ] No mixed content warnings (HTTP/HTTPS)

---

### Step 6: Submit to Intuit

**Upload Manifest:**

1. **In Intuit Developer Portal:**
   - [ ] Navigate to your app
   - [ ] Go to "App Settings" or "Manifest" section
   - [ ] Upload `manifest.json`
   - [ ] Or manually enter manifest details:
     - Name: Procuro
     - Version: 1.0.0
     - Description: Save money on what you already buy — automated price tracking for QuickBooks users.
     - Launch URL: https://procuroapp.com/qbo_embed/iframe-loader.html
     - Redirect URIs: https://procuroapp.com/oauth/callback

2. **Complete App Listing:**
   - [ ] Add app icon/logo
   - [ ] Add screenshots
   - [ ] Write detailed app description
   - [ ] Add privacy policy URL
   - [ ] Add terms of service URL
   - [ ] Add support contact information

3. **Submit for Review:**
   - [ ] Review all app information
   - [ ] Submit app for Intuit review
   - [ ] Wait for approval (typically 2-4 weeks)

---

## 🧪 Post-Deployment Verification

### Embedded App Test

Once approved by Intuit, test the embedded app:

1. **In QuickBooks Online:**
   - [ ] Log in to QuickBooks Online
   - [ ] Navigate to Apps menu
   - [ ] Search for "Procuro"
   - [ ] Click "Get App Now"
   - [ ] Install app

2. **Launch Embedded App:**
   - [ ] Open Procuro from Apps menu
   - [ ] Verify iframe loads correctly
   - [ ] Test all dashboard features
   - [ ] Verify OAuth token passing
   - [ ] Test data sync

### Monitoring

- [ ] Set up error monitoring (Sentry, LogRocket, etc.)
- [ ] Configure analytics (Google Analytics, Mixpanel, etc.)
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Monitor API usage and rate limits
- [ ] Track user engagement

---

## 📊 Production URLs Summary

| Component | URL |
|-----------|-----|
| Frontend | https://procuroapp.com |
| Dashboard | https://procuroapp.com/dashboard |
| API | https://procuroapp.com/api |
| OAuth Connect | https://procuroapp.com/api/qb/connect |
| OAuth Callback | https://procuroapp.com/oauth/callback |
| QBO Launch | https://procuroapp.com/qbo_embed/iframe-loader.html |
| Manifest | https://procuroapp.com/qbo_embed/manifest.json |

---

## 🔐 Security Checklist

- [ ] HTTPS enabled on all endpoints
- [ ] SSL certificate valid and not expired
- [ ] CORS properly configured
- [ ] OAuth tokens encrypted in database
- [ ] Environment variables secured (not in git)
- [ ] API rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (Prisma ORM handles this)
- [ ] XSS protection headers set
- [ ] CSP headers configured

---

## 📝 Environment Variables Reference

### Production Backend (.env)

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/procuro"

# QuickBooks
QUICKBOOKS_CLIENT_ID=production_client_id
QUICKBOOKS_CLIENT_SECRET=production_secret
QUICKBOOKS_REDIRECT_URI=https://procuroapp.com/oauth/callback
QUICKBOOKS_ENVIRONMENT=production

# Server
PORT=5000
NODE_ENV=production
CLIENT_URL=https://procuroapp.com
```

### Production Frontend (.env)

```bash
VITE_API_URL=https://procuroapp.com/api
```

---

## ⚠️ Troubleshooting

### iframe not loading
- Check CORS headers
- Verify X-Frame-Options allows embedding
- Check browser console for errors

### OAuth failing
- Verify redirect URI matches exactly in Intuit Developer Dashboard
- Check environment variables are correct
- Ensure all required scopes are enabled

### API errors
- Check database connection
- Verify environment variables loaded
- Check server logs
- Test endpoints individually

### Mixed content warnings
- Ensure all resources loaded via HTTPS
- Check for hardcoded HTTP URLs
- Update API endpoints to use HTTPS

---

## ✅ Final Verification

**Before going live, confirm:**

- [x] ✅ All files created and deployed
- [x] ✅ Backend running in production
- [x] ✅ Frontend deployed and accessible
- [x] ✅ QBO embed files accessible
- [x] ✅ OAuth configured correctly
- [x] ✅ Intuit Developer Dashboard settings match
- [ ] ⏳ All production tests passing
- [ ] ⏳ App submitted to Intuit
- [ ] ⏳ App approved by Intuit
- [ ] ⏳ Monitoring and analytics configured

---

## 🎉 Launch Day

Once Intuit approves your app:

1. **Announce Launch:**
   - Blog post
   - Social media
   - Email to beta users
   - Press release (optional)

2. **Monitor Closely:**
   - Watch error logs
   - Track user signups
   - Monitor API usage
   - Collect user feedback

3. **Iterate:**
   - Fix bugs quickly
   - Add requested features
   - Improve UX based on feedback
   - Scale infrastructure as needed

---

**Ready to Deploy?** Follow this checklist step-by-step, and you'll have Procuro live in QuickBooks Online! 🚀

