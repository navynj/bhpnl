import { NextRequest, NextResponse } from 'next/server';
import {
  getQuickBooksOAuthClient,
  getDefaultQuickBooksScopes,
} from '@/lib/quickbooks';

/**
 * GET /api/quickbook/auth
 * Initiates the OAuth flow by redirecting to Intuit's authorization page
 *
 * Query parameters:
 * - state (optional): CSRF protection token
 *
 * Example: GET /api/quickbook/auth?state=my-csrf-token
 *
 * After user authorizes, they will be redirected to:
 * /api/quickbook/auth/callback?code=...&realmId=...&state=...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state') || 'quickbooks-auth-state';

    const oauthClient = getQuickBooksOAuthClient();

    // Get default scopes - adjust in lib/quickbooks.ts if needed
    const scopes = getDefaultQuickBooksScopes();

    // Generate authorization URL
    const authUri = oauthClient.authorizeUri({
      scope: scopes,
      state, // CSRF protection
    });

    // Redirect to Intuit's authorization page
    return NextResponse.redirect(authUri);
  } catch (error: any) {
    console.error('OAuth initialization error:', error);
    return NextResponse.json(
      {
        error: 'OAuth initialization failed',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
