import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRoutes from './routes';
import quickbooksRoutes from './routes/quickbooks';
import itemsRoutes from './routes/items';
import alertsRoutes from './routes/alerts';
import savingsRoutes from './routes/savings';
import { runDailyPriceCheck } from '../../jobs/dailyCheck';

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
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    uptime: process.uptime() 
  });
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

// API routes (public, but authenticated)
app.use('/api', apiRoutes);
app.use('/api/qb', quickbooksRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api', savingsRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start daily price check scheduler
  console.log('⏰ Starting daily price check scheduler...');
  setInterval(runDailyPriceCheck, 24 * 60 * 60 * 1000); // 1x / day
  runDailyPriceCheck(); // run once immediately
});
