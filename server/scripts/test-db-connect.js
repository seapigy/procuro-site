require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$connect()
  .then(() => { console.log('DB connected OK'); return p.$disconnect(); })
  .catch(e => { console.error('DB error:', e.message); process.exit(1); });
