'use strict';
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const sqlPath = path.join(__dirname, '..', 'sql', 'rls_tenancy.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
  console.error('DATABASE_URL must be a PostgreSQL connection string (e.g. Supabase).');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(sql);
    console.log('RLS policies applied successfully.');
  } catch (err) {
    console.error('Failed to apply RLS:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
