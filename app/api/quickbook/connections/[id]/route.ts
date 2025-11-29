import { NextRequest, NextResponse } from 'next/server';
import { deleteQuickBooksConnection } from '@/lib/quickbooks-token';
import { auth } from '@/lib/auth';

/**
 * DELETE /api/quickbook/connections/[id]
 * Delete a QuickBooks connection for the current user
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Connection deleted successfully"
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: connectionId } = await params;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Delete the connection
    await deleteQuickBooksConnection(userId, connectionId);

    return NextResponse.json({
      success: true,
      message: 'Connection deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting QuickBooks connection:', error);

    if (error.message?.includes('not found') || error.message?.includes('access denied')) {
      return NextResponse.json(
        {
          error: 'Connection not found or access denied',
          details: error.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to delete QuickBooks connection',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

