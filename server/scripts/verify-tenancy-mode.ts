import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function isPoolerConnection(url: string): boolean {
  const v = url.toLowerCase();
  return v.includes('pooler.supabase.com') || v.includes(':6543');
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pooler = isPoolerConnection(dbUrl);
  const configuredMode = (process.env.TENANCY_ENFORCEMENT_MODE || '').trim().toLowerCase();
  const mode = configuredMode || (pooler ? 'app_only' : 'rls');

  if (!['rls', 'app_only'].includes(mode)) {
    throw new Error(`Invalid TENANCY_ENFORCEMENT_MODE="${configuredMode}". Use "rls" or "app_only".`);
  }

  console.log(`🔐 Tenancy verification mode: ${mode}`);
  console.log(`💾 Connection type: ${pooler ? 'session pooler' : 'direct/postgres'}`);

  if (mode === 'rls') {
    if (pooler) {
      throw new Error(
        'RLS mode cannot be validated with session pooler (set TENANCY_ENFORCEMENT_MODE=app_only or switch to direct DB connection).'
      );
    }
    console.log('▶ Running RLS isolation test suite...');
    execSync('npm run test:rls', { stdio: 'inherit' });
    console.log('✅ RLS tenancy isolation checks passed');
    return;
  }

  // app_only mode
  console.log('ℹ️ App-only tenancy mode selected. Skipping test:rls by design.');
  console.log(
    'ℹ️ Ensure withCompany + explicit companyId filters are enforced in critical routes before production deploy.'
  );
}

main().catch((err) => {
  console.error(`❌ Tenancy verification failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

