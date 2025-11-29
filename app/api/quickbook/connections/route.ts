import { NextRequest, NextResponse } from 'next/server';
import { getUserQuickBooksConnections } from '@/lib/quickbooks-token';
import { getCurrentUser, isAdmin } from '@/lib/auth-helpers';
import { prisma } from '@/prisma/client';

/**
 * GET /api/quickbook/connections
 * Get all QuickBooks connections with access status for the current user
 *
 * Query parameters:
 * - all (optional): If true, return all connections with hasAccess flag
 *
 * Response:
 * {
 *   "success": true,
 *   "connections": [
 *     {
 *       "id": "...",
 *       "realmId": "...",
 *       "locationName": "...",
 *       "expiresAt": "...",
 *       "refreshTokenExpiresAt": "...",
 *       "createdAt": "...",
 *       "updatedAt": "...",
 *       "hasAccess": true/false
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Get current authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userIsAdmin = await isAdmin();
    const { searchParams } = new URL(request.url);
    const getAll = searchParams.get('all') === 'true';

    if (getAll) {
      // Get all connections with access status
      const allConnections = await prisma.qBConnection.findMany({
        select: {
          id: true,
          realmId: true,
          locationName: true,
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
        },
      });

      // Get user's connection IDs
      const userConnections = await prisma.userConnection.findMany({
        where: { userId },
        select: { qbConnectionId: true },
      });
      const userConnectionIds = new Set(
        userConnections.map((uc: typeof userConnections[number]) => uc.qbConnectionId)
      );

      // Map connections with hasAccess flag
      const connectionsWithAccess = allConnections.map((conn: typeof allConnections[number]) => ({
        id: conn.id,
        realmId: conn.realmId,
        locationName: conn.locationName,
        expiresAt: conn.expiresAt,
        refreshTokenExpiresAt: conn.refreshTokenExpiresAt,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
        hasAccess: userConnectionIds.has(conn.id),
        ...(userIsAdmin && conn.createdBy === userId
          ? { createdBy: conn.createdBy, isOwner: true, admin: conn.admin }
          : {}),
      }));

      return NextResponse.json({
        success: true,
        connections: connectionsWithAccess,
      });
    }

    // Original behavior: Get all connections for the user
    const connections = await getUserQuickBooksConnections(userId);

    // Remove sensitive data (tokens) from response
    // Admins can see more details if they created the connection
    const safeConnections = connections.map((conn: typeof connections[number]) => {
      const base = {
        id: conn.id,
        realmId: conn.realmId,
        locationName: conn.locationName,
        expiresAt: conn.expiresAt,
        refreshTokenExpiresAt: conn.refreshTokenExpiresAt,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
        hasAccess: true, // User has access to these connections
      };

      // If admin created this connection, include createdBy info
      if (userIsAdmin && conn.createdBy === userId) {
        return {
          ...base,
          createdBy: conn.createdBy,
          isOwner: true,
          admin: conn.admin,
        };
      }

      return base;
    });

    return NextResponse.json({
      success: true,
      connections: safeConnections,
    });
  } catch (error: any) {
    console.error('Error fetching QuickBooks connections:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch QuickBooks connections',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
