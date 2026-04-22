# Frontend Deployment Guide

This guide explains how to deploy the ProcuroApp frontend to production using environment variables.

## Environment Variables

The frontend uses `VITE_API_URL` to configure the backend API URL.

### Local Development

For local development, create a `.env` file in the `client/` directory:

```env
VITE_API_URL=http://localhost:5000
```

**Note:** If `VITE_API_URL` is not set, the app will use relative paths which work with Vite's proxy in development mode.

### Production Deployment

For production, set `VITE_API_URL` to your actual backend API URL.

## Deployment Platforms

### Vercel

1. **Set Environment Variable:**
   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add: `VITE_API_URL` = `https://api.procuroapp.com` (or your backend URL)

2. **Build Settings:**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Deploy:**
   - Push to your connected Git repository
   - Vercel will automatically build and deploy

### Netlify

1. **Set Environment Variable:**
   - Go to Site settings → Environment variables
   - Add: `VITE_API_URL` = `https://api.procuroapp.com` (or your backend URL)

2. **Build Settings:**
   - Base directory: `client`
   - Build command: `npm run build`
   - Publish directory: `client/dist`

3. **Deploy:**
   - Connect your Git repository
   - Netlify will automatically build and deploy

### Cloudflare Pages

1. **Set Environment Variable:**
   - Go to Pages → Settings → Environment variables
   - Add: `VITE_API_URL` = `https://api.procuroapp.com` (or your backend URL)

2. **Build Settings:**
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`

3. **Deploy:**
   - Connect your Git repository
   - Cloudflare Pages will automatically build and deploy

## Verification

After deployment, verify the environment variable is working:

1. Open browser DevTools (F12)
2. Go to Console
3. Check network requests - they should point to your production API URL
4. Verify API calls are successful

## Public Website CTA Contract

- Public marketing CTAs should route users to `/activate` (frontend onboarding route), not directly to backend OAuth endpoints.
- Activation flow then calls API endpoints using `VITE_API_URL` and `apiUrl(...)` so split-domain deployments stay stable.
- Keep this behavior aligned with `landing/index.html` and `client/src/App.tsx` routes.

## Troubleshooting

### API calls failing

- **Check environment variable:** Ensure `VITE_API_URL` is set correctly in your deployment platform
- **Check CORS:** Ensure your backend allows requests from your frontend domain
- **Check network tab:** Verify the actual URL being called in browser DevTools

### Build errors

- **Missing environment variable:** Set `VITE_API_URL` in your deployment platform
- **Type errors:** Run `npm run build` locally first to catch TypeScript errors

## Example .env Files

### Development (.env.local)
```env
VITE_API_URL=http://localhost:5000
```

### Production (.env.production)
```env
VITE_API_URL=https://api.procuroapp.com
```

**Note:** `.env.production` is optional - it's better to set environment variables in your deployment platform.

