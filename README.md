# ProcuroApp

A QuickBooks-integrated price-monitoring SaaS platform that helps businesses track competitor pricing and optimize their strategies.

## Tech Stack

### Backend
- **Server**: Node.js + Express + TypeScript
- **Database**: PostgreSQL/SQLite (via Prisma ORM)
- **Authentication**: QuickBooks OAuth integration

### Frontend
- **Client**: React + Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui

### Additional
- **Retailer APIs**: Custom modules in `/providers`
- **Scheduled Tasks**: Cron jobs in `/jobs`

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL (or SQLite for development)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ProcuroApp
```

2. Install all dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:
- Database connection string
- QuickBooks API credentials
- Retailer API keys (Amazon, etc.)

4. Set up the database:
```bash
cd server
npx prisma migrate dev
npx prisma generate
```

5. Start development servers:

In separate terminals:
```bash
# Terminal 1: Backend server
npm run dev:server

# Terminal 2: Frontend client
npm run dev:client
```

## Available Scripts

- `npm run dev:server` - Start the backend development server
- `npm run dev:client` - Start the frontend development server
- `npm run build` - Build both server and client for production
- `npm run start` - Start the production server
- `npm run install:all` - Install dependencies for all workspaces

## Project Structure

```
ProcuroApp/
├── server/          # Express + TypeScript backend
├── client/          # React + Vite frontend
├── providers/       # Retailer API integration modules
├── jobs/            # Scheduled cron tasks
└── db/              # Database schemas and migrations (Prisma)
```

## Environment Variables

See `.env.example` for all required environment variables.

## License

ISC





