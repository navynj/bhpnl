import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { getQuickBooksOAuthClient } from '@/lib/quickbooks-oauth';

/**
 * GET /api/quickbook/admin/config
 * Get QuickBooks configuration information (admin only)
 * 
 * Response:
 * {
 *   "environment": "sandbox" | "production",
 *   "apiBaseUrl": "https://sandbox-quickbooks.api.intuit.com",
 *   "hasClientId": true,
 *   "hasClientSecret": true,
 *   "redirectUri": "..."
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin role
    await requireAdmin();

    const environment = (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as
      | 'sandbox'
      | 'production';

    const apiBaseUrl =
      environment === 'sandbox'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com';

    const hasClientId = !!process.env.QUICKBOOKS_CLIENT_ID;
    const hasClientSecret = !!process.env.QUICKBOOKS_CLIENT_SECRET;
    const redirectUri =
      process.env.QUICKBOOKS_REDIRECT_URI ||
      `${
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      }/api/quickbook/auth/callback`;

    // Try to get OAuth client to verify configuration
    let oauthClientValid = false;
    try {
      const oauthClient = getQuickBooksOAuthClient();
      oauthClientValid = !!oauthClient;
    } catch (error) {
      // OAuth client creation failed
    }

    return NextResponse.json({
      environment,
      apiBaseUrl,
      hasClientId,
      hasClientSecret,
      redirectUri,
      oauthClientValid,
      note: environment === 'sandbox'
        ? 'Using Sandbox environment. Make sure your QuickBooks company is also in Sandbox mode.'
        : 'Using Production environment. Make sure your QuickBooks company is also in Production mode.',
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.error('Error getting QuickBooks config:', error);
    return NextResponse.json(
      {
        error: 'Failed to get QuickBooks configuration',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

