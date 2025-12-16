import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/client';
import { getQuickBooksOAuthClient } from '@/lib/quickbooks-oauth';
import { requireAdmin } from '@/lib/auth-helpers';
import {
  isAccessTokenExpired,
  isRefreshTokenExpired,
  updateQuickBooksTokens,
} from '@/lib/quickbooks-token';
import { decrypt } from '@/lib/encryption';

/**
 * POST /api/quickbook/admin/refresh-tokens
 * Refresh tokens for all connections or specific connections (admin only)
 * This can be called periodically (e.g., via cron job) to refresh tokens
 *
 * Query parameters:
 * - connectionId (optional): Refresh specific connection only
 * - force (optional): Force refresh even if not expired
 *
 * Response:
 * {
 *   "success": true,
 *   "refreshed": ["connection_id_1", "connection_id_2"],
 *   "skipped": ["connection_id_3"],
 *   "errors": [...]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin role
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const force = searchParams.get('force') === 'true';

    // Get connections to refresh
    let connections;
    if (connectionId) {
      const connection = await prisma.qBConnection.findUnique({
        where: { id: connectionId },
      });
      connections = connection ? [connection] : [];
    } else {
      // Get all connections
      connections = await prisma.qBConnection.findMany();
    }

    const refreshed: string[] = [];
    const skipped: string[] = [];
    const errors: Array<{ connectionId: string; error: string }> = [];

    const oauthClient = getQuickBooksOAuthClient();

    for (const connection of connections) {
      try {
        // Decrypt refresh token for use
        const decryptedRefreshToken = decrypt(connection.refreshToken);
        
        // Create connection object with decrypted data for status checks
        const decryptedConnection = {
          ...connection,
          refreshToken: decryptedRefreshToken,
          realmId: decrypt(connection.realmId),
        };

        // Check if refresh token is expired
        if (!force && isRefreshTokenExpired(decryptedConnection)) {
          errors.push({
            connectionId: connection.id,
            error: 'Refresh token is expired. Manual reauthorization required.',
          });
          continue;
        }

        // Check if access token needs refresh
        if (!force && !isAccessTokenExpired(decryptedConnection)) {
          skipped.push(connection.id);
          continue;
        }

        // Refresh the token
        const authResponse = await oauthClient.refreshUsingToken(
          decryptedRefreshToken
        );
        const tokenData = authResponse.getJson();

        // Calculate new expiration dates
        const expiresAt = new Date(
          Date.now() + (tokenData.expires_in || 3600) * 1000
        );
        const refreshExpiresAt = tokenData.x_refresh_token_expires_in
          ? new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000)
          : connection.refreshTokenExpiresAt;

        // Update tokens in database (encryption handled by updateQuickBooksTokens)
        await updateQuickBooksTokens(connection.id, {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          refreshTokenExpiresAt: refreshExpiresAt,
        });

        refreshed.push(connection.id);
      } catch (error: any) {
        // Security: Don't log sensitive token information
        errors.push({
          connectionId: connection.id,
          error: error.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed ${refreshed.length} connection(s)`,
      refreshed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Security: Don't log sensitive token information
    console.error('Error refreshing tokens:', {
      message: error.message,
      // Explicitly do NOT log: tokens, connection details, or any sensitive data
    });
    return NextResponse.json(
      {
        error: 'Failed to refresh tokens',
        // Don't expose detailed error message to client
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quickbook/admin/refresh-tokens
 * Get status of all connections (token expiration info)
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin role
    await requireAdmin();

    const connections = await prisma.qBConnection.findMany({
      select: {
        id: true,
        locationName: true,
        realmId: true, // This is encrypted, but we'll decrypt for status checks
        expiresAt: true,
        refreshTokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    const connectionsWithStatus = connections.map(
      (conn: (typeof connections)[number]) => {
        // Decrypt realmId for display (it's not sensitive after connection is established)
        const decryptedRealmId = decrypt(conn.realmId);
        
        const now = new Date();
        const accessExpired = conn.expiresAt <= now;
        const refreshExpired = conn.refreshTokenExpiresAt
          ? conn.refreshTokenExpiresAt <= now
          : false;
        const accessExpiresSoon =
          conn.expiresAt <= new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

        return {
          ...conn,
          realmId: decryptedRealmId, // Return decrypted for display
          status: {
            accessExpired,
            refreshExpired,
            accessExpiresSoon,
            needsRefresh: accessExpired || accessExpiresSoon,
          },
        };
      }
    );

    return NextResponse.json({
      success: true,
      connections: connectionsWithStatus,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Security: Don't log sensitive token information
    console.error('Error fetching token status:', {
      message: error.message,
      // Explicitly do NOT log: tokens, connection details, or any sensitive data
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch token status',
        // Don't expose detailed error message to client
      },
      { status: 500 }
    );
  }
}
