import cron from 'node-cron';
import axios from 'axios';
import prisma from '../lib/prisma';
import appConfig from '../../../config/app.json';
import { encryptTokens, getDecryptedQBTokens } from '../utils/crypto';

/**
 * Token refresh worker
 * Refreshes QuickBooks access tokens for all connected users
 * Runs daily at configured time (default 2 AM)
 */

let isRunning = false;

export async function runTokenRefresh() {
  if (isRunning) {
    console.log('⏸️  Token refresh already running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = new Date();
  console.log(`\n🔄 Starting token refresh at ${startTime.toISOString()}`);

  try {
    // Get all users with QuickBooks connections
    const users = await prisma.user.findMany({
      where: {
        quickbooksRefreshToken: {
          not: null
        }
      }
    });

    console.log(`👥 Found ${users.length} users with QuickBooks connections`);

    let refreshedCount = 0;
    let errors = 0;

    for (const user of users) {
      try {
        if (!user.quickbooksRefreshToken || !user.quickbooksRealmId) {
          console.log(`⚠️  User ${user.email} missing refresh token or realm ID`);
          continue;
        }

        const { refreshToken: plainRefreshToken } = getDecryptedQBTokens(user);
        if (!plainRefreshToken) {
          console.log(`⚠️  User ${user.email} could not decrypt refresh token`);
          continue;
        }

        // Refresh the token
        const newTokens = await refreshQuickBooksToken(
          plainRefreshToken,
          user.quickbooksRealmId
        );

        if (newTokens) {
          // Encrypt and save new tokens
          const encrypted = encryptTokens(newTokens.accessToken, newTokens.refreshToken);

          await prisma.user.update({
            where: { id: user.id },
            data: {
              quickbooksAccessToken: encrypted.accessToken,
              quickbooksRefreshToken: encrypted.refreshToken,
              quickbooksConnectedAt: new Date()
            }
          });

          refreshedCount++;
          console.log(`✅ Token refreshed for user: ${user.email}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to refresh token for ${user.email}:`, error.message);
        errors++;
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log(`\n✅ Token refresh completed in ${duration}s`);
    console.log(`   ✅ Tokens refreshed: ${refreshedCount}`);
    console.log(`   ❌ Errors: ${errors}`);

  } catch (error) {
    console.error('❌ Token refresh failed:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Refresh QuickBooks OAuth token
 */
export async function refreshQuickBooksToken(
  refreshToken: string,
  realmId: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('QuickBooks credentials not configured');
    }

    const tokenEndpoint =
      process.env.QUICKBOOKS_ENVIRONMENT === 'production'
        ? 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
        : 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    const response = await axios.post(
      tokenEndpoint,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        }
      }
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token
    };
  } catch (error: any) {
    const reason = error.response?.data || error.message;
    console.error(`Token refresh error for realm ${realmId}:`, reason);
    return null;
  }
}

/**
 * Start the token refresh cron job
 */
export function startTokenRefreshCron() {
  if (!appConfig.features.enableTokenRefresh) {
    console.log('⏸️  Token refresh disabled in config');
    return;
  }

  const cronExpression = appConfig.scheduling.tokenRefreshCron || '0 2 * * *';

  cron.schedule(cronExpression, () => {
    console.log(`\n⏰ Triggered scheduled token refresh (${new Date().toISOString()})`);
    runTokenRefresh();
  });

  console.log(`✅ Token refresh scheduled: ${cronExpression} (${appConfig.scheduling.tokenRefreshTime})`);
}

