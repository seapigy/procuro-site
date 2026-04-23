# Deploy `procuroapp.com` with GoDaddy + Render

This setup keeps everything on a single domain:

- Landing page: `https://procuroapp.com/`
- App onboarding: `https://procuroapp.com/activate`
- API: `https://procuroapp.com/api/*`

## 1) Deploy app on Render

1. In Render, create a **Web Service** from this GitHub repo.
2. Ensure Render detects `render.yaml` from repo root.
3. Confirm:
   - Build command: `npm run install:all && npm run build`
   - Start command: `npm run start`
   - Health check: `/health`
4. Add environment variables in Render:
   - `DATABASE_URL`
   - `QUICKBOOKS_CLIENT_ID`
   - `QUICKBOOKS_CLIENT_SECRET`
   - `QUICKBOOKS_REDIRECT_URI=https://procuroapp.com/api/qb/callback`
   - `QUICKBOOKS_ENVIRONMENT=sandbox` (or `production` later)
   - `FRONTEND_URL=https://procuroapp.com`
   - `CORS_ORIGINS=https://procuroapp.com,https://www.procuroapp.com`
   - Stripe variables (if billing in use)
5. Wait for first successful deploy and verify:
   - `https://<your-render-service>.onrender.com/health` returns OK.

## 2) Point GoDaddy DNS to Render

In GoDaddy DNS for `procuroapp.com`:

1. Add/Update **CNAME**:
   - Host: `www`
   - Points to: `<your-render-service>.onrender.com`
2. Add/Update **A record** for apex:
   - Host: `@`
   - Value: `216.24.57.1`
3. Remove conflicting old records (for GitHub Pages) for `@` and `www`.
4. Save and wait for propagation (often minutes, can be longer).

## 3) Configure Render custom domain

1. In Render service settings, add custom domains:
   - `procuroapp.com`
   - `www.procuroapp.com`
2. Wait until Render marks certificate/SSL as active.

## 4) Update Intuit QuickBooks app config

In Intuit Developer portal, set redirect URI exactly:

`https://procuroapp.com/api/qb/callback`

## 5) Verify end-to-end

1. Open `https://procuroapp.com/`.
2. Click **Start Free Trial**.
3. Confirm URL is `https://procuroapp.com/activate` (no 404).
4. Click **Connect QuickBooks** and complete OAuth.
5. Confirm callback to app and import progress.
6. Optional checks:
   - `https://procuroapp.com/api/qb/status`
   - `https://procuroapp.com/api/company/activation`
