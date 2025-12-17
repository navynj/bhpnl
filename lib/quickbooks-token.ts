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
import { encrypt, decrypt } from './encryption';

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
  // Note: realmId is encrypted in database, so we need to get all connections and decrypt to compare
  const allConnections = await prisma.qBConnection.findMany({
    where: {
      createdBy: adminId,
      locationName: locationName || null,
    },
  });

  // Find existing connection by decrypting and comparing realmId
  let existingConnection = null;
  for (const conn of allConnections) {
    try {
      const decryptedRealmId = decrypt(conn.realmId);
      if (decryptedRealmId === tokens.realmId) {
        existingConnection = conn;
        break;
      }
    } catch (error) {
      // If decryption fails, skip this connection
      console.warn(
        `Failed to decrypt realmId for connection ${conn.id}:`,
        error
      );
      continue;
    }
  }

  let qbConnection: QBConnectionData;

  if (existingConnection) {
    // Encrypt sensitive data before storing
    // Note: accessToken is short-lived and not required to be encrypted by QuickBooks,
    // but refreshToken and realmId must be encrypted
    const encryptedRefreshToken = encrypt(tokens.refresh_token);
    const encryptedRealmId = encrypt(tokens.realmId);

    // Update existing connection
    qbConnection = await prisma.qBConnection.update({
      where: { id: existingConnection.id },
      data: {
        accessToken: tokens.access_token, // Short-lived, not encrypted
        refreshToken: encryptedRefreshToken, // Encrypted as per QuickBooks requirements
        realmId: encryptedRealmId, // Encrypted as per QuickBooks requirements
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
    // Encrypt sensitive data before storing
    const encryptedRefreshToken = encrypt(tokens.refresh_token);
    const encryptedRealmId = encrypt(tokens.realmId);

    // Create new connection
    qbConnection = await prisma.qBConnection.create({
      data: {
        realmId: encryptedRealmId, // Encrypted as per QuickBooks requirements
        accessToken: tokens.access_token, // Short-lived, not encrypted
        refreshToken: encryptedRefreshToken, // Encrypted as per QuickBooks requirements
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

  // Decrypt sensitive data before returning
  let decryptedRealmId: string;
  try {
    decryptedRealmId = decrypt(qbConnection.realmId);
    // Validate decrypted realmId format (should be short, alphanumeric)
    if (
      decryptedRealmId.length > 50 ||
      !/^[A-Za-z0-9_-]{1,50}$/.test(decryptedRealmId)
    ) {
      throw new Error(
        `Decrypted realmId has invalid format (length: ${decryptedRealmId.length}). ` +
          'This indicates the realmId was not properly stored. Please re-authenticate.'
      );
    }
  } catch (error: any) {
    throw new Error(
      `Failed to decrypt realmId for connection ${qbConnection.id}: ${error.message}. ` +
        'The connection may be corrupted. Please re-authenticate your QuickBooks connection.'
    );
  }

  return {
    ...qbConnection,
    realmId: decryptedRealmId,
    refreshToken: decrypt(qbConnection.refreshToken),
  };
}

// ============================================================================
// Connection Retrieval
// ============================================================================

/**
 * Get QuickBooks tokens for a user and realmId
 * Note: realmId comparison requires decryption
 */
export async function getQuickBooksTokens(
  userId: string,
  realmId: string,
  locationName?: string | null
): Promise<QBConnectionData | null> {
  // Get all connections for the user and decrypt to find matching realmId
  const userConnections = await prisma.userConnection.findMany({
    where: { userId },
    include: {
      qbConnection: true,
    },
  });

  // Find connection with matching realmId (decrypt to compare)
  for (const userConnection of userConnections) {
    const connection = userConnection.qbConnection;

    // Decrypt realmId for comparison
    const decryptedRealmId = decrypt(connection.realmId);

    if (decryptedRealmId === realmId) {
      // Check locationName if provided
      if (
        locationName !== undefined &&
        connection.locationName !== locationName
      ) {
        continue;
      }

      // Return connection with decrypted values
      return {
        ...connection,
        realmId: decryptedRealmId,
        refreshToken: decrypt(connection.refreshToken),
      };
    }
  }

  return null;
}

/**
 * Get all QuickBooks connections for a user
 * Returns connections with decrypted sensitive data
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

  // Decrypt sensitive data before returning
  return userConnections.map((uc) => {
    let decryptedRealmId: string;
    try {
      decryptedRealmId = decrypt(uc.qbConnection.realmId);
      // Validate decrypted realmId format (should be short, alphanumeric)
      if (
        decryptedRealmId.length > 50 ||
        !/^[A-Za-z0-9_-]{1,50}$/.test(decryptedRealmId)
      ) {
        throw new Error(
          `Decrypted realmId has invalid format (length: ${decryptedRealmId.length}). ` +
            'This indicates the realmId in the database may be corrupted. Please re-authenticate.'
        );
      }
    } catch (error: any) {
      throw new Error(
        `Failed to decrypt realmId for connection ${uc.qbConnection.id}: ${error.message}. ` +
          'The connection may be corrupted. Please re-authenticate your QuickBooks connection.'
      );
    }

    return {
      ...uc.qbConnection,
      realmId: decryptedRealmId,
      refreshToken: decrypt(uc.qbConnection.refreshToken),
    };
  });
}

/**
 * Get a specific QuickBooks connection by ID (for the user)
 * Returns connection with decrypted sensitive data
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

  if (!userConnection) {
    return null;
  }

  // Decrypt sensitive data before returning
  let decryptedRealmId: string;
  try {
    decryptedRealmId = decrypt(userConnection.qbConnection.realmId);
    // Validate decrypted realmId format (should be short, alphanumeric)
    if (
      decryptedRealmId.length > 50 ||
      !/^[A-Za-z0-9_-]{1,50}$/.test(decryptedRealmId)
    ) {
      throw new Error(
        `Decrypted realmId has invalid format (length: ${decryptedRealmId.length}). ` +
          'This indicates the realmId in the database may be corrupted. Please re-authenticate.'
      );
    }
  } catch (error: any) {
    throw new Error(
      `Failed to decrypt realmId for connection ${userConnection.qbConnection.id}: ${error.message}. ` +
        'The connection may be corrupted. Please re-authenticate your QuickBooks connection.'
    );
  }

  return {
    ...userConnection.qbConnection,
    realmId: decryptedRealmId,
    refreshToken: decrypt(userConnection.qbConnection.refreshToken),
  };
}

// ============================================================================
// Token Update & Deletion
// ============================================================================

/**
 * Update QuickBooks tokens in database
 * Encrypts refreshToken if provided
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
  // Encrypt refreshToken if provided
  const updateData: any = { ...tokens };
  if (tokens.refreshToken) {
    updateData.refreshToken = encrypt(tokens.refreshToken);
  }

  const updated = await prisma.qBConnection.update({
    where: { id: connectionId },
    data: updateData,
  });

  // Decrypt sensitive data before returning
  return {
    ...updated,
    realmId: decrypt(updated.realmId),
    refreshToken: decrypt(updated.refreshToken),
  };
}

// ============================================================================
// Token Status Checks
// ============================================================================

/**
 * Check if access token is expired or will expire soon (within 5 minutes)
 * Note: connection should have decrypted data (from get functions)
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
