import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksOAuthClient } from '@/lib/quickbooks';
import { saveQuickBooksTokens } from '@/lib/quickbooks-token';

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

    const oauthClient = getQuickBooksOAuthClient();

    try {
      // Exchange authorization code for tokens
      const authResponse = await oauthClient.createToken(request.url);
      const tokenData = authResponse.getJson();

      const tokens = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in, // Typically 3600 seconds (1 hour)
        token_type: tokenData.token_type,
        realmId: realmId || tokenData.realmId || '',
        refresh_token_expires_at: tokenData.x_refresh_token_expires_in
          ? Math.floor(
              (Date.now() + tokenData.x_refresh_token_expires_in * 1000) / 1000
            )
          : undefined, // Typically 100 days
      };

      // Save tokens to HTTP-only cookies
      const response = NextResponse.redirect(
        new URL('/api/quickbook/auth/success', request.url)
      );
      await saveQuickBooksTokens(tokens, response);

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
