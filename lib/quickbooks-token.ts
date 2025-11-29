/**
 * QuickBooks Token Management
 *
 * This module handles all database operations related to QuickBooks tokens and connections.
 *
 * Structure:
 * - Types: QuickBooksTokens, QBConnectionData interfaces
 * - Token Operations: save, get, update, delete tokens
 * - Connection Operations: get user connections, check expiration
 * - Utility Functions: convert between formats, check token status
 */

import { prisma } from '@/prisma/client';
import { NextResponse } from 'next/server';

// ============================================================================
// Types
// ============================================================================

export interface QuickBooksTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  realmId: string;
  expires_at?: number; // Unix timestamp when access token expires
  refresh_token_expires_at?: number; // Unix timestamp when refresh token expires
}

export interface QBConnectionData {
  id: string;
  realmId: string;
  locationName: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshTokenExpiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  admin?: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

// ============================================================================
// Token CRUD Operations
// ============================================================================
/**
 * Save QuickBooks tokens to database
 * Creates or updates a QBConnection (admin only)
 * @param adminId - Admin user ID who is creating/updating this connection
 * @param tokens - QuickBooks tokens
 * @param locationName - Optional location name
 */
export async function saveQuickBooksTokens(
  adminId: string,
  tokens: QuickBooksTokens,
  locationName?: string
): Promise<QBConnectionData> {
  const expiresAt = tokens.expires_at
    ? new Date(tokens.expires_at * 1000)
    : new Date(Date.now() + tokens.expires_in * 1000);

  const refreshExpiresAt = tokens.refresh_token_expires_at
    ? new Date(tokens.refresh_token_expires_at * 1000)
    : null;

  // Check if connection already exists for this realmId and locationName (created by this admin)
  const existingConnection = await prisma.qBConnection.findFirst({
    where: {
      createdBy: adminId,
      realmId: tokens.realmId,
      locationName: locationName || null,
    },
  });

  let qbConnection: QBConnectionData;

  if (existingConnection) {
    // Update existing connection
    qbConnection = await prisma.qBConnection.update({
      where: { id: existingConnection.id },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        locationName: locationName || existingConnection.locationName,
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Ensure UserConnection exists for the admin
    await prisma.userConnection.upsert({
      where: {
        userId_qbConnectionId: {
          userId: adminId,
          qbConnectionId: qbConnection.id,
        },
      },
      create: {
        userId: adminId,
        qbConnectionId: qbConnection.id,
      },
      update: {},
    });
  } else {
    // Create new connection
    qbConnection = await prisma.qBConnection.create({
      data: {
        realmId: tokens.realmId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        locationName: locationName || null,
        createdBy: adminId,
        users: {
          create: {
            userId: adminId,
          },
        },
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  return qbConnection;
}

// ============================================================================
// Connection Retrieval
// ============================================================================

/**
 * Get QuickBooks tokens for a user and realmId
 */
export async function getQuickBooksTokens(
  userId: string,
  realmId: string,
  locationName?: string | null
): Promise<QBConnectionData | null> {
  const userConnection = await prisma.userConnection.findFirst({
    where: {
      userId,
      qbConnection: {
        realmId,
        ...(locationName !== undefined && { locationName }),
      },
    },
    include: {
      qbConnection: true,
    },
  });

  return userConnection?.qbConnection || null;
}

/**
 * Get all QuickBooks connections for a user
 */
export async function getUserQuickBooksConnections(
  userId: string
): Promise<QBConnectionData[]> {
  const userConnections = await prisma.userConnection.findMany({
    where: { userId },
    include: {
      qbConnection: {
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return userConnections.map((uc) => uc.qbConnection);
}

/**
 * Get a specific QuickBooks connection by ID (for the user)
 */
export async function getQuickBooksConnectionById(
  userId: string,
  connectionId: string
): Promise<QBConnectionData | null> {
  const userConnection = await prisma.userConnection.findUnique({
    where: {
      userId_qbConnectionId: {
        userId,
        qbConnectionId: connectionId,
      },
    },
    include: {
      qbConnection: true,
    },
  });

  return userConnection?.qbConnection || null;
}

// ============================================================================
// Token Update & Deletion
// ============================================================================

/**
 * Update QuickBooks tokens in database
 */
export async function updateQuickBooksTokens(
  connectionId: string,
  tokens: Partial<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    refreshTokenExpiresAt: Date | null;
  }>
): Promise<QBConnectionData> {
  return prisma.qBConnection.update({
    where: { id: connectionId },
    data: tokens,
  });
}

// ============================================================================
// Token Status Checks
// ============================================================================

/**
 * Check if access token is expired or will expire soon (within 5 minutes)
 */
export function isAccessTokenExpired(connection: QBConnectionData): boolean {
  const now = new Date();
  const buffer = 5 * 60 * 1000; // 5 minutes buffer
  return connection.expiresAt.getTime() <= now.getTime() + buffer;
}

/**
 * Check if refresh token is expired
 */
export function isRefreshTokenExpired(connection: QBConnectionData): boolean {
  if (!connection.refreshTokenExpiresAt) {
    return false; // If no expiry info, assume not expired
  }
  const now = new Date();
  return connection.refreshTokenExpiresAt.getTime() <= now.getTime();
}

// ============================================================================
// Connection Deletion
// ============================================================================

/**
 * Delete a QuickBooks connection for a user
 */
export async function deleteQuickBooksConnection(
  userId: string,
  connectionId: string
): Promise<void> {
  // Check if user owns this connection
  const userConnection = await prisma.userConnection.findUnique({
    where: {
      userId_qbConnectionId: {
        userId,
        qbConnectionId: connectionId,
      },
    },
  });

  if (!userConnection) {
    throw new Error('Connection not found or access denied');
  }

  // Delete user connection (cascade will handle QBConnection if no other users)
  await prisma.userConnection.delete({
    where: {
      userId_qbConnectionId: {
        userId,
        qbConnectionId: connectionId,
      },
    },
  });

  // If no other users are connected, delete the QBConnection
  const remainingConnections = await prisma.userConnection.count({
    where: { qbConnectionId: connectionId },
  });

  if (remainingConnections === 0) {
    await prisma.qBConnection.delete({
      where: { id: connectionId },
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert QBConnectionData to QuickBooksTokens format (for backward compatibility)
 */
export function connectionToTokens(
  connection: QBConnectionData
): QuickBooksTokens {
  return {
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expires_in: Math.floor(
      (connection.expiresAt.getTime() - Date.now()) / 1000
    ),
    token_type: 'bearer',
    realmId: connection.realmId,
    expires_at: Math.floor(connection.expiresAt.getTime() / 1000),
    refresh_token_expires_at: connection.refreshTokenExpiresAt
      ? Math.floor(connection.refreshTokenExpiresAt.getTime() / 1000)
      : undefined,
  };
}
