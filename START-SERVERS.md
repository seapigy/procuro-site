# Starting ProcuroApp Servers

## 🚀 Manual Start Instructions

I've started both servers in the background, but if you need to start them manually:

### Option 1: Using npm root scripts (Recommended)

From the project root directory:

```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend  
npm run dev:client
```

### Option 2: Direct commands

**Backend Server:**
```bash
cd server
npm run dev
```
Expected output:
```
🚀 Server running on http://localhost:5000
📊 Environment: development
```

**Frontend Client:**
```bash
cd client
npm run dev
```
Expected output:
```
  VITE v5.0.8  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

---

## 🔍 Verify Servers Are Running

### Check Backend (Port 5000):
```bash
curl http://localhost:5000/health
```
Expected response:
```json
{"status":"ok","message":"ProcuroApp API is running"}
```

### Check Frontend (Port 5173):
Open browser to: `http://localhost:5173/`

---

## 🐛 Troubleshooting

### Issue: "Cannot reach page"

**Solution 1**: Make sure both servers are running
- Check Terminal 1: Should show "Server running on http://localhost:5000"
- Check Terminal 2: Should show "Local: http://localhost:5173/"

**Solution 2**: Check if ports are in use
```powershell
# PowerShell
Get-NetTCPConnection -LocalPort 5173
Get-NetTCPConnection -LocalPort 5000
```

**Solution 3**: Kill existing processes and restart
```powershell
# PowerShell - Kill processes on ports
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess -Force
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force
```

**Solution 4**: Install dependencies if missing
```bash
# Backend
cd server
npm install

# Frontend
cd client
npm install
```

---

## ✅ What You Should See

Once both servers are running:

### Terminal 1 (Backend):
```
> procuro-server@1.0.0 dev
> tsx watch src/index.ts

🚀 Server running on http://localhost:5000
📊 Environment: development
```

### Terminal 2 (Frontend):
```
> procuro-client@1.0.0 dev
> vite

  VITE v5.0.8  ready in 892 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Browser (http://localhost:5173/):
- QuickBooks sidebar on left
- "Procure & Save" top bar
- Dashboard with tracked items
- No errors in console

---

## 🎯 Quick Start Commands

**From project root, in separate terminals:**

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client
```

Then open: `http://localhost:5173/`

---

## 📝 Common Issues

### Port Already in Use
If you get "Port 5173 is already in use":
1. Find and kill the process using that port
2. Or change the port in `client/vite.config.ts`

### Module Not Found
If you get module errors:
```bash
cd client
npm install
```

### API Connection Failed
If frontend can't reach backend:
1. Verify backend is running on port 5000
2. Check CORS settings in `server/src/index.ts`
3. Check vite proxy in `client/vite.config.ts`

---

## 🔄 Restart Servers

If something goes wrong, restart both servers:

```bash
# Stop: Press Ctrl+C in both terminals

# Restart:
# Terminal 1
npm run dev:server

# Terminal 2  
npm run dev:client
```
