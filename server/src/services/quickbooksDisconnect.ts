import { Request } from 'express';
import prisma from '../lib/prisma';
import OAuthClient from 'intuit-oauth';
import { getDecryptedQBTokens } from '../utils/crypto';
import appConfig from '../../../config/app.json';

const TEST_MODE =
  String(process.env.TEST_MODE || '').trim().toLowerCase() === 'true' ||
  (appConfig.testing?.testMode as boolean) ||
  false;
const TEST_USER_EMAIL = (appConfig.testing?.testUserEmail as string) || 'test@procuroapp.com';

/**
 * Service to handle QuickBooks disconnection
 * Revokes tokens, clears QuickBooks data, and stops monitoring
 */
export async function disconnectQuickBooksForRequest(req: Request) {
  try {
    const user = req.companyContextUser
      ? await prisma.user.findUnique({
          where: { id: req.companyContextUser.id },
          include: { company: true },
        })
      : req.companyId
      ? await prisma.user.findFirst({
          where: { companyId: req.companyId },
          include: { company: true },
        })
      : TEST_MODE
      ? await prisma.user.findFirst({
          where: { email: TEST_USER_EMAIL },
          include: { company: true },
        })
      : null;

    if (!user || !user.companyId) {
      throw new Error('User or company not found');
    }

    const company = user.company;

    if (!company) {
      throw new Error('Company not found');
    }

    // Check if QuickBooks is actually connected
    if (!company.realmId && !user.quickbooksRealmId) {
      console.log('⚠️ QuickBooks not connected for this company');
      return { success: true, message: 'QuickBooks was not connected' };
    }

    const realmId = company.realmId || user.quickbooksRealmId;
    const { accessToken, refreshToken } = getDecryptedQBTokens(user);

    // Attempt to revoke tokens via Intuit API (optional but recommended)
    if (accessToken || refreshToken) {
      try {
        const oauthClient = new OAuthClient({
          clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
          clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
          environment: (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
          redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:5000/api/qb/callback',
        });

        // Set the token to revoke
        if (accessToken) {
          oauthClient.setToken({
            access_token: accessToken,
            refresh_token: refreshToken || '',
            realmId: realmId || '',
          });

          // Revoke the token
          try {
            await oauthClient.revoke();
            console.log('✅ QuickBooks tokens revoked via Intuit API');
          } catch (revokeError) {
            // If revocation fails, log but continue with cleanup
            // This can happen if tokens are already expired or invalid
            console.warn('⚠️ Could not revoke tokens via API (may already be expired):', revokeError);
          }
        }
      } catch (error) {
        // If OAuth client setup fails, continue with database cleanup
        console.warn('⚠️ Could not revoke tokens via API, continuing with database cleanup:', error);
      }
    }

    // Clear QuickBooks tokens from user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        quickbooksAccessToken: null,
        quickbooksRefreshToken: null,
        quickbooksRealmId: null,
        quickbooksConnectedAt: null,
        quickbooksId: null,
      },
    });

    console.log(`✅ Cleared QuickBooks tokens for user: ${user.email}`);

    // Update company to clear QuickBooks linkage
    await prisma.company.update({
      where: { id: company.id },
      data: {
        realmId: null,
        isQuickBooksConnected: false,
      },
    });

    console.log(`✅ Disconnected QuickBooks for company: ${company.name} (ID: ${company.id})`);

    // Mark all items as not monitored (since we can't get new purchase data)
    // This stops daily price checks for this company's items
    const usersInCompany = await prisma.user.findMany({
      where: { companyId: company.id },
      select: { id: true },
    });

    const userIds = usersInCompany.map(u => u.id);

    if (userIds.length > 0) {
      const itemsUpdated = await prisma.item.updateMany({
        where: {
          userId: { in: userIds },
        },
        data: {
          isMonitored: false,
        },
      });

      console.log(`✅ Marked ${itemsUpdated.count} items as not monitored (no new QuickBooks data)`);
    }

    return {
      success: true,
      message: 'QuickBooks disconnected successfully',
      companyId: company.id,
      itemsUnmonitored: userIds.length > 0 ? (await prisma.item.count({ where: { userId: { in: userIds } } })) : 0,
    };
  } catch (error) {
    console.error('Error disconnecting QuickBooks:', error);
    throw error;
  }
}

