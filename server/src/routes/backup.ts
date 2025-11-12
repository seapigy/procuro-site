import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * GET /api/backup
 * Download SQLite database file for local backup
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Path to SQLite database
    const dbPath = path.join(__dirname, '../../../db/procuro.db');
    
    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ 
        error: 'Database file not found',
        path: dbPath 
      });
    }

    // Get file stats
    const stats = fs.statSync(dbPath);
    const fileSizeInBytes = stats.size;
    
    // Generate timestamp filename
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `procuro-backup-${timestamp}.sqlite`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileSizeInBytes);
    
    console.log(`📦 Streaming database backup: ${filename} (${(fileSizeInBytes / 1024).toFixed(2)} KB)`);
    
    // Create read stream and pipe to response
    const fileStream = fs.createReadStream(dbPath);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming database file:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Failed to stream database file',
          details: error.message 
        });
      }
    });
    
    fileStream.on('end', () => {
      console.log(`✅ Database backup download completed: ${filename}`);
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error creating database backup:', error);
    res.status(500).json({ 
      error: 'Failed to create database backup',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

