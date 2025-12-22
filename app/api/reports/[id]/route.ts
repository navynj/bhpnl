import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getReportFromNotionById, normalizeNotionId } from '@/lib/notion-reports';

/**
 * GET /api/reports/[id]
 * Get a specific report by ID from Notion
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { id } = await params;

    // Normalize Notion ID (remove hyphens if present)
    // Notion API accepts both formats, but we normalize for consistency
    const normalizedId = normalizeNotionId(id) || id;

    // Get report from Notion - try normalized ID first, then original if different
    let report = await getReportFromNotionById(normalizedId, userId);
    
    // If normalized ID failed and it's different from original, try original format
    if (!report && normalizedId !== id) {
      report = await getReportFromNotionById(id, userId);
    }

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch report',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
