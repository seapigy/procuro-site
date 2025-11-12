# 🧪 Security Testing Guide

## Quick Start Testing

### Step 1: Start the Server

Open a terminal and run:

```bash
cd server
npm run dev
```

**Expected Output:**
```
🚀 Server running on http://localhost:5000
📊 Environment: development
⏰ Starting daily price check scheduler...
```

Keep this terminal open!

---

### Step 2: Run Automated Tests

Open a **NEW** terminal and run:

```bash
node test-security.js
```

**This will test:**
- ✅ Public pages (landing, support, privacy, terms, health)
- 🔒 Blocked paths (server code, jobs, providers, etc.)
- 📡 API endpoints

---

### Step 3: Manual Browser Testing

Open your browser and test these URLs:

#### ✅ Should Work (200 OK)

| URL | Expected Result |
|-----|-----------------|
| http://localhost:5000/ | Landing page with footer links |
| http://localhost:5000/support | Support page |
| http://localhost:5000/privacy | Privacy policy |
| http://localhost:5000/terms | Terms of use |
| http://localhost:5000/health | JSON: `{"status":"ok","version":"1.0.0","uptime":...}` |

#### 🔒 Should Be Blocked (403 Forbidden)

| URL | Expected Result |
|-----|-----------------|
| http://localhost:5000/server/src/index.ts | `{"error":"Access denied"}` |
| http://localhost:5000/jobs/dailyCheck.ts | `{"error":"Access denied"}` |
| http://localhost:5000/providers/amazon.ts | `{"error":"Access denied"}` |
| http://localhost:5000/db/schema.prisma | `{"error":"Access denied"}` |
| http://localhost:5000/.env | `{"error":"Access denied"}` |
| http://localhost:5000/prisma/schema.prisma | `{"error":"Access denied"}` |

---

### Step 4: Verify Footer Links

1. Visit: http://localhost:5000/
2. Scroll to bottom
3. Verify you see: **Support | Privacy Policy | Terms of Use**
4. Click each link - should open in new tab

---

## Manual cURL Testing

If you prefer command line testing:

### Test Public Pages

```bash
# Landing page
curl http://localhost:5000/

# Support
curl http://localhost:5000/support

# Privacy
curl http://localhost:5000/privacy

# Terms
curl http://localhost:5000/terms

# Health check
curl http://localhost:5000/health
```

### Test Blocked Paths

```bash
# Should all return {"error":"Access denied"}

curl http://localhost:5000/server/src/index.ts
curl http://localhost:5000/jobs/dailyCheck.ts
curl http://localhost:5000/providers/amazon.ts
curl http://localhost:5000/db/schema.prisma
curl http://localhost:5000/.env
```

---

## Troubleshooting

### Server Won't Start

**Check for port conflicts:**
```bash
# Windows
netstat -ano | findstr :5000

# If port is in use, kill the process or use a different port
```

**Check for TypeScript errors:**
```bash
cd server
npm run build
```

### Tests Fail

1. Make sure server is running (check http://localhost:5000/health)
2. Check console for errors
3. Verify Node.js version (needs 18+)

---

## Expected Test Results

When you run `node test-security.js`, you should see:

```
╔═══════════════════════════════════════════════════╗
║     PROCURO SECURITY VERIFICATION TESTS          ║
╚═══════════════════════════════════════════════════╝

📄 Testing Public Pages (Expected: 200 OK)
──────────────────────────────────────────────────

✅ Landing page
   Path: /
   Expected: 200, Got: 200

✅ Support page
   Path: /support
   Expected: 200, Got: 200

✅ Privacy policy
   Path: /privacy
   Expected: 200, Got: 200

✅ Terms of use
   Path: /terms
   Expected: 200, Got: 200

✅ Health check
   Path: /health
   Expected: 200, Got: 200

🔒 Testing Blocked Paths (Expected: 403 Forbidden)
──────────────────────────────────────────────────

✅ Server source code
   Path: /server/src/index.ts
   Expected: 403, Got: 403

✅ Background jobs
   Path: /jobs/dailyCheck.ts
   Expected: 403, Got: 403

✅ API providers
   Path: /providers/amazon.ts
   Expected: 403, Got: 403

... (more blocked paths)

╔═══════════════════════════════════════════════════╗
║   ✅ ALL TESTS PASSED - SECURITY VERIFIED! ✅     ║
╚═══════════════════════════════════════════════════╝

Total Tests: 16
✅ Passed: 16
```

---

## Production Testing

After deploying to production, test these URLs:

### Public Access
- ✅ https://procuroapp.com/
- ✅ https://procuroapp.com/support
- ✅ https://procuroapp.com/privacy
- ✅ https://procuroapp.com/terms
- ✅ https://procuroapp.com/health

### Blocked Access (should return 403)
- 🔒 https://procuroapp.com/server/src/index.ts
- 🔒 https://procuroapp.com/jobs/dailyCheck.ts
- 🔒 https://procuroapp.com/providers/amazon.ts
- 🔒 https://procuroapp.com/.env

---

## What Success Looks Like

✅ **Landing Page:**
- Displays with footer links
- Support | Privacy | Terms links present
- Links open in new tab

✅ **Legal Pages:**
- /support returns HTML
- /privacy returns HTML  
- /terms returns HTML
- All have professional styling

✅ **Health Check:**
- Returns JSON with status, version, uptime
- Returns 200 OK

✅ **Security:**
- All sensitive folders return 403
- No TypeScript source files accessible
- No environment variables exposed
- No database files accessible

✅ **Dashboard:**
- Has footer with Support | Privacy | Terms
- Links work and open in new tab

---

## Need Help?

If tests fail or you encounter issues:

1. Check server is running: http://localhost:5000/health
2. Review server logs for errors
3. Verify file paths in server/src/index.ts
4. Check Node.js version: `node --version` (needs 18+)
5. Reinstall dependencies: `cd server && npm install`

---

**Created:** January 2025  
**Status:** Ready for testing

