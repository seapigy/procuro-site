import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import morgan from 'morgan';
import apiRoutes from './routes';
import quickbooksRoutes from './routes/quickbooks';
import itemsRoutes from './routes/items';
import alertsRoutes from './routes/alerts';
import savingsRoutes from './routes/savings';
import invitesRoutes from './routes/invites';
import backupRoutes from './routes/backup';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { prisma } from './prisma';
import appConfig from '../../config/app.json';
import { startDailyPriceCheckCron } from './workers/dailyPriceCheck';
import { startTokenRefreshCron } from './workers/tokenRefresh';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
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

// Health check endpoint (public)
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
  res.sendFile(path.join(__dirname, '../../landing/index.html'));
});

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
app.use('/api/qb', quickbooksRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api', savingsRoutes);
app.use('/api', invitesRoutes);
app.use('/api/backup', backupRoutes);

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
  console.log(`💾 Database: SQLite (local)`);
  console.log(`\n⏰ Scheduled Tasks:`);
  
  // Start cron jobs
  startDailyPriceCheckCron();
  startTokenRefreshCron();
  
  console.log(`\n✅ Server ready and listening for requests\n`);
});
