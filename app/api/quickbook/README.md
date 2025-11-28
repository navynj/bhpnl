# QuickBooks OAuth Integration

This directory contains the QuickBooks (Intuit) OAuth 2.0 integration endpoints for getting and refreshing tokens, and making API calls.

## Environment Variables

Set the following environment variables in your `.env.local` file:

```env
QUICKBOOKS_CLIENT_ID=your_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_client_secret_here
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbook/auth/callback
QUICKBOOKS_ENVIRONMENT=sandbox  # or 'production'
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Optional, used for default redirect URI
```

## API Endpoints

### 1. Initiate OAuth Flow

**GET** `/api/quickbook/auth`

Redirects the user to Intuit's authorization page.

**Query Parameters:**
- `state` (optional): CSRF protection token

**Example:**
```
GET /api/quickbook/auth?state=my-csrf-token
```

**Response:** Redirects to Intuit's authorization page

---

### 2. OAuth Callback (Token Exchange)

**GET** `/api/quickbook/auth/callback`

Handles the OAuth callback from Intuit, exchanges the authorization code for tokens, and saves them to HTTP-only cookies.

**Query Parameters (from Intuit):**
- `code`: Authorization code
- `realmId`: QuickBooks company ID
- `state`: CSRF token (should match the one sent)

**Response:** Redirects to `/api/quickbook/auth/success`

**Note:** Tokens are automatically saved to HTTP-only cookies and will be used for subsequent API calls.

---

### 3. Authentication Success

**GET** `/api/quickbook/auth/success`

Confirms that authentication was successful and tokens are saved.

**Response:**
```json
{
  "success": true,
  "message": "QuickBooks authentication successful! Tokens have been saved.",
  "realmId": "..."
}
```

---

### 4. Refresh Access Token

**POST** `/api/quickbook/auth/refresh`

Refreshes the access token using the refresh token stored in cookies.

**Request Body:**
```json
{
  "refresh_token": "your_refresh_token_here"
}
```

**Note:** In most cases, you don't need to call this manually - tokens are automatically refreshed when making API calls.

---

### 5. Get Profit & Loss Report

**GET** `/api/quickbook/reports/profit-loss`

Get Profit & Loss report from QuickBooks.

**Query Parameters:**
- `start_date` (required): Start date in YYYY-MM-DD format
- `end_date` (required): End date in YYYY-MM-DD format
- `accounting_method` (optional): 'Accrual' or 'Cash' (default: 'Accrual')

**Example:**
```
GET /api/quickbook/reports/profit-loss?start_date=2024-01-01&end_date=2024-12-31&accounting_method=Accrual
```

**Response:**
```json
{
  "success": true,
  "report": {
    "Header": {
      "Time": "...",
      "ReportName": "ProfitAndLoss",
      "ReportBasis": "Accrual",
      "StartPeriod": "2024-01-01",
      "EndPeriod": "2024-12-31",
      "Currency": "USD"
    },
    "Columns": { ... },
    "Rows": { ... }
  }
}
```

**Error Response (401):**
```json
{
  "error": "Authentication required",
  "details": "...",
  "action": "Please authenticate at /api/quickbook/auth"
}
```

---

## Usage Flow

1. **User clicks "Connect to QuickBooks"** → Redirect to `/api/quickbook/auth`
2. **User authorizes on Intuit** → Redirected to `/api/quickbook/auth/callback?code=...&realmId=...`
3. **Tokens saved automatically** → Tokens are stored in HTTP-only cookies
4. **Make API calls** → Call `/api/quickbook/reports/profit-loss` with date parameters
5. **Automatic token refresh** → Tokens are automatically refreshed if expired

## Token Management

- **Storage**: Tokens are stored in HTTP-only cookies (secure, not accessible from JavaScript)
- **Automatic Refresh**: Access tokens are automatically refreshed when expired (within 5 minutes of expiry)
- **Expiry**: 
  - Access tokens: 1 hour (3600 seconds)
  - Refresh tokens: 100 days

## Example: Fetching Profit & Loss Report

```typescript
// After authentication, fetch the report
const response = await fetch(
  '/api/quickbook/reports/profit-loss?start_date=2024-01-01&end_date=2024-12-31'
);

if (!response.ok) {
  if (response.status === 401) {
    // Need to re-authenticate
    window.location.href = '/api/quickbook/auth';
    return;
  }
  throw new Error('Failed to fetch report');
}

const data = await response.json();
console.log('Profit & Loss Report:', data.report);
```

## Production Considerations

For production, consider:

1. **Database Storage**: Instead of cookies, store tokens in a database (encrypted) for better security and multi-device support
2. **User Association**: Associate tokens with user accounts in your database
3. **Token Encryption**: Encrypt tokens before storing
4. **Error Handling**: Implement proper error handling and user notifications
5. **Rate Limiting**: Implement rate limiting for API endpoints

## Notes

- Tokens are stored in HTTP-only cookies, so they're not accessible from client-side JavaScript
- Access tokens are automatically refreshed before API calls if they're expired or about to expire
- If refresh token expires, user needs to re-authenticate
- Always validate date formats and handle API errors gracefully
