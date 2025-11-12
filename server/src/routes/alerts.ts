import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

/**
 * GET /api/alerts
 * Get all alerts for the test user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // For now, use test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@procuroapp.com' },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const alerts = await prisma.alert.findMany({
      where: { userId: user.id },
      include: {
        item: true,
      },
      orderBy: { alertDate: 'desc' },
      take: 50, // Last 50 alerts
    });

    res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/alerts/unreadCount
 * Get count of unseen alerts for the test user
 */
router.get('/unreadCount', async (req: Request, res: Response) => {
  try {
    // For now, use test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@procuroapp.com' },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const unreadCount = await prisma.alert.count({
      where: { 
        userId: user.id,
        seen: false,
      },
    });

    res.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unread count',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/alerts/markAllSeen
 * Mark all alerts as seen for the test user
 */
router.post('/markAllSeen', async (req: Request, res: Response) => {
  try {
    // For now, use test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@procuroapp.com' },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await prisma.alert.updateMany({
      where: { 
        userId: user.id,
        seen: false,
      },
      data: {
        seen: true,
      },
    });

    res.json({
      success: true,
      markedCount: result.count,
      message: `Marked ${result.count} alerts as seen`,
    });
  } catch (error) {
    console.error('Error marking alerts as seen:', error);
    res.status(500).json({ 
      error: 'Failed to mark alerts as seen',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
