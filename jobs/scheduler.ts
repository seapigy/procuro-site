/**
 * Job scheduler using node-cron
 * 
 * Install: npm install node-cron @types/node-cron --workspace=server
 */

// import cron from 'node-cron';
// import { updatePrices } from './price-monitor';

/**
 * Schedule price monitoring job to run every hour
 */
// export function startPriceMonitoringSchedule() {
//   cron.schedule('0 * * * *', async () => {
//     console.log('Running scheduled price monitoring job...');
//     const results = await updatePrices();
//     console.log(`Price monitoring complete: ${results.length} monitors processed`);
//   });
//   console.log('Price monitoring schedule started (runs hourly)');
// }

// Example: Run price monitoring every 30 minutes during business hours
// cron.schedule('*/30 9-17 * * 1-5', async () => {
//   await updatePrices();
// });

/**
 * To use this scheduler, add to server/src/index.ts:
 * 
 * import { startPriceMonitoringSchedule } from '../jobs/scheduler';
 * startPriceMonitoringSchedule();
 */





