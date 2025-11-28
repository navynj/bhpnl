import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksOAuthClient } from '@/lib/quickbooks';

/**
 * POST /api/quickbook/auth/refresh
 * Refreshes the access token using the refresh token
 * 
 * Request body:
 * {
 *   "refresh_token": "your_refresh_token_here"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "tokens": {
 *     "access_token": "...",
 *     "refresh_token": "...", // Always use the new refresh token
 *     "expires_in": 3600,
 *     "token_type": "bearer"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      return NextResponse.json(
        { error: 'Refresh token is required in request body' },
        { status: 400 }
      );
    }

    const oauthClient = getQuickBooksOAuthClient();
    
    // Set the refresh token in the OAuth client
    oauthClient.setRefreshToken(refresh_token);

    // Refresh the access token
    const authResponse = await oauthClient.refresh();
    const tokenData = authResponse.getJson();

    return NextResponse.json({
      success: true,
      tokens: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token, // Always use the new refresh token provided
        expires_in: tokenData.expires_in, // Typically 3600 seconds (1 hour)
        token_type: tokenData.token_type,
      },
      message: 'Tokens refreshed successfully. Update stored tokens in your database.',
    });
  } catch (error: any) {
    console.error('Error refreshing access token:', error);
    
    // Handle specific error cases
    if (error.message?.includes('invalid_grant') || error.message?.includes('refresh_token')) {
      return NextResponse.json(
        { 
          error: 'Refresh token is invalid or expired. User needs to reauthorize.',
          details: error.message
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to refresh access token',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

