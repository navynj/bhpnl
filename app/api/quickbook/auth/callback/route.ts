import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksOAuthClient } from '@/lib/quickbooks-oauth';
import { saveQuickBooksTokens } from '@/lib/quickbooks-token';
import { requireAdmin } from '@/lib/auth-helpers';

/**
 * GET /api/quickbook/auth/callback
 * Handles the OAuth callback from Intuit and exchanges authorization code for tokens
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const realmId = searchParams.get('realmId');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Extract locationName and returnTo from state if they were included
    let locationName: string | undefined;
    let returnTo: string | undefined;

    if (state?.includes('|locationName:')) {
      const locationMatch = state.match(/\|locationName:([^|]+)/);
      locationName = locationMatch ? locationMatch[1] : undefined;
    }

    if (state?.includes('|returnTo:')) {
      const returnToMatch = state.match(/\|returnTo:(.+)$/);
      returnTo = returnToMatch
        ? decodeURIComponent(returnToMatch[1])
        : undefined;
    }

    // Handle OAuth errors
    if (error) {
      return NextResponse.json(
        {
          error: 'OAuth authorization failed',
          error_description: errorDescription || error,
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is missing' },
        { status: 400 }
      );
    }

    // Require admin role
    let adminUser;
    try {
      adminUser = await requireAdmin();
    } catch (error: any) {
      return NextResponse.json(
        {
          error:
            'Admin access required. Only admins can connect QuickBooks accounts.',
        },
        { status: 403 }
      );
    }

    const oauthClient = getQuickBooksOAuthClient();

    try {
      // Exchange authorization code for tokens
      const authResponse = await oauthClient.createToken(request.url);
      const tokenData = authResponse.getJson();

      const finalRealmId = realmId || tokenData.realmId || '';
      if (!finalRealmId) {
        return NextResponse.json(
          { error: 'Realm ID is missing from OAuth response' },
          { status: 400 }
        );
      }

      const tokens = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in, // Typically 3600 seconds (1 hour)
        token_type: tokenData.token_type,
        realmId: finalRealmId,
        refresh_token_expires_at: tokenData.x_refresh_token_expires_in
          ? Math.floor(
              (Date.now() + tokenData.x_refresh_token_expires_in * 1000) / 1000
            )
          : undefined, // Typically 100 days
      };

      // Save tokens to database (admin only)
      await saveQuickBooksTokens(
        adminUser.id,
        tokens,
        locationName || undefined
      );

      // Redirect back to original page with success parameter, or default to admin page
      const redirectUrl = new URL(returnTo || '/admin', request.url);
      redirectUrl.searchParams.set('qb_success', 'true');
      redirectUrl.searchParams.set('realmId', finalRealmId);
      const response = NextResponse.redirect(redirectUrl);

      return response;
    } catch (error: any) {
      console.error('Error exchanging authorization code for tokens:', error);
      return NextResponse.json(
        {
          error: 'Failed to exchange authorization code for tokens',
          details: error.message || 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      {
        error: 'OAuth callback failed',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
