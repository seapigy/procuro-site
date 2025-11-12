import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { matchItemToRetailers } from '../services/matchItem';

const router = Router();

/**
 * GET /api/items
 * Get all items for the test user
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

    const items = await prisma.item.findMany({
      where: { userId: user.id },
      include: {
        prices: {
          orderBy: { date: 'desc' },
          take: 5, // Last 5 prices per item
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ 
      error: 'Failed to fetch items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/items
 * Create a new item and match it to retailers
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, category, lastPaidPrice, quantityPerOrder, reorderIntervalDays, upc } = req.body;

    // Validate required fields
    if (!name || lastPaidPrice === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: name and lastPaidPrice are required' 
      });
    }

    // Get test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@procuroapp.com' },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create the item
    const item = await prisma.item.create({
      data: {
        userId: user.id,
        name,
        category: category || null,
        lastPaidPrice: parseFloat(lastPaidPrice),
        quantityPerOrder: quantityPerOrder || 1,
        reorderIntervalDays: reorderIntervalDays || 30,
        upc: upc || null,
      },
    });

    // Match to retailers
    console.log(`🔗 Matching new item: ${item.name}...`);
    const match = await matchItemToRetailers(item.name, item.lastPaidPrice);
    
    if (match) {
      const updatedItem = await prisma.item.update({
        where: { id: item.id },
        data: {
          matchedRetailer: match.retailer,
          matchedUrl: match.url,
          matchedPrice: match.price,
        },
        include: {
          prices: true,
          alerts: true,
        },
      });

      res.json({
        success: true,
        item: updatedItem,
        matched: true,
        match: {
          retailer: match.retailer,
          price: match.price,
          url: match.url,
        },
      });
    } else {
      res.json({
        success: true,
        item,
        matched: false,
        message: 'Item created but no retailer match found',
      });
    }
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ 
      error: 'Failed to create item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/items/:id
 * Get single item with full details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        prices: {
          orderBy: { date: 'desc' },
        },
        alerts: {
          orderBy: { alertDate: 'desc' },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ 
      error: 'Failed to fetch item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
