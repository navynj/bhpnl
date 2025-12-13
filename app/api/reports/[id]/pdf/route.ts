import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getReportFromNotionById } from '@/lib/notion-reports';
import { generatePDFFromReportData } from '@/lib/pdf-generator';
import { getProfitAndLossReport } from '@/lib/quickbooks-api';

/**
 * GET /api/reports/[id]/pdf
 * Download PDF for a report
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

    // Get report from Notion
    const report = await getReportFromNotionById(id, userId);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Fetch report data from QuickBooks in real-time
    const reportData = await getProfitAndLossReport(
      userId,
      report.startDate,
      report.endDate,
      'Accrual',
      report.connectionId
    );

    // Generate PDF
    const pdfBytes = generatePDFFromReportData(
      reportData,
      report.startDate,
      report.endDate
    );

    // Convert Uint8Array to Buffer
    const pdfBuffer = Buffer.from(pdfBytes);

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="P&L_Report_${report.startDate}_${report.endDate}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

