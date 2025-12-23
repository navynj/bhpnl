import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getReportFromNotionById,
  normalizeNotionId,
} from '@/lib/notion-reports';
import { generatePDFFromReportData } from '@/lib/pdf-generator';
import { getProfitAndLossReport } from '@/lib/quickbooks-api';
import { getQuickBooksConnectionById } from '@/lib/quickbooks-token';
// import { writeFile } from 'fs/promises';
// import { join } from 'path';

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
        {
          error: 'Report not found',
          details: `Report with ID ${id} not found. Please verify the report exists in Notion.`,
        },
        { status: 404 }
      );
    }

    // Fetch report from QuickBooks
    // For monthly reports, use summarize_column_by=Month to get monthly columns
    const isMonthly =
      report.isMonthly || (report.months && report.months.length > 0);

    const reportData = await getProfitAndLossReport(
      userId,
      report.startDate,
      report.endDate,
      'Accrual',
      report.connectionId,
      isMonthly ? 'Month' : undefined // Use Month summarization for monthly reports
    );

    // Save report data to txt file for debugging
    // const jsonData = JSON.stringify(reportData, null, 2);
    // const fileName = `report_data_${id}_${report.startDate}_${
    //   report.endDate
    // }_${Date.now()}.txt`;
    // const filePath = join(process.cwd(), fileName);

    // try {
    //   await writeFile(filePath, jsonData, 'utf-8');
    //   console.log(`Report data saved to: ${filePath}`);
    // } catch (fileError) {
    //   console.error('Error saving report data to file:', fileError);
    // }

    // Get connection info to retrieve locationName
    const connection = await getQuickBooksConnectionById(
      userId,
      report.connectionId
    );
    const locationName = connection?.locationName;

    // Generate PDF
    const pdfBytes = generatePDFFromReportData(
      reportData,
      report.startDate,
      report.endDate,
      locationName,
      report.targetPercentages
    );

    // Build PDF filename with location name and monthly indicator
    const locationPrefix = locationName ? `${locationName}_` : '';
    const monthlyPrefix = report.isMonthly ? 'Monthly_' : '';
    const pdfFileName = `${locationPrefix}${monthlyPrefix}P&L_Report_${report.startDate}_${report.endDate}.pdf`;

    // Convert Uint8Array to Buffer
    const pdfBuffer = Buffer.from(pdfBytes);

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFileName}"`,
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
