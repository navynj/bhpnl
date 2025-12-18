import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProfitAndLossReport } from '@/lib/quickbooks-api';
import { createReportInNotion } from '@/lib/notion-reports';

/**
 * POST /api/reports
 * Create a new P&L report
 *
 * Body (Period mode):
 * {
 *   "connectionId": "xxx",
 *   "startDate": "2024-01-01",
 *   "endDate": "2024-12-31",
 *   "accountingMethod": "Accrual" | "Cash"
 * }
 *
 * Body (Monthly mode):
 * {
 *   "connectionId": "xxx",
 *   "months": [{ "year": 2024, "month": 1 }, { "year": 2024, "month": 2 }],
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
      months,
      accountingMethod = 'Accrual',
      targetPercentages,
    } = body;

    // Monthly mode
    if (months && Array.isArray(months)) {
      if (!connectionId) {
        return NextResponse.json(
          {
            error: 'Missing required field: connectionId',
          },
          { status: 400 }
        );
      }

      if (months.length === 0 || months.length > 3) {
        return NextResponse.json(
          {
            error: 'Please select 1 to 3 months',
          },
          { status: 400 }
        );
      }

      // Validate months format
      for (const month of months) {
        if (
          typeof month.year !== 'number' ||
          typeof month.month !== 'number' ||
          month.month < 1 ||
          month.month > 12
        ) {
          return NextResponse.json(
            {
              error: 'Invalid month format. Use { year: number, month: 1-12 }',
            },
            { status: 400 }
          );
        }
      }

      // Calculate the overall date range for all selected months
      // months array contains { year: number, month: number } where month is 1-12
      const allStartDates = months.map((month) => {
        // month.month is 1-12, so month.month - 1 gives 0-11 (JavaScript Date uses 0-based months)
        return new Date(month.year, month.month - 1, 1);
      });
      const allEndDates = months.map((month) => {
        // To get the last day of the month: new Date(year, month, 0)
        // month.month is 1-12, so month.month gives next month, and day 0 gives last day of current month
        return new Date(month.year, month.month, 0, 23, 59, 59);
      });

      const reportStartDate = new Date(
        Math.min(...allStartDates.map((d) => d.getTime()))
      );
      const reportEndDate = new Date(
        Math.max(...allEndDates.map((d) => d.getTime()))
      );

      // Format dates in local timezone to avoid timezone conversion issues
      // toISOString() converts to UTC which can shift the date by one day
      const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(reportStartDate);
      const endDateStr = formatLocalDate(reportEndDate);

      console.log(`[Monthly Report] Requesting single report for period: ${startDateStr} to ${endDateStr}`);
      console.log(`[Monthly Report] Selected months:`, months);

      // Fetch a single report for the entire period with Month summarization
      // This will automatically create columns for each month in the range
      const reportData = await getProfitAndLossReport(
        userId,
        startDateStr,
        endDateStr,
        accountingMethod as 'Accrual' | 'Cash',
        connectionId,
        'Month' // Use Month summarization - QuickBooks will create columns for each month
      );

      // Check if QuickBooks API actually returned Month summarization
      const summarizeBy = reportData?.Header?.SummarizeColumnsBy;
      console.log(`[Monthly Report] QuickBooks SummarizeColumnsBy: ${summarizeBy}`);

      if (summarizeBy !== 'Month') {
        console.warn(
          `[Monthly Report] Warning: Expected SummarizeColumnsBy="Month" but got "${summarizeBy}". ` +
            `QuickBooks API may have ignored the summarize_column_by parameter.`
        );
      }

      // Save report to Notion database
      const report = await createReportInNotion(
        userId,
        connectionId,
        reportStartDate,
        reportEndDate,
        reportData, // Use the report data directly from QuickBooks
        months, // Pass months metadata
        targetPercentages // Pass target percentages
      );

      return NextResponse.json({
        success: true,
        report,
      });
    }

    // Period mode (existing logic)
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
      reportData,
      undefined, // months
      targetPercentages // Pass target percentages
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
