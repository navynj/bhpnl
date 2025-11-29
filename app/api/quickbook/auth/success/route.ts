import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getUserQuickBooksConnections } from '@/lib/quickbooks-token';

/**
 * GET /api/quickbook/auth/success
 * Success page after OAuth callback - shows that tokens were saved
 *
 * Query parameters:
 * - realmId (optional): Realm ID to verify specific connection
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get all connections for the user
    const connections = await getUserQuickBooksConnections(user.id);

    if (connections.length === 0) {
      return NextResponse.json(
        { error: 'Tokens not found. Authentication may have failed.' },
        { status: 400 }
      );
    }

    // Get the most recently created connection (the one just created)
    const latestConnection = connections.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0];

    // Optionally verify specific realmId from query params
    const { searchParams } = new URL(request.url);
    const realmId = searchParams.get('realmId');

    if (realmId && latestConnection.realmId !== realmId) {
      // Try to find connection with matching realmId
      const matchingConnection = connections.find(
        (conn) => conn.realmId === realmId
      );

      if (matchingConnection) {
        return NextResponse.json({
          success: true,
          message:
            'QuickBooks authentication successful! Tokens have been saved.',
          realmId: matchingConnection.realmId,
          locationName: matchingConnection.locationName,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'QuickBooks authentication successful! Tokens have been saved.',
      realmId: latestConnection.realmId,
      locationName: latestConnection.locationName,
    });
  } catch (error: any) {
    console.error('Error in success route:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify authentication',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
