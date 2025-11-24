import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

interface StorePriceRequest {
  itemId: number;
  retailer: string;
  price: number | null;
  url: string | null;
  stock: boolean | null;
  title: string | null;
  image: string | null;
}

/**
 * POST /api/store-price
 * Store price data from browser-based price checks
 * This endpoint receives price data from the frontend after browser-based scraping
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: StorePriceRequest = req.body;

    // Validate required fields
    if (!data.itemId || !data.retailer) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'itemId and retailer are required',
      });
    }

    // Validate itemId is a number
    const itemId = parseInt(String(data.itemId));
    if (isNaN(itemId)) {
      return res.status(400).json({
        error: 'Invalid itemId',
        details: 'itemId must be a valid number',
      });
    }

    // Fetch the item to verify it exists
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return res.status(404).json({
        error: 'Item not found',
        details: `No item found with ID ${itemId}`,
      });
    }

    // If price is null, just log it and return success
    if (data.price === null) {
      console.log(`ℹ️  No price data from ${data.retailer} for item ${item.name}`);
      return res.json({
        success: true,
        message: 'No price data available',
        stored: false,
      });
    }

    // Validate price is a positive number
    const price = parseFloat(String(data.price));
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({
        error: 'Invalid price',
        details: 'Price must be a positive number',
      });
    }

    // Store the price in the database
    const priceRecord = await prisma.price.create({
      data: {
        itemId: item.id,
        retailer: data.retailer,
        price: price,
        url: data.url || null,
        date: new Date(),
      },
    });

    console.log(`💾 Stored price: ${data.retailer} - ${item.name} - $${price.toFixed(2)}`);

    // Update item's lastCheckedPrice
    await prisma.item.update({
      where: { id: item.id },
      data: {
        lastCheckedPrice: price,
        matchedRetailer: data.retailer,
        matchedUrl: data.url || undefined,
        matchedPrice: price,
      },
    });

    // Check if this price is significantly lower than lastPaidPrice
    const savings = item.lastPaidPrice - price;
    const savingsPercent = (savings / item.lastPaidPrice) * 100;

    let alertCreated = false;

    // Create alert if savings >= 5%
    if (savingsPercent >= 5) {
      const estimatedMonthlySavings =
        (savings * item.quantityPerOrder * 30) / (item.reorderIntervalDays || 30);

      await prisma.alert.create({
        data: {
          userId: item.userId,
          itemId: item.id,
          retailer: data.retailer,
          oldPrice: item.lastPaidPrice,
          newPrice: price,
          priceDropAmount: savings,
          savingsPerOrder: savings * item.quantityPerOrder,
          estimatedMonthlySavings,
          url: data.url || '',
          viewed: false,
          seen: false,
          alertDate: new Date(),
          dateTriggered: new Date(),
        },
      });

      alertCreated = true;
      console.log(`🔔 Alert created: Save $${savings.toFixed(2)} (${savingsPercent.toFixed(1)}%) on ${item.name} from ${data.retailer}`);
    }

    res.json({
      success: true,
      stored: true,
      priceId: priceRecord.id,
      savings: savings > 0 ? savings : null,
      savingsPercent: savings > 0 ? savingsPercent : null,
      alertCreated,
      message: alertCreated
        ? `Price stored and alert created! Save $${savings.toFixed(2)} (${savingsPercent.toFixed(1)}%)`
        : 'Price stored successfully',
    });
  } catch (error) {
    console.error('Error storing price:', error);
    res.status(500).json({
      error: 'Failed to store price',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/store-prices/bulk
 * Store multiple price results from a single browser-based price check
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { itemId, results } = req.body;

    if (!itemId || !Array.isArray(results)) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'itemId and results array are required',
      });
    }

    const item = await prisma.item.findUnique({
      where: { id: parseInt(String(itemId)) },
    });

    if (!item) {
      return res.status(404).json({
        error: 'Item not found',
      });
    }

    const storedPrices = [];
    const alertsCreated = [];
    let bestPrice: { retailer: string; price: number; url: string | null } | null = null;

    for (const result of results) {
      if (result.price === null || result.price <= 0) {
        continue;
      }

      // Store price
      const priceRecord = await prisma.price.create({
        data: {
          itemId: item.id,
          retailer: result.retailer,
          price: result.price,
          url: result.url || null,
          date: new Date(),
        },
      });

      storedPrices.push({
        retailer: result.retailer,
        price: result.price,
        priceId: priceRecord.id,
      });

      // Track best price
      if (!bestPrice || result.price < bestPrice.price) {
        bestPrice = {
          retailer: result.retailer,
          price: result.price,
          url: result.url,
        };
      }

      // Check for alerts
      const savings = item.lastPaidPrice - result.price;
      const savingsPercent = (savings / item.lastPaidPrice) * 100;

      if (savingsPercent >= 5) {
        const estimatedMonthlySavings =
          (savings * item.quantityPerOrder * 30) / (item.reorderIntervalDays || 30);

        await prisma.alert.create({
          data: {
            userId: item.userId,
            itemId: item.id,
            retailer: result.retailer,
            oldPrice: item.lastPaidPrice,
            newPrice: result.price,
            priceDropAmount: savings,
            savingsPerOrder: savings * item.quantityPerOrder,
            estimatedMonthlySavings,
            url: result.url || '',
            viewed: false,
            seen: false,
            alertDate: new Date(),
            dateTriggered: new Date(),
          },
        });

        alertsCreated.push({
          retailer: result.retailer,
          savings,
          savingsPercent,
        });
      }
    }

    // Update item with best price found
    if (bestPrice) {
      await prisma.item.update({
        where: { id: item.id },
        data: {
          lastCheckedPrice: bestPrice.price,
          matchedRetailer: bestPrice.retailer,
          matchedUrl: bestPrice.url || undefined,
          matchedPrice: bestPrice.price,
        },
      });
    }

    console.log(`💾 Bulk store: ${storedPrices.length} prices stored for "${item.name}"`);
    console.log(`🔔 Created ${alertsCreated.length} alerts`);

    res.json({
      success: true,
      itemId: item.id,
      itemName: item.name,
      pricesStored: storedPrices.length,
      alertsCreated: alertsCreated.length,
      bestPrice,
      storedPrices,
      alerts: alertsCreated,
    });
  } catch (error) {
    console.error('Error in bulk store:', error);
    res.status(500).json({
      error: 'Failed to store prices',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;




