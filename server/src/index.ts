import './loadEnv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import apiRoutes from './routes';
import quickbooksRoutes from './routes/quickbooks';
import simulateRoutes from './routes/simulate';
import itemsRoutes from './routes/items';
import alertsRoutes from './routes/alerts';
import savingsRoutes from './routes/savings';
import invitesRoutes from './routes/invites';
import backupRoutes from './routes/backup';
import storePriceRoutes from './routes/store-price';
import pricesRoutes from './routes/prices';
import providersRoutes from './routes/providers';
import billingRoutes from './routes/billing';
import companyRoutes from './routes/company';
import monitoringRoutes from './routes/monitoring';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { securityHeaders } from './middleware/securityHeaders';
import { companyContext } from './middleware/companyContext';
import { allowTestAndDebugRoutes } from './middleware/allowTestRoutes';
import testRoutes from './routes/test';
import debugRoutes from './routes/debug';
import { assertBrightDataConfigWhenEnabled } from './config/brightData';
import prisma from './lib/prisma';
import appConfig from '../../config/app.json';
import { startDailyPriceCheckCron } from './workers/dailyPriceCheck';
import { startTokenRefreshCron } from './workers/tokenRefresh';
import { getSchedulerRole, shouldStartCronSchedulers, validateRequiredEnvForRuntime } from './config/runtime';

// Fail startup if Bright Data is enabled but required env vars are missing
assertBrightDataConfigWhenEnabled();
validateRequiredEnvForRuntime();

const app = express();
const PORT = process.env.PORT || 5000;
const clientDistDir = path.join(__dirname, '../../client/dist');
const clientDistIndex = path.join(clientDistDir, 'index.html');
const hasClientDist = fs.existsSync(clientDistIndex);

// CORS configuration - Allow multiple origins for dev
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://dev.procuroapp.com:5173',
  ...(process.env.CORS_ORIGINS?.split(',') || []),
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(null, false); // Allow anyway for dev, but log warning
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Security headers middleware (applied to all routes)
app.use(securityHeaders);

// Middleware
app.use(cors(corsOptions));
// Stripe webhook needs raw body for signature verification
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Security: Block access to sensitive folders
const blockedPaths = [
  '/server',
  '/jobs',
  '/providers',
  '/db',
  '/.env',
  '/node_modules',
  '/prisma',
  '/.git',
  '/src'
];

app.use((req, res, next) => {
  const requestPath = req.path.toLowerCase();
  
  // Block access to sensitive folders
  if (blockedPaths.some(blocked => requestPath.startsWith(blocked))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Block access to TypeScript source files
  if (requestPath.endsWith('.ts') || requestPath.endsWith('.tsx')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Block access to environment files
  if (requestPath.includes('.env')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
});

// API rate limiting (applied to /api routes only)
// More lenient in development mode
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // 1000 requests in dev, 100 in production
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later.',
  // Skip rate limiting for localhost in development
  skip: (req) => {
    if (process.env.NODE_ENV === 'development') {
      const ip = req.ip || req.socket.remoteAddress || '';
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('127.0.0.1') || ip.startsWith('::1');
    }
    return false;
  },
});

// Apply rate limiting to API routes only
app.use('/api', apiLimiter);

// Simulate QuickBooks connected: serve real DB data for test user without companyContext (for testing UI)
app.use('/api/simulate', simulateRoutes);

// Resolve company context for tenant isolation (sets req.companyId)
app.use('/api', companyContext);

// Serve landing static assets (e.g. /landing/styles.css used by landing/index.html)
app.use('/landing', express.static(path.join(__dirname, '../../landing')));

// Health check endpoint (public, not rate limited)
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'ok',
      db: true,
      version: appConfig.version,
      time: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      db: false,
      version: appConfig.version,
      time: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Serve static legal pages
app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, '../../pages/support.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '../../pages/privacy.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, '../../pages/terms.html'));
});

// Serve landing page at root
app.get('/', (req, res) => {
  const landingPath = path.join(__dirname, '../../landing/index.html');
  res.sendFile(landingPath, (err) => {
    if (err) console.error('Landing sendFile error:', err);
  });
});

// Serve built SPA assets/routes for same-domain app entry (when client/dist exists).
if (hasClientDist) {
  app.use(
    '/assets',
    express.static(path.join(clientDistDir, 'assets'), {
      maxAge: '1y',
      immutable: true,
    })
  );

  const spaEntryRoutes = ['/activate', '/qb-success', '/dashboard', '/items', '/standalone'];
  app.get(spaEntryRoutes, (_req, res) => {
    res.sendFile(clientDistIndex);
  });
}

// Serve invite page
app.get('/invite/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '../../pages/invite.html'));
});

// Serve invite admin page
app.get('/dashboard/company/invite', (req, res) => {
  res.sendFile(path.join(__dirname, '../../pages/invite-admin.html'));
});

// API routes (public, but authenticated)
app.use('/api', apiRoutes);

// Backward-compatibility alias for legacy production OAuth callback URL.
app.get('/oauth/callback', (req, res) => {
  const queryStart = req.originalUrl.indexOf('?');
  const query = queryStart >= 0 ? req.originalUrl.slice(queryStart) : '';
  res.redirect(`/api/qb/callback${query}`);
});

// Debug: verify backend sees test user and items (helps when data is in Supabase but not in app)
app.get('/api/debug/context', allowTestAndDebugRoutes, async (req, res) => {
  try {
    const companyId = req.companyId;
    const user = req.companyContextUser;
    let itemCount = 0;
    if (companyId != null && user) {
      itemCount = await prisma.item.count({ where: { companyId, userId: user.id } });
    }
    res.json({
      userFound: !!user,
      companyId: companyId ?? null,
      userEmail: user?.email ?? null,
      itemCount,
      hint: !user ? 'Backend cannot find test user. If using Supabase pooler, run server/sql/rls_disable_for_pooler.sql in Supabase SQL Editor.' : (itemCount === 0 ? 'User found but no items. Run: npm run seed (from server folder).' : 'OK – app should show data.'),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.use('/api/qb', quickbooksRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api', savingsRoutes);
app.use('/api', invitesRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/store-price', storePriceRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/provider', providersRoutes); // Backend provider proxies
app.use('/api/billing', billingRoutes); // Stripe billing routes
app.use('/api/company', companyRoutes);
app.use('/api/monitoring', monitoringRoutes); // Company activation
app.use('/api/test', allowTestAndDebugRoutes, testRoutes);
app.use('/api/debug', allowTestAndDebugRoutes, debugRoutes);

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  🚀 Procuro Server v${appConfig.version}           ║`);
  console.log(`╚═══════════════════════════════════════════╝`);
  console.log(`\n📍 Server: http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  const dbUrl = process.env.DATABASE_URL || '';
  const dbLabel = dbUrl.includes('postgresql') || dbUrl.includes('supabase') || dbUrl.includes('pooler') ? 'PostgreSQL (Supabase)' : 'SQLite (local)';
  console.log(`💾 Database: ${dbLabel}`);
  console.log(`\n⏰ Scheduled Tasks:`);
  const schedulerRole = getSchedulerRole();
  console.log(`🧭 Scheduler role: ${schedulerRole}`);

  if (shouldStartCronSchedulers(schedulerRole)) {
    // Start cron jobs only on scheduler-authoritative processes.
    startDailyPriceCheckCron();
    startTokenRefreshCron();
  } else {
    console.log('⏸️  Cron schedulers disabled on this process (api-only role)');
  }
  
  console.log(`\n✅ Server ready and listening for requests\n`);
});
