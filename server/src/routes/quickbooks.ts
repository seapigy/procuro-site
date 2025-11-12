import { Router, Request, Response } from 'express';
import OAuthClient from 'intuit-oauth';
import axios from 'axios';
import prisma from '../lib/prisma';
import { matchItemToRetailers } from '../services/matchItem';

const router = Router();

// Initialize OAuth client
const oauthClient = new OAuthClient({
  clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
  environment: (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:5000/api/qb/callback',
});

/**
 * GET /api/qb/connect
 * Initiates the QuickBooks OAuth 2.0 flow
 * Supports inviteToken parameter for joining existing companies
 */
router.get('/connect', (req: Request, res: Response) => {
  try {
    const { inviteToken } = req.query;
    
    // Store invite token in state if present
    const state = inviteToken 
      ? JSON.stringify({ inviteToken }) 
      : 'testState';
    
    // Generate authorization URI
    const authUri = oauthClient.authorizeUri({
      scope: [
        OAuthClient.scopes.Accounting,
        OAuthClient.scopes.OpenId,
        OAuthClient.scopes.Profile,
        OAuthClient.scopes.Email,
      ],
      state,
    });

    // Redirect user to QuickBooks authorization page
    res.redirect(authUri);
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    res.status(500).json({ error: 'Failed to initiate QuickBooks connection' });
  }
});

/**
 * GET /api/qb/callback
 * Handles the OAuth callback and token exchange
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const parseRedirect = req.url;

    // Exchange authorization code for access token
    const authResponse = await oauthClient.createToken(parseRedirect);
    const token = authResponse.getJson();

    // Extract realm ID (company ID)
    const realmId = oauthClient.getToken().realmId;
    
    // Extract state to check for invite token
    const state = req.query.state as string;
    let inviteToken: string | null = null;
    
    try {
      if (state && state !== 'testState') {
        const stateData = JSON.parse(state);
        inviteToken = stateData.inviteToken || null;
      }
    } catch (e) {
      // State is not JSON, ignore
    }

    // If invite token present, validate and use it
    let invitedCompany = null;
    if (inviteToken) {
      const invite = await prisma.invite.findUnique({
        where: { token: inviteToken },
        include: { company: true },
      });

      if (invite && !invite.used && new Date() < invite.expiresAt) {
        invitedCompany = invite.company;
        console.log(`✅ Valid invite found for: ${invitedCompany.name}`);
        
        // Mark invite as used
        await prisma.invite.update({
          where: { id: invite.id },
          data: { used: true },
        });
        console.log(`✅ Invite marked as used: ${inviteToken}`);
      } else {
        console.warn(`⚠️ Invalid or expired invite: ${inviteToken}`);
      }
    }

    // Determine company to use
    let company;
    
    if (invitedCompany) {
      // Use the company from the invite
      company = invitedCompany;
      console.log(`✅ Using invited company: ${company.name}`);
    } else {
      // Normal flow: fetch company info from QuickBooks API
      let companyName = null;
      try {
        const apiUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
          ? 'https://quickbooks.api.intuit.com'
          : 'https://sandbox-quickbooks.api.intuit.com';
        
        const companyInfoResponse = await axios.get(
          `${apiUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
          {
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Accept': 'application/json',
            },
          }
        );
        companyName = companyInfoResponse.data?.CompanyInfo?.CompanyName || null;
      } catch (error) {
        console.warn('Could not fetch company name, using realmId');
        companyName = `Company ${realmId}`;
      }

      // Find or create company
      company = await prisma.company.findUnique({
        where: { realmId: realmId },
      });

      if (!company) {
        company = await prisma.company.create({
          data: {
            realmId: realmId,
            name: companyName,
          },
        });
        console.log(`✅ Created new company: ${company.name} (${company.realmId})`);
      } else {
        // Update company name if we got a new one
        if (companyName && company.name !== companyName) {
          company = await prisma.company.update({
            where: { id: company.id },
            data: { name: companyName },
          });
        }
        console.log(`✅ Found existing company: ${company.name} (${company.realmId})`);
      }
    }

    // For this implementation, we'll use a test user
    // In production, you'd get the actual user from session/auth
    let user = await prisma.user.findFirst({
      where: { email: 'test@procuroapp.com' },
    });

    // Create test user if doesn't exist
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test@procuroapp.com',
          name: 'Test User',
          companyId: company.id,
        },
      });
      console.log(`✅ Created new user: ${user.email}`);
    } else {
      // Update user with company and QuickBooks tokens
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          companyId: company.id,
          quickbooksAccessToken: token.access_token,
          quickbooksRefreshToken: token.refresh_token,
          quickbooksRealmId: realmId,
          quickbooksConnectedAt: new Date(),
        },
      });
      console.log(`✅ Updated user: ${user.email} → linked to company ${company.name}`);
    }

    // Fetch and store purchase items
    await fetchAndStoreItems(user.id, token.access_token, realmId);

    res.send(`
      <html>
        <body>
          <h1>✅ QuickBooks Connected Successfully!</h1>
          ${inviteToken ? '<p><strong>You joined via invite link!</strong></p>' : ''}
          <p>Company: ${company.name}</p>
          <p>Realm ID: ${realmId}</p>
          <p>User: ${user.email}</p>
          <p><a href="http://localhost:5173">Return to Dashboard</a></p>
          <p><a href="/api/qb/items">View Imported Items</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.status(500).json({ 
      error: 'Failed to complete QuickBooks authorization',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/qb/items
 * List all imported items for the test user
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    // Get test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@procuroapp.com' },
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'Test user not found. Please connect to QuickBooks first.',
        connectUrl: '/api/qb/connect'
      });
    }

    // Fetch items for this user
    const items = await prisma.item.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        quickbooksConnected: !!user.quickbooksRealmId,
        connectedAt: user.quickbooksConnectedAt,
      },
      itemCount: items.length,
      items: items,
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
 * Helper function to fetch purchase/bill items from QuickBooks
 * and store them in the database
 */
async function fetchAndStoreItems(
  userId: string, 
  accessToken: string, 
  realmId: string
): Promise<void> {
  try {
    const companyId = realmId;
    const apiUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    // Query for Purchase transactions
    // QuickBooks API query to get last 100 purchases/bills
    const query = `SELECT * FROM Purchase MAXRESULTS 100`;
    
    const response = await axios.get(
      `${apiUrl}/v3/company/${companyId}/query`,
      {
        params: { query, minorversion: 65 },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    const purchases = response.data?.QueryResponse?.Purchase || [];

    // Process and store items
    const itemsToCreate = [];

    for (const purchase of purchases) {
      // Extract line items from the purchase
      const lines = purchase.Line || [];
      
      for (const line of lines) {
        if (line.DetailType === 'ItemBasedExpenseLineDetail' && line.ItemBasedExpenseLineDetail) {
          const detail = line.ItemBasedExpenseLineDetail;
          const item = detail.ItemRef;
          
          itemsToCreate.push({
            userId: userId,
            name: item?.name || line.Description || 'Unnamed Item',
            category: detail.ClassRef?.name || line.Description || null,
            lastPaidPrice: line.Amount || 0,
          });
        } else if (line.DetailType === 'AccountBasedExpenseLineDetail' && line.AccountBasedExpenseLineDetail) {
          // Handle account-based expenses as well
          itemsToCreate.push({
            userId: userId,
            name: line.Description || 'Unnamed Expense',
            category: line.AccountBasedExpenseLineDetail.AccountRef?.name || null,
            lastPaidPrice: line.Amount || 0,
          });
        }
      }
    }

    // Clear existing items for this user (to avoid duplicates)
    await prisma.item.deleteMany({
      where: { userId },
    });

    // Create items and match them to retailers
    if (itemsToCreate.length > 0) {
      console.log(`📦 Storing ${itemsToCreate.length} items...`);
      
      for (const itemData of itemsToCreate) {
        // Create the item
        const item = await prisma.item.create({
          data: itemData,
        });

        // Match to retailers
        console.log(`🔗 Matching: ${item.name}...`);
        const match = await matchItemToRetailers(item.name, item.lastPaidPrice);
        
        if (match) {
          await prisma.item.update({
            where: { id: item.id },
            data: {
              matchedRetailer: match.retailer,
              matchedUrl: match.url,
              matchedPrice: match.price,
            },
          });
        }
      }
      
      console.log(`✅ Stored and matched ${itemsToCreate.length} items for user ${userId}`);
    } else {
      console.log('⚠️ No purchase items found in QuickBooks');
    }

  } catch (error) {
    console.error('Error fetching/storing QuickBooks items:', error);
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data);
    }
    throw error;
  }
}

export default router;




