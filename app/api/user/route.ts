import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { prisma } from '@/prisma/client';

/**
 * GET /api/user
 * Get all user (admin only)
 *
 * Response:
 * {
 *   "success": true,
 *   "users": [
 *     {
 *       "id": "...",
 *       "name": "...",
 *       "email": "...",
 *       "image": "...",
 *       "role": "user" | "admin",
 *       "createdAt": "...",
 *       "updatedAt": "..."
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin role
    await requireAdmin();

    // Fetch all users
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.error('Error fetching users:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
