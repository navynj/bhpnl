import { NextRequest, NextResponse } from 'next/server';
import {
  getQuickBooksOAuthClient,
  getDefaultQuickBooksScopes,
} from '@/lib/quickbooks-oauth';
import { requireAdmin } from '@/lib/auth-helpers';

/**
 * GET /api/quickbook/auth
 * Initiates the OAuth flow by redirecting to Intuit's authorization page
 *
 * Query parameters:
 * - state (optional): CSRF protection token
 * - locationName (optional): Location name for this connection
 *
 * Example: GET /api/quickbook/auth?state=my-csrf-token&locationName=Vancouver
 *
 * After user authorizes, they will be redirected to:
 * /api/quickbook/auth/callback?code=...&realmId=...&state=...
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin role
    try {
      await requireAdmin();
    } catch (error: any) {
      return NextResponse.json(
        {
          error:
            'Admin access required. Only admins can initiate QuickBooks OAuth.',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state') || 'quickbooks-auth-state';
    const locationName = searchParams.get('locationName');
    const returnTo = searchParams.get('returnTo'); // Page to return to after OAuth

    // Build state string with locationName and returnTo
    let stateParts = [state];
    if (locationName) {
      stateParts.push(`locationName:${locationName}`);
    }
    if (returnTo) {
      stateParts.push(`returnTo:${returnTo}`);
    }
    const stateWithExtras = stateParts.join('|');

    const oauthClient = getQuickBooksOAuthClient();

    // Get default scopes - adjust in lib/quickbooks.ts if needed
    const scopes = getDefaultQuickBooksScopes();

    // Generate authorization URL
    const authUri = oauthClient.authorizeUri({
      scope: scopes,
      state: stateWithExtras, // CSRF protection + locationName + returnTo
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
