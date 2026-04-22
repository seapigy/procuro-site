import { Router, Request, Response } from 'express';
import { withCompany } from '../db/tenantDb';
import { buildSavingsSummaryPayload } from '../services/savingsSummary';

const router = Router();

/**
 * GET /api/savings-summary (tenant-scoped via RLS)
 * Last-30-day alert metrics. May insert `Alert` rows for qualifying open deals that had no alert
 * in that window so totals match GET /api/alerts.
 */
router.get('/savings-summary', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) return res.status(404).json({ error: 'User or company not found' });

    const payload = await withCompany(companyId, async (tx) =>
      buildSavingsSummaryPayload(tx, companyId, contextUser.id)
    );

    res.json(payload);
  } catch (error) {
    console.error('Error fetching savings summary:', error);
    res.status(500).json({
      error: 'Failed to fetch savings summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
