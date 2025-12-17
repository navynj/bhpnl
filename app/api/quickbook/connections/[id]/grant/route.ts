import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/client';
import { requireAdmin } from '@/lib/auth-helpers';

/**
 * POST /api/quickbook/connections/[id]/grant
 * Grant access to a QuickBooks connection to one or more users (admin only)
 *
 * Request body:
 * {
 *   "userIds": ["user_id_1", "user_id_2", ...]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Access granted successfully",
 *   "granted": ["user_id_1", "user_id_2"]
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin role
    const adminUser = await requireAdmin();

    const { id: connectionId } = await params;
    const body = await request.json();
    const { userIds } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'userIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Verify connection exists (any admin can grant access to any connection)
    const connection = await prisma.qBConnection.findUnique({
      where: {
        id: connectionId,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Grant access to users
    const granted: string[] = [];
    const errors: Array<{ userId: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        // Check if user exists
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          errors.push({ userId, error: 'User not found' });
          continue;
        }

        // Create user connection (upsert to avoid duplicates)
        await prisma.userConnection.upsert({
          where: {
            userId_qbConnectionId: {
              userId,
              qbConnectionId: connectionId,
            },
          },
          create: {
            userId,
            qbConnectionId: connectionId,
          },
          update: {}, // No update needed if exists
        });

        granted.push(userId);
      } catch (error: any) {
        errors.push({ userId, error: error.message || 'Unknown error' });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Access granted to ${granted.length} user(s)`,
      granted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.error('Error granting access:', error);
    return NextResponse.json(
      {
        error: 'Failed to grant access',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/quickbook/connections/[id]/grant
 * Revoke access to a QuickBooks connection from one or more users (admin only)
 *
 * Request body:
 * {
 *   "userIds": ["user_id_1", "user_id_2", ...]
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin role
    const adminUser = await requireAdmin();

    const { id: connectionId } = await params;
    const body = await request.json();
    const { userIds } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'userIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Verify connection exists (any admin can revoke access from any connection)
    const connection = await prisma.qBConnection.findUnique({
      where: {
        id: connectionId,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Revoke access from users
    const revoked: string[] = [];
    const errors: Array<{ userId: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        await prisma.userConnection.deleteMany({
          where: {
            userId,
            qbConnectionId: connectionId,
          },
        });
        revoked.push(userId);
      } catch (error: any) {
        errors.push({ userId, error: error.message || 'Unknown error' });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Access revoked from ${revoked.length} user(s)`,
      revoked,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.error('Error revoking access:', error);
    return NextResponse.json(
      {
        error: 'Failed to revoke access',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
