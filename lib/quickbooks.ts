// Use default import for CommonJS module
import OAuthClient from 'intuit-oauth';

/**
 * Creates and returns a configured QuickBooks OAuth client
 *
 * @returns {OAuthClient} Configured OAuth client instance
 * @throws {Error} If required environment variables are missing
 */
export function getQuickBooksOAuthClient(): OAuthClient {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri =
    process.env.QUICKBOOKS_REDIRECT_URI ||
    `${
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    }/api/quickbook/auth/callback`;
  const environment = (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as
    | 'sandbox'
    | 'production';

  if (!clientId || !clientSecret) {
    throw new Error(
      'QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET must be set in environment variables'
    );
  }

  return new OAuthClient({
    clientId,
    clientSecret,
    environment,
    redirectUri,
  });
}

/**
 * Default scopes for QuickBooks OAuth
 * Using direct string values to avoid module loading issues
 * Adjust based on your app's needs
 */
export const QUICKBOOKS_SCOPES = {
  Accounting: 'com.intuit.quickbooks.accounting',
  Payment: 'com.intuit.quickbooks.payment',
  Payroll: 'com.intuit.quickbooks.payroll',
  TimeTracking: 'com.intuit.quickbooks.payroll.timetracking',
  Benefits: 'com.intuit.quickbooks.payroll.benefits',
  OpenId: 'openid',
  Profile: 'profile',
  Email: 'email',
  Phone: 'phone',
  Address: 'address',
  IntuitName: 'intuit_name',
} as const;

/**
 * Get default scopes array for OAuth authorization
 */
export function getDefaultQuickBooksScopes(): string[] {
  return [
    QUICKBOOKS_SCOPES.Accounting,
    // Add other scopes as needed:
    // QUICKBOOKS_SCOPES.Payment,
    // QUICKBOOKS_SCOPES.OpenId,
  ];
}

/**
 * Get scopes from OAuthClient (lazy evaluation)
 * Use this if you need to access OAuthClient.scopes dynamically
 */
export function getOAuthClientScopes() {
  // Import dynamically to ensure OAuthClient is fully initialized
  const { OAuthClient } = require('intuit-oauth');
  return OAuthClient.scopes;
}
