import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getReportFromNotionById } from '@/lib/notion-reports';

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

    const report = await getReportFromNotionById(id, userId);

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
