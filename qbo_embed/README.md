# Procuro - QuickBooks Online Embedded App

This folder contains the QuickBooks Online (QBO) embedded app integration for Procuro.

## 📁 Files

### `manifest.json`
QuickBooks App manifest file required for app submission to Intuit Developer Portal.

**Key Details:**
- App Name: Procuro
- Version: 1.0.0
- Launch URL: `https://procuroapp.com/qbo_embed/iframe-loader.html`
- OAuth Redirect: `https://procuroapp.com/oauth/callback`

**Scopes:**
- `com.intuit.quickbooks.accounting` - Access to accounting data
- `openid` - OpenID Connect authentication
- `profile` - User profile information
- `email` - User email address

### `iframe-loader.html`
Main entry point for the embedded app. This file:
- Loads the Procuro dashboard in an iframe
- Handles OAuth token retrieval from URL parameters
- Communicates with the dashboard via postMessage API
- Provides loading indicator during initialization
- Supports both production and local development

**URL Parameters:**
- `token` - OAuth access token (if passed by QuickBooks)
- `realmId` - QuickBooks company ID

**Features:**
- ✅ Full-screen iframe embedding
- ✅ OAuth token handling
- ✅ Loading state management
- ✅ Cross-origin message handling
- ✅ Development/production URL switching
- ✅ Error handling

### `index.html`
Simple redirect page for testing. Redirects to `iframe-loader.html` while preserving query parameters.

## 🚀 Deployment

### Development Testing

For local testing, update `iframe-loader.html` to point to localhost:

```javascript
const DASHBOARD_URL = 'http://localhost:5173';
```

Then serve this folder:
```bash
# From project root
npx serve qbo_embed
```

### Production Deployment

1. **Deploy files to production:**
   - Upload entire `qbo_embed` folder to your web server
   - Ensure files are accessible at `https://procuroapp.com/qbo_embed/`

2. **Verify URLs:**
   - Launch URL: `https://procuroapp.com/qbo_embed/iframe-loader.html`
   - OAuth Callback: `https://procuroapp.com/oauth/callback`

3. **Test iframe loading:**
   ```
   https://procuroapp.com/qbo_embed/iframe-loader.html
   ```

## 🔐 OAuth Setup

### Intuit Developer Dashboard Configuration

1. Navigate to [developer.intuit.com](https://developer.intuit.com)
2. Select your Procuro app
3. Go to **Keys & OAuth**

**Verify Settings:**
- ✅ Redirect URI: `https://procuroapp.com/oauth/callback`
- ✅ Scopes enabled:
  - Accounting
  - OpenID
  - Profile
  - Email

### OAuth Flow

```
QuickBooks Online
      ↓
  Launches iframe
      ↓
iframe-loader.html
      ↓
  Checks for token param
      ↓
  Passes to dashboard
      ↓
Dashboard receives auth
      ↓
  Makes API calls
```

## 🧪 Testing

### Test Locally

1. Start the client:
   ```bash
   cd client
   npm run dev
   ```

2. Start the server:
   ```bash
   cd server
   npm run dev
   ```

3. Serve the qbo_embed folder:
   ```bash
   npx serve qbo_embed -p 3000
   ```

4. Open in browser:
   ```
   http://localhost:3000/iframe-loader.html
   ```

### Test in QuickBooks Sandbox

1. Create a QuickBooks Sandbox app in Intuit Developer Portal
2. Set Launch URL to your deployed iframe-loader URL
3. Install app in sandbox company
4. Launch from QuickBooks Apps menu

## 📊 Monitoring

The iframe-loader includes console logging for:
- OAuth token detection
- Realm ID (company ID)
- Load events
- Message passing
- Errors

Open browser DevTools to monitor activity.

## 🔧 Troubleshooting

### Iframe not loading
- Check CORS headers on your server
- Verify dashboard URL is correct
- Check browser console for errors

### OAuth not working
- Verify redirect URI matches exactly in Intuit Developer Dashboard
- Check that scopes are enabled
- Verify token is being passed in URL params

### Blank screen
- Check that dashboard is accessible at the configured URL
- Verify no X-Frame-Options blocking iframe
- Check CSP headers allow iframe embedding

## 📝 Next Steps

1. **Submit to Intuit:**
   - Upload `manifest.json` to Intuit Developer Portal
   - Complete app listing details
   - Submit for review

2. **Production Readiness:**
   - Implement proper OAuth token refresh
   - Add error boundaries
   - Implement analytics tracking
   - Add user feedback mechanisms

3. **Enhanced Features:**
   - Real-time sync with QuickBooks data
   - Purchase history import
   - Expense categorization
   - Invoice integration

## 📚 Resources

- [QuickBooks Online Apps Documentation](https://developer.intuit.com/app/developer/qbo/docs/get-started)
- [OAuth 2.0 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [Intuit Developer Portal](https://developer.intuit.com/)

## ⚠️ Security Notes

- Never expose OAuth tokens in client-side code
- Always validate message origins in postMessage handlers
- Use HTTPS in production
- Implement CSRF protection
- Rotate credentials regularly

