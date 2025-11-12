/**
 * Price monitoring job
 * 
 * This job runs periodically to check prices for all active monitors
 * and update the database with current pricing data.
 */

import prisma from '../server/src/lib/prisma';
import { AmazonProvider } from '../providers/amazon';

interface MonitorUpdateResult {
  monitorId: string;
  success: boolean;
  newPrice?: number;
  error?: string;
}

/**
 * Update prices for all active monitors
 */
export async function updatePrices(): Promise<MonitorUpdateResult[]> {
  const activeMonitors = await prisma.priceMonitor.findMany({
    where: { isActive: true },
    include: { user: true },
  });

  const results: MonitorUpdateResult[] = [];

  for (const monitor of activeMonitors) {
    try {
      // Initialize appropriate provider based on retailer
      let provider;
      switch (monitor.retailer.toLowerCase()) {
        case 'amazon':
          provider = new AmazonProvider({
            accessKey: process.env.AMAZON_ACCESS_KEY!,
            secretKey: process.env.AMAZON_SECRET_KEY!,
            region: process.env.AMAZON_REGION || 'us-east-1',
          });
          break;
        default:
          results.push({
            monitorId: monitor.id,
            success: false,
            error: `Unsupported retailer: ${monitor.retailer}`,
          });
          continue;
      }

      // Fetch current price
      const priceData = await provider.getPrice(monitor.productUrl);

      // Update monitor and create price history entry
      await prisma.$transaction([
        prisma.priceMonitor.update({
          where: { id: monitor.id },
          data: {
            currentPrice: priceData.price,
            updatedAt: new Date(),
          },
        }),
        prisma.priceHistory.create({
          data: {
            monitorId: monitor.id,
            price: priceData.price,
            recordedAt: new Date(),
          },
        }),
      ]);

      results.push({
        monitorId: monitor.id,
        success: true,
        newPrice: priceData.price,
      });
    } catch (error) {
      results.push({
        monitorId: monitor.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}





