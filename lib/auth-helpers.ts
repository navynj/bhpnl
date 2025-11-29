import { auth } from '@/lib/auth';
import { prisma } from '@/prisma/client';
import { ACTION_DEVTOOLS_CONFIG } from 'next/dist/next-devtools/dev-overlay/shared';

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return user?.role === 'admin';
}

/**
 * Get current user with role
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return user;
}

/**
 * Require admin role, throw error if not admin
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return user;
}

/**
 * Check if user has access to a specific QBConnection
 */
export async function hasAccessToConnection(
  userId: string,
  connectionId: string
): Promise<boolean> {
  const userConnection = await prisma.userConnection.findUnique({
    where: {
      userId_qbConnectionId: {
        userId,
        qbConnectionId: connectionId,
      },
    },
  });

  return !!userConnection;
}
