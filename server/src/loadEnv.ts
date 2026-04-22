/**
 * Must be imported first from index.ts so process.env is populated before
 * route modules (e.g. quickbooks) construct OAuth clients at load time.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envCandidates = [
  path.join(__dirname, '..', '.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'server', '.env'),
];

let loadedPath: string | null = null;
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    // File values must win over empty User/System env vars (Windows often has stale empty vars).
    dotenv.config({ path: p, override: true });
    loadedPath = p;
    break;
  }
}
if (!loadedPath) {
  dotenv.config({ override: true });
}

if (process.env.NODE_ENV !== 'production' && (!(process.env.QUICKBOOKS_CLIENT_ID || '').trim() || !(process.env.QUICKBOOKS_CLIENT_SECRET || '').trim())) {
  console.warn(
    `[loadEnv] QuickBooks credentials not loaded. Tried: ${envCandidates.join(' | ')} | cwd=${process.cwd()} | loaded=${loadedPath ?? 'fallback dotenv'}`
  );
}
