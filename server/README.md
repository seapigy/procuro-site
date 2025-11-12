# ProcuroApp Server

Backend server for ProcuroApp with QuickBooks integration.

## QuickBooks Integration

### Setup

1. **Get QuickBooks API Credentials:**
   - Go to [Intuit Developer Portal](https://developer.intuit.com/)
   - Create an app and get your Client ID and Client Secret
   - Add redirect URI: `http://localhost:5000/api/qb/callback`

2. **Configure Environment Variables:**
   ```bash
   QUICKBOOKS_CLIENT_ID=your_client_id
   QUICKBOOKS_CLIENT_SECRET=your_client_secret
   QUICKBOOKS_REDIRECT_URI=http://localhost:5000/api/qb/callback
   QUICKBOOKS_ENVIRONMENT=sandbox
   ```

3. **Run Database Migrations:**
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

4. **Seed Test User:**
   ```bash
   npm run seed
   ```

### QuickBooks OAuth Flow

The integration implements OAuth 2.0 flow with three endpoints:

#### 1. **GET /api/qb/connect**
Initiates OAuth flow. Redirects user to QuickBooks login.

```bash
# Open in browser:
http://localhost:5000/api/qb/connect
```

#### 2. **GET /api/qb/callback**
Handles OAuth callback after user authorizes the app.
- Exchanges authorization code for access tokens
- Stores tokens in database (User model)
- Automatically fetches last 100 purchase/bill items
- Stores items in database (Item model)

#### 3. **GET /api/qb/items**
Lists all imported items for the test user.

```bash
curl http://localhost:5000/api/qb/items
```

Response:
```json
{
  "success": true,
  "user": {
    "email": "test@procuroapp.com",
    "name": "Test User",
    "quickbooksConnected": true,
    "connectedAt": "2025-10-31T12:00:00.000Z"
  },
  "itemCount": 42,
  "items": [
    {
      "id": "cm123...",
      "name": "Office Supplies",
      "category": "Supplies",
      "lastPaidPrice": 45.99,
      "date": "2025-10-15T00:00:00.000Z",
      "createdAt": "2025-10-31T12:00:00.000Z",
      "updatedAt": "2025-10-31T12:00:00.000Z",
      "userId": "cm456..."
    }
  ]
}
```

### Database Schema

The QuickBooks integration uses the following models:

**User Model:**
- `quickbooksAccessToken` - OAuth access token
- `quickbooksRefreshToken` - OAuth refresh token
- `quickbooksRealmId` - QuickBooks company ID
- `quickbooksConnectedAt` - Connection timestamp

**Item Model:**
- `name` - Item/expense name
- `category` - Item category or account
- `lastPaidPrice` - Amount paid
- `date` - Transaction date
- `userId` - Associated user

### Test User

A placeholder test user is automatically created:
- Email: `test@procuroapp.com`
- Name: `Test User`

This user is used for all QuickBooks connections during development.

### Data Fetched

The integration fetches the last 100 Purchase transactions from QuickBooks, including:
- Item-based expenses (products/services purchased)
- Account-based expenses (general expenses)

Each line item is stored separately with:
- Item name or description
- Category/class/account
- Amount paid
- Transaction date

### Production Considerations

For production deployment:

1. **User Authentication:** Replace test user with actual authenticated users
2. **State Parameter:** Use secure random state in OAuth flow
3. **Token Refresh:** Implement token refresh logic (QuickBooks tokens expire)
4. **Error Handling:** Add comprehensive error handling and logging
5. **Rate Limiting:** Implement rate limiting for API endpoints
6. **Webhook Support:** Consider QuickBooks webhooks for real-time updates

### Troubleshooting

**"Test user not found":**
```bash
npm run seed
```

**"Invalid client credentials":**
- Verify `QUICKBOOKS_CLIENT_ID` and `QUICKBOOKS_CLIENT_SECRET` in `.env`
- Check redirect URI matches exactly in Intuit Developer Portal

**"No data returned":**
- Make sure you have Purchase transactions in your QuickBooks sandbox
- Check QuickBooks Sandbox has test data

**Database errors:**
```bash
npm run prisma:migrate
npm run prisma:generate
```




