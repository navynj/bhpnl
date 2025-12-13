import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProfitAndLossReport } from '@/lib/quickbooks-api';
import { createReportInNotion } from '@/lib/notion-reports';

/**
 * POST /api/reports
 * Create a new P&L report
 *
 * Body:
 * {
 *   "connectionId": "xxx",
 *   "startDate": "2024-01-01",
 *   "endDate": "2024-12-31",
 *   "accountingMethod": "Accrual" | "Cash"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const {
      connectionId,
      startDate,
      endDate,
      accountingMethod = 'Accrual',
    } = body;

    if (!connectionId || !startDate || !endDate) {
      return NextResponse.json(
        {
          error: 'Missing required fields: connectionId, startDate, endDate',
        },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Fetch report from QuickBooks
    const reportData = await getProfitAndLossReport(
      userId,
      startDate,
      endDate,
      accountingMethod as 'Accrual' | 'Cash',
      connectionId
    );

    // Save report to Notion database
    const report = await createReportInNotion(
      userId,
      connectionId,
      new Date(startDate),
      new Date(endDate),
      reportData
    );

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      {
        error: 'Failed to create report',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports
 * Get all reports for the authenticated user from Notion
 *
 * Query parameters:
 * - connectionId (optional): Filter by connection ID
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId') || undefined;

    const { getReportsFromNotion } = await import('@/lib/notion-reports');
    const reports = await getReportsFromNotion(userId, connectionId);

    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch reports',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
