-- Find items matching the 5 Amazon discovery test names.
-- Run in Prisma Studio, psql, or any PostgreSQL client.

-- By name pattern (HP, Hammermill, Post-it, Sharpie, Clorox):
SELECT id, "companyId", name
FROM "Item"
WHERE name ILIKE '%HP Printer Paper%'
   OR name ILIKE '%Hammermill%'
   OR name ILIKE '%Post-it%'
   OR name ILIKE '%Sharpie%'
   OR name ILIKE '%Clorox%'
ORDER BY name;

-- Last 100 items (if you need to pick manually):
SELECT id, "companyId", name
FROM "Item"
ORDER BY id DESC
LIMIT 100;
