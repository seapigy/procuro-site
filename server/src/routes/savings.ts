import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

/**
 * GET /api/savings-summary
 * Get comprehensive savings analytics for the test user
 */
router.get('/savings-summary', async (req: Request, res: Response) => {
  try {
    // Get test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@procuroapp.com' },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all alerts from the last 30 days
    const recentAlerts = await prisma.alert.findMany({
      where: {
        userId: user.id,
        alertDate: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        item: true,
      },
    });

    // Sum total monthly savings
    const totalMonthlySavings = recentAlerts.reduce(
      (sum, alert) => sum + alert.estimatedMonthlySavings,
      0
    );

    // Count total items monitored
    const totalItemsMonitored = await prisma.item.count({
      where: { userId: user.id },
    });

    // Count alerts this month
    const alertsThisMonth = recentAlerts.length;

    // Find highest savings alert
    let topSavingsItem = null;
    if (recentAlerts.length > 0) {
      const topAlert = recentAlerts.reduce((max, alert) => 
        alert.estimatedMonthlySavings > max.estimatedMonthlySavings ? alert : max
      );

      topSavingsItem = {
        name: topAlert.item.name,
        savingsPerOrder: topAlert.savingsPerOrder,
        estimatedMonthlySavings: topAlert.estimatedMonthlySavings,
        retailer: topAlert.retailer,
        url: topAlert.url,
      };
    }

    // Calculate estimated annual savings
    const estimatedAnnualSavings = totalMonthlySavings * 12;

    res.json({
      success: true,
      totalMonthlySavings,
      totalItemsMonitored,
      alertsThisMonth,
      topSavingsItem,
      estimatedAnnualSavings,
    });
  } catch (error) {
    console.error('Error fetching savings summary:', error);
    res.status(500).json({
      error: 'Failed to fetch savings summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;







