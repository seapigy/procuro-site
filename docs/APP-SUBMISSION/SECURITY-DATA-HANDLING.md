# 🔐 PROCURO - SECURITY & DATA HANDLING

**Version:** 1.1.0  
**Date:** November 13, 2025  
**Classification:** Public Documentation

---

## 📋 OVERVIEW

This document outlines Procuro's security architecture, data handling practices, and compliance measures for QuickBooks App Store submission and user transparency.

---

## 🎯 SECURITY PRINCIPLES

Procuro is built on three core security principles:

1. **Data Minimization** - We only access data necessary for our service
2. **Encryption Everywhere** - All sensitive data encrypted at rest and in transit
3. **Zero Third-Party Sharing** - We never sell or share QuickBooks data

---

## 🔐 DATA ENCRYPTION

### OAuth Token Encryption

**Algorithm:** AES-256-GCM (Advanced Encryption Standard with Galois/Counter Mode)

**Implementation:**
- **Key Derivation:** PBKDF2 with 100,000 iterations
- **Salt:** 64-byte random salt per encryption
- **Authenticated Encryption:** GCM provides both confidentiality and authenticity
- **Storage:** Encrypted tokens stored as Base64-encoded strings

**File:** `server/src/utils/crypto.ts`

```typescript
// Token encryption flow:
1. Generate random 64-byte salt
2. Derive encryption key from master key + salt (PBKDF2, 100k iterations)
3. Generate random 12-byte initialization vector (IV)
4. Encrypt token with AES-256-GCM
5. Combine: salt + IV + authTag + ciphertext
6. Encode as Base64 for database storage
```

**Security Guarantees:**
- ✅ Same token encrypted twice produces different ciphertexts (random IV)
- ✅ Tampering detected via authentication tag
- ✅ No plaintext tokens stored in database
- ✅ Key rotation supported without data migration

### Transport Security

**HTTPS/TLS:**
- All connections use HTTPS with TLS 1.2 or higher
- No HTTP fallback allowed
- SSL certificates from trusted CAs
- HSTS (HTTP Strict Transport Security) enabled

**API Communication:**
- QuickBooks OAuth: HTTPS only
- Retailer APIs: HTTPS only
- All external requests over encrypted connections

---

## 📊 DATA ACCESS & STORAGE

### What We Access from QuickBooks

**Accessed Data:**
1. **Purchase Transactions**
   - Item names
   - Vendor names
   - Purchase prices
   - Purchase dates
   - Quantities (for reorder calculations)

2. **Company Information**
   - Company name (display only)
   - Industry type (optional, for analytics)

3. **User Profile**
   - Name (authentication)
   - Email (authentication + support contact)
   - User ID (session management)

**OAuth Scopes:**
- `com.intuit.quickbooks.accounting` - Read Purchase transactions
- `openid` - User authentication
- `profile` - User name
- `email` - User email address

### What We DO NOT Access

**NOT Accessed:**
- ❌ Customer information
- ❌ Invoice data
- ❌ Sales transactions
- ❌ Bank account information
- ❌ Credit card details
- ❌ Tax information
- ❌ Payroll data
- ❌ Vendor payment details

**Justification:** Procuro only needs Purchase transaction data to identify recurring supply items and their prices. We have no need for financial, customer, or payroll data.

### Data Storage

**Database:** SQLite (local dev) / PostgreSQL (production)

**Stored Data:**
- User account information (name, email, encrypted OAuth tokens)
- Company profile (name, created date)
- Items (name, vendor, SKU, category, last paid price)
- Prices (retailer, price, date, URL)
- Alerts (item, retailer, old/new price, savings, date)
- Savings summaries (monthly/YTD totals)

**Data Retention:**
- Active accounts: Data retained indefinitely
- Deleted accounts: All data deleted within 48 hours
- Inactive accounts: No automatic deletion (user must request)

**Backups:**
- Automated daily backups
- Encrypted backup storage
- 30-day retention policy
- Accessible to authorized personnel only

---

## 🛡️ SECURITY MIDDLEWARE

**File:** `server/src/middleware/errorHandler.ts`

### Blocked Paths

The following paths are explicitly blocked from public access:

```typescript
BLOCKED:
- /server/* (source code)
- /jobs/* (worker scripts)
- /providers/* (API keys)
- /db/* (database files)
- /.env (environment variables)
- /node_modules/* (dependencies)
- /prisma/* (Prisma files)
- /.git/* (git repository)
- /src/* (TypeScript source)
- All .ts and .tsx files
- Any path containing ".env"
```

**Response:** HTTP 403 Forbidden with JSON error message

### Error Handling

**Development Mode:**
- Full stack traces in response
- Detailed error messages
- Request logging with timestamps

**Production Mode:**
- Generic error messages
- Stack traces logged server-side only
- No sensitive information exposed
- Structured error codes

---

## 🔒 AUTHENTICATION & AUTHORIZATION

### OAuth 2.0 Flow

**Provider:** Intuit OAuth 2.0

**Flow Type:** Authorization Code with PKCE (Proof Key for Code Exchange)

**Process:**
1. User clicks "Connect to QuickBooks"
2. Redirected to Intuit OAuth page
3. User authorizes Procuro with selected scopes
4. Intuit redirects back with authorization code
5. Procuro exchanges code for access token + refresh token
6. Tokens encrypted and stored in database
7. User session established

**Token Lifecycle:**
- **Access Token:** 1 hour expiration
- **Refresh Token:** 100 days expiration
- **Auto-Refresh:** Daily at 2:00 AM via cron job
- **Revocation:** User can disconnect anytime via QuickBooks

### Session Management

**Storage:** Browser sessionStorage (client) + database (server)

**Session Data:**
- User ID
- Company ID
- QuickBooks Realm ID
- OAuth tokens (encrypted server-side)
- Session created/last accessed timestamps

**Timeout:** Sessions expire after 24 hours of inactivity

---

## 🌐 THIRD-PARTY INTEGRATIONS

### Retailer APIs

**Purpose:** Fetch current prices for comparison

**Data Sent to Retailers:**
- ✅ Generic product names (e.g., "Copy Paper 500 Sheets")
- ✅ UPC codes (when available)
- ❌ NO company name
- ❌ NO purchase history
- ❌ NO QuickBooks data
- ❌ NO identifying information

**Retailers:**
1. **Walmart** - Free public API (active)
2. **Amazon** - Product Advertising API (pending approval)
3. **Target** - RedCard API (pending credentials)

**Data Received:**
- Product name
- Current price
- Product URL
- Stock status

**Privacy:** Retailer APIs do not receive any QuickBooks or company-identifying data.

### No Other Third Parties

Procuro does NOT use:
- ❌ Google Analytics or tracking pixels
- ❌ Advertising networks
- ❌ Social media integrations
- ❌ Email service providers (for now)
- ❌ External logging services

---

## 🧪 SECURITY TESTING

### Automated Testing

**Test Suite:** Jest + Supertest

**Coverage:**
- ✅ OAuth flow
- ✅ Token encryption/decryption
- ✅ API endpoint authentication
- ✅ Input validation
- ✅ Error handling
- ✅ Database queries (SQL injection prevention)

**Command:** `npm test` (in `/server` directory)

### Manual Security Review

**Checklist:**
- ✅ No secrets in source code or git history
- ✅ Environment variables loaded from `.env` only
- ✅ HTTPS enforced on all pages
- ✅ CORS configured for allowed origins only
- ✅ SQL injection prevention via Prisma ORM (parameterized queries)
- ✅ XSS prevention via React's JSX escaping
- ✅ CSRF protection via SameSite cookies

### Penetration Testing

**Planned:** Third-party penetration test before public launch

**Scope:**
- OAuth flow security
- Token storage
- API authentication
- Input validation
- Session management

---

## 📋 COMPLIANCE

### Intuit Data Protection Standards

Procuro complies with:
- ✅ Intuit App Center Requirements
- ✅ QuickBooks App Store Guidelines
- ✅ OAuth 2.0 Security Best Practices
- ✅ Data minimization principles
- ✅ Secure token storage requirements

### GDPR (General Data Protection Regulation)

**For EU Users:**
- ✅ **Right to Access** - Users can request all data via support email
- ✅ **Right to Rectification** - Users can edit profile information
- ✅ **Right to Erasure** - Users can delete account + all data
- ✅ **Right to Portability** - Users can export data as CSV
- ✅ **Consent** - Clear opt-in for data processing
- ✅ **Breach Notification** - Users notified within 72 hours

### CCPA (California Consumer Privacy Act)

**For California Users:**
- ✅ **Disclosure** - Privacy policy lists all data collected
- ✅ **Access** - Users can request data copy
- ✅ **Deletion** - Users can request full data deletion
- ✅ **Opt-Out** - No data selling (we don't sell data, period)
- ✅ **Non-Discrimination** - Same service for all users

### SOC 2 (Future)

**Planned Compliance:**
- Security controls audit
- Availability monitoring
- Processing integrity checks
- Confidentiality measures
- Privacy controls

---

## 🚨 INCIDENT RESPONSE

### Security Incident Plan

**Definition:** Unauthorized access, data breach, or system compromise

**Response Protocol:**

1. **Detection** (0-1 hour)
   - Monitor error logs and alerts
   - Identify scope and impact

2. **Containment** (1-4 hours)
   - Isolate affected systems
   - Revoke compromised tokens
   - Block unauthorized access

3. **Investigation** (4-24 hours)
   - Determine root cause
   - Assess data exposure
   - Document timeline

4. **Notification** (24-72 hours)
   - Notify affected users via email
   - Post public notice if required
   - Notify Intuit if QuickBooks data affected

5. **Remediation** (1-7 days)
   - Fix vulnerabilities
   - Deploy security patches
   - Conduct post-mortem

6. **Follow-Up** (7-30 days)
   - Implement additional controls
   - Review security policies
   - Third-party security audit

### Data Breach Contacts

**Primary:** procuroapp@gmail.com  
**Response Time:** Within 4 hours for critical incidents

---

## 👥 USER RIGHTS

### Data Access Request

**Process:**
1. Email procuroapp@gmail.com with subject "Data Access Request"
2. Verify identity (match QuickBooks email)
3. Receive JSON export within 48 hours

**Includes:**
- User profile
- Company information
- All tracked items
- All price alerts
- Savings summaries

### Data Deletion Request

**Process:**
1. Email procuroapp@gmail.com with subject "Delete My Account"
2. Verify identity
3. Confirm deletion (irreversible)
4. All data deleted within 48 hours

**Deleted:**
- User account
- OAuth tokens
- All tracked items
- All price history
- All alerts
- All savings data

**Retained:** None (complete deletion)

### Disconnection from QuickBooks

**Method 1: Via QuickBooks**
- QuickBooks → Apps → Manage Apps → Procuro → Disconnect

**Method 2: Via Procuro Settings**
- Dashboard → Settings → Account → Disconnect QuickBooks

**Result:**
- OAuth tokens revoked immediately
- Access to QuickBooks data removed
- Account remains (can reconnect later)
- Data retained unless deletion requested

---

## 🔄 FUTURE SECURITY ENHANCEMENTS

### Roadmap

**v1.2.0 (Q1 2026):**
- Two-factor authentication (2FA)
- Audit log for all data access
- IP allowlisting for enterprise customers

**v1.3.0 (Q2 2026):**
- End-to-end encryption for stored prices
- Hardware security module (HSM) for key storage
- SOC 2 Type II certification

**v2.0.0 (Q3 2026):**
- Role-based access control (RBAC) for multi-user companies
- Advanced threat detection
- Automated security scanning

---

## 📞 SECURITY CONTACT

**Vulnerability Reporting:**
- Email: procuroapp@gmail.com with subject "SECURITY"
- Response time: Within 24 hours
- Confidential handling of all reports

**Bug Bounty:** Planned for v1.2.0 launch

**Responsible Disclosure:**
- We appreciate responsible disclosure
- Work with us to resolve before public disclosure
- Recognition in security acknowledgments (optional)

---

## ✅ SECURITY CHECKLIST

For Intuit Reviewers and Users:

### Data Protection
- [x] QuickBooks OAuth tokens encrypted with AES-256-GCM
- [x] HTTPS/TLS enforced on all connections
- [x] No sensitive data in browser console logs
- [x] Secure session management

### Access Control
- [x] OAuth 2.0 with appropriate scopes
- [x] Token refresh automated and secure
- [x] User can disconnect anytime
- [x] Access revocation works immediately

### Privacy
- [x] Privacy policy comprehensive and accessible
- [x] No data selling or third-party sharing
- [x] User rights respected (access, deletion, export)
- [x] GDPR/CCPA compliant

### Code Security
- [x] No secrets in source code
- [x] Environment variables for sensitive config
- [x] SQL injection prevention (Prisma ORM)
- [x] XSS prevention (React JSX)
- [x] CSRF protection (SameSite cookies)

### Monitoring
- [x] Error logging (no sensitive data in logs)
- [x] Security incident response plan
- [x] Regular security reviews
- [x] Automated testing

---

## 📚 RELATED DOCUMENTS

- **Privacy Policy:** https://procuroapp.com/privacy
- **Terms of Service:** https://procuroapp.com/terms
- **Support Page:** https://procuroapp.com/support
- **Technical Docs:** https://github.com/seapigy/procuro-site/tree/main/docs

---

## 📝 CHANGELOG

### v1.1.0 (November 13, 2025)
- ✅ AES-256-GCM token encryption implemented
- ✅ Security middleware blocking sensitive paths
- ✅ HTTPS enforced on all pages
- ✅ Privacy policy published
- ✅ Terms of service published
- ✅ Comprehensive security documentation

### v1.0.0 (November 6, 2025)
- Initial release
- Basic OAuth implementation
- SQLite database

---

**Last Updated:** November 13, 2025  
**Version:** 1.1.0  
**Classification:** Public  
**Contact:** procuroapp@gmail.com

