import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/client';
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers';
import { sendTokenRefreshAlert } from '@/lib/email';
import {
  isAccessTokenExpired,
  isRefreshTokenExpired,
} from '@/lib/quickbooks-token';

/**
 * GET /api/quickbook/admin/check-tokens
 * Check token status and optionally send email alerts to admins
 * 
 * Query parameters:
 * - sendEmail (optional): If true, send email alerts to admins for connections needing refresh
 * 
 * Response:
 * {
 *   "success": true,
 *   "connectionsNeedingRefresh": [...],
 *   "totalConnections": 10,
 *   "emailSent": true/false
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin role
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const shouldSendEmail = searchParams.get('sendEmail') === 'true';

    // Get all connections with admin info
    const connections = await prisma.qBConnection.findMany({
      select: {
        id: true,
        locationName: true,
        realmId: true,
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

    // Check which connections need refresh
    type ConnectionWithStatus = typeof connections[number] & {
      status: {
        accessExpired: boolean;
        refreshExpired: boolean;
        accessExpiresSoon: boolean;
        needsRefresh: boolean;
      };
    };

    const connectionsNeedingRefresh = connections
      .map((conn: typeof connections[number]): ConnectionWithStatus => {
        const now = new Date();
        const accessExpired = conn.expiresAt <= now;
        const refreshExpired = conn.refreshTokenExpiresAt
          ? conn.refreshTokenExpiresAt <= now
          : false;
        const accessExpiresSoon =
          conn.expiresAt <= new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

        return {
          ...conn,
          status: {
            accessExpired,
            refreshExpired,
            accessExpiresSoon,
            needsRefresh: accessExpired || accessExpiresSoon,
          },
        };
      })
      .filter((conn: ConnectionWithStatus) => 
        conn.status.needsRefresh || conn.status.refreshExpired
      );

    // Send email alerts if requested
    let emailSent = false;
    if (shouldSendEmail && connectionsNeedingRefresh.length > 0) {
      // Group connections by admin (createdBy)
      const connectionsByAdmin = new Map<
        string,
        typeof connectionsNeedingRefresh
      >();

      for (const conn of connectionsNeedingRefresh) {
        const adminId = conn.createdBy;
        if (!connectionsByAdmin.has(adminId)) {
          connectionsByAdmin.set(adminId, []);
        }
        connectionsByAdmin.get(adminId)!.push(conn);
      }

      // Send email to each admin
      const emailPromises = Array.from(connectionsByAdmin.entries()).map(
        async ([adminId, conns]) => {
          // Get admin email
          const admin = await prisma.user.findUnique({
            where: { id: adminId },
            select: { email: true },
          });

          if (admin?.email) {
            return sendTokenRefreshAlert(admin.email, conns);
          }
          return false;
        }
      );

      const emailResults = await Promise.all(emailPromises);
      emailSent = emailResults.some((result) => result === true);
    }

    return NextResponse.json({
      success: true,
      connectionsNeedingRefresh: connectionsNeedingRefresh.map((conn: ConnectionWithStatus) => ({
        id: conn.id,
        locationName: conn.locationName,
        realmId: conn.realmId,
        expiresAt: conn.expiresAt,
        refreshTokenExpiresAt: conn.refreshTokenExpiresAt,
        status: conn.status,
        admin: conn.admin,
      })),
      totalConnections: connections.length,
      emailSent,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.error('Error checking token status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check token status',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

