import { Router, Request, Response } from 'express';
import { withCompany } from '../db/tenantDb';

const router = Router();

/**
 * GET /api/alerts (tenant-scoped via RLS)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) return res.status(404).json({ error: 'User or company not found' });

    const alerts = await withCompany(companyId, async (tx) => {
      return tx.alert.findMany({
        where: { userId: contextUser.id, companyId },
        include: { item: true },
        orderBy: { alertDate: 'desc' },
        take: 50,
      });
    });

    res.json({ success: true, count: alerts.length, alerts });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/alerts/unreadCount (tenant-scoped)
 */
router.get('/unreadCount', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) return res.status(404).json({ error: 'User or company not found' });

    const unreadCount = await withCompany(companyId, async (tx) => {
      return tx.alert.count({
        where: { userId: contextUser.id, companyId, seen: false },
      });
    });

    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unread count',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/alerts/markAllSeen (tenant-scoped)
 */
router.post('/markAllSeen', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) return res.status(404).json({ error: 'User or company not found' });

    const result = await withCompany(companyId, async (tx) => {
      return tx.alert.updateMany({
        where: { userId: contextUser.id, companyId, seen: false },
        data: { seen: true },
      });
    });

    res.json({ success: true, markedCount: result.count, message: `Marked ${result.count} alerts as seen` });
  } catch (error) {
    console.error('Error marking alerts as seen:', error);
    res.status(500).json({ 
      error: 'Failed to mark alerts as seen',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
