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
    // Security: Use redirect instead of JSON to prevent sensitive data in Referer header
    if (error) {
      const errorRedirectUrl = new URL('/admin', request.url);
      errorRedirectUrl.searchParams.set('qb_error', 'true');
      errorRedirectUrl.searchParams.set('error', error);
      if (errorDescription) {
        errorRedirectUrl.searchParams.set('error_description', errorDescription);
      }
      const errorResponse = NextResponse.redirect(errorRedirectUrl);
      // Security: Disable caching for sensitive OAuth callback
      errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      errorResponse.headers.set('Pragma', 'no-cache');
      errorResponse.headers.set('Expires', '0');
      return errorResponse;
    }

    if (!code) {
      const errorRedirectUrl = new URL('/admin', request.url);
      errorRedirectUrl.searchParams.set('qb_error', 'true');
      errorRedirectUrl.searchParams.set('error', 'missing_code');
      const errorResponse = NextResponse.redirect(errorRedirectUrl);
      errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      errorResponse.headers.set('Pragma', 'no-cache');
      errorResponse.headers.set('Expires', '0');
      return errorResponse;
    }

    // Require admin role
    let adminUser;
    try {
      adminUser = await requireAdmin();
    } catch (error: any) {
      // Security: Use redirect instead of JSON
      const errorRedirectUrl = new URL('/admin', request.url);
      errorRedirectUrl.searchParams.set('qb_error', 'true');
      errorRedirectUrl.searchParams.set('error', 'admin_required');
      const errorResponse = NextResponse.redirect(errorRedirectUrl);
      errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      errorResponse.headers.set('Pragma', 'no-cache');
      errorResponse.headers.set('Expires', '0');
      return errorResponse;
    }

    const oauthClient = getQuickBooksOAuthClient();

    try {
      // Exchange authorization code for tokens
      const authResponse = await oauthClient.createToken(request.url);
      const tokenData = authResponse.getJson();

      const finalRealmId = realmId || tokenData.realmId || '';
      if (!finalRealmId) {
        const errorRedirectUrl = new URL('/admin', request.url);
        errorRedirectUrl.searchParams.set('qb_error', 'true');
        errorRedirectUrl.searchParams.set('error', 'missing_realm_id');
        const errorResponse = NextResponse.redirect(errorRedirectUrl);
        errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        errorResponse.headers.set('Pragma', 'no-cache');
        errorResponse.headers.set('Expires', '0');
        return errorResponse;
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

      // Security: Validate returnTo URL to prevent open redirect attacks
      let safeReturnTo = '/admin';
      if (returnTo) {
        try {
          const returnToUrl = new URL(returnTo, request.url);
          // Only allow redirects to same origin
          if (returnToUrl.origin === new URL(request.url).origin) {
            // Only allow relative paths (no external redirects)
            if (returnToUrl.pathname.startsWith('/')) {
              safeReturnTo = returnToUrl.pathname + returnToUrl.search;
            }
          }
        } catch {
          // Invalid URL, use default
        }
      }

      // Security: Use 302 redirect (not HTML response) to prevent sensitive data in Referer header
      // QuickBooks requirement: endpoints receiving sensitive info must use 302 redirect, not HTML
      const redirectUrl = new URL(safeReturnTo, request.url);
      redirectUrl.searchParams.set('qb_success', 'true');
      // Note: realmId is not sensitive after OAuth completion, but we keep it minimal
      const response = NextResponse.redirect(redirectUrl, { status: 302 });
      
      // Security: Disable caching for sensitive OAuth callback
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');

      return response;
    } catch (error: any) {
      // Security: Don't log sensitive token information
      console.error('Error exchanging authorization code for tokens:', {
        message: error.message,
        // Explicitly do NOT log: code, tokens, realmId, or any sensitive data
      });
      
      // Security: Use redirect instead of JSON
      const errorRedirectUrl = new URL('/admin', request.url);
      errorRedirectUrl.searchParams.set('qb_error', 'true');
      errorRedirectUrl.searchParams.set('error', 'token_exchange_failed');
      const errorResponse = NextResponse.redirect(errorRedirectUrl);
      errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      errorResponse.headers.set('Pragma', 'no-cache');
      errorResponse.headers.set('Expires', '0');
      return errorResponse;
    }
  } catch (error: any) {
    // Security: Don't log sensitive information
    console.error('OAuth callback error:', {
      message: error.message,
      // Explicitly do NOT log: code, tokens, realmId, or any sensitive data
    });
    
    // Security: Use redirect instead of JSON
    const errorRedirectUrl = new URL('/admin', request.url);
    errorRedirectUrl.searchParams.set('qb_error', 'true');
    errorRedirectUrl.searchParams.set('error', 'callback_failed');
    const errorResponse = NextResponse.redirect(errorRedirectUrl);
    errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    errorResponse.headers.set('Pragma', 'no-cache');
    errorResponse.headers.set('Expires', '0');
    return errorResponse;
  }
}
