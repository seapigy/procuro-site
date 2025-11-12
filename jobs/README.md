# Scheduled Jobs

This directory contains cron job scripts for scheduled tasks such as:
- Price monitoring and updates
- Data synchronization
- QuickBooks integration tasks
- Report generation

## Setup

Jobs can be run using:
- `node-cron` for in-process scheduling
- Separate cron daemon (crontab)
- Task scheduler (Windows Task Scheduler, systemd, etc.)

## Example Job Structure

```typescript
import cron from 'node-cron';
import { updatePrices } from './price-monitor';

// Run every hour
cron.schedule('0 * * * *', async () => {
  await updatePrices();
});
```





