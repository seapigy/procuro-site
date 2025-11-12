# Database

This directory contains database-related files and migrations managed by Prisma.

## Prisma Setup

The Prisma schema is located at `server/prisma/schema.prisma`.

## Database Options

### PostgreSQL (Production)
Use PostgreSQL for production deployments. Update your `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/procuroapp?schema=public
```

### SQLite (Development)
For quick local development, you can use SQLite. Update `server/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

And in `.env`:
```
DATABASE_URL=file:./dev.db
```

## Commands

From the `server` directory:

```bash
# Generate Prisma Client
npx prisma generate

# Create and apply migrations
npx prisma migrate dev

# View database in Prisma Studio
npx prisma studio
```





