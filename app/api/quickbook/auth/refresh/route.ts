import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksOAuthClient } from '@/lib/quickbooks-oauth';
import {
  getQuickBooksConnectionById,
  updateQuickBooksTokens,
  isRefreshTokenExpired,
} from '@/lib/quickbooks-token';
import { auth } from '@/lib/auth';

/**
 * POST /api/quickbook/auth/refresh
 * Refreshes the access token using the refresh token from database
 * 
 * Request body:
 * {
 *   "connectionId": "connection_id_here" // Optional, refreshes all if not provided
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "connection": {
 *     "id": "...",
 *     "realmId": "...",
 *     ...
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get current authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required in request body' },
        { status: 400 }
      );
    }

    // Get connection from database
    const connection = await getQuickBooksConnectionById(userId, connectionId);
    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found or access denied' },
        { status: 404 }
      );
    }

    // Check if refresh token is expired
    if (isRefreshTokenExpired(connection)) {
      return NextResponse.json(
        {
          error: 'Refresh token is expired. User needs to reauthorize.',
        },
        { status: 401 }
      );
    }

    const oauthClient = getQuickBooksOAuthClient();
    
    // Refresh the access token using the refresh token
    const authResponse = await oauthClient.refreshUsingToken(connection.refreshToken);
    const tokenData = authResponse.getJson();

    // Calculate new expiration dates
    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in || 3600) * 1000
    );
    const refreshExpiresAt = tokenData.x_refresh_token_expires_in
      ? new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000)
      : connection.refreshTokenExpiresAt;

    // Update tokens in database
    const updatedConnection = await updateQuickBooksTokens(connectionId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token, // Always use the new refresh token
      expiresAt,
      refreshTokenExpiresAt: refreshExpiresAt,
    });

    return NextResponse.json({
      success: true,
      connection: updatedConnection,
      message: 'Tokens refreshed successfully',
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

