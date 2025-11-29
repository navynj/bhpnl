import { NextRequest, NextResponse } from 'next/server';
import { getProfitAndLossReport } from '@/lib/quickbooks-api';
import { auth } from '@/lib/auth';

/**
 * GET /api/quickbook/reports/profit-loss
 * Get Profit & Loss report from QuickBooks
 * 
 * Query parameters:
 * - start_date (required): Start date in YYYY-MM-DD format
 * - end_date (required): End date in YYYY-MM-DD format
 * - accounting_method (optional): 'Accrual' or 'Cash' (default: 'Accrual')
 * - connection_id (optional): Specific QuickBooks connection ID (uses first if not provided)
 * 
 * Example:
 * GET /api/quickbook/reports/profit-loss?start_date=2024-01-01&end_date=2024-12-31&accounting_method=Accrual&connection_id=xxx
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const accountingMethod = (searchParams.get('accounting_method') ||
      'Accrual') as 'Accrual' | 'Cash';
    const connectionId = searchParams.get('connection_id') || undefined;

    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          details: 'start_date and end_date are required (format: YYYY-MM-DD)',
        },
        { status: 400 }
      );
    }

    // Validate date format (basic check)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        {
          error: 'Invalid date format',
          details: 'Dates must be in YYYY-MM-DD format',
        },
        { status: 400 }
      );
    }

    // Get Profit & Loss report
    const report = await getProfitAndLossReport(
      userId,
      startDate,
      endDate,
      accountingMethod,
      connectionId
    );

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('Error fetching Profit & Loss report:', error);

    // Handle authentication errors
    if (
      error.message?.includes('No QuickBooks connections') ||
      error.message?.includes('not found') ||
      error.message?.includes('re-authenticate')
    ) {
      return NextResponse.json(
        {
          error: 'QuickBooks connection required',
          details: error.message,
          action: 'Please authenticate at /api/quickbook/auth',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch Profit & Loss report',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

