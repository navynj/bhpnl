import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getReportFromNotionById, normalizeNotionId, extractNotionDatabaseIdFromUrl } from '@/lib/notion-reports';
import { Client } from '@notionhq/client';

/**
 * POST /api/reports/[id]/export/notion
 * Export a report to a different Notion database (for backup or sharing)
 * 
 * Body:
 * {
 *   "notionDatabaseId": "xxx" (optional, uses env var if not provided)
 * }
 */
export async function POST(
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

    const notionToken = process.env.NOTION_API_KEY;
    if (!notionToken) {
      return NextResponse.json(
        { error: 'Notion API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let notionDatabaseId = body.notionDatabaseId || process.env.NOTION_DATABASE_ID;

    if (!notionDatabaseId) {
      return NextResponse.json(
        { error: 'Notion database ID not provided' },
        { status: 400 }
      );
    }

    // If the provided ID is a URL, extract the database ID from it
    if (notionDatabaseId.startsWith('http')) {
      const extractedId = extractNotionDatabaseIdFromUrl(notionDatabaseId);
      if (!extractedId) {
        return NextResponse.json(
          { error: 'Invalid Notion URL format. Could not extract database ID.' },
          { status: 400 }
        );
      }
      notionDatabaseId = extractedId;
    } else {
      // Normalize the database ID (remove hyphens if present)
      notionDatabaseId = normalizeNotionId(notionDatabaseId) || notionDatabaseId;
    }

    const notion = new Client({ auth: notionToken });

    // Fetch report data from QuickBooks in real-time
    const { getProfitAndLossReport } = await import('@/lib/quickbooks-api');
    const reportData = await getProfitAndLossReport(
      userId,
      report.startDate,
      report.endDate,
      'Accrual',
      report.connectionId
    );

    const header = reportData?.Header || {};
    const rows = reportData?.Rows?.Row || [];
    const columns = reportData?.Columns?.Column || [];

    // Create a page in the target Notion database
    const response = await notion.pages.create({
      parent: {
        database_id: notionDatabaseId,
      },
      properties: {
        Title: {
          title: [
            {
              text: {
                content: `P&L Report (${report.startDate} to ${report.endDate})`,
              },
            },
          ],
        },
        'Start Date': {
          date: {
            start: report.startDate,
          },
        },
        'End Date': {
          date: {
            start: report.endDate,
          },
        },
        'Created At': {
          date: {
            start: report.createdAt,
          },
        },
      },
    });

    // Build children blocks for the report content
    const children: any[] = [];

    // Add header information
    children.push({
      object: 'block',
      type: 'heading_1',
      heading_1: {
        rich_text: [
          {
            type: 'text',
            text: { content: 'Profit & Loss Report' },
          },
        ],
      },
    });

    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: `Period: ${report.startDate} to ${report.endDate}`,
            },
          },
        ],
      },
    });

    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: `Report Basis: ${header.ReportBasis || 'N/A'}` },
          },
        ],
      },
    });

    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: `Currency: ${header.Currency || 'N/A'}` },
          },
        ],
      },
    });

    // Add report data section
    if (rows.length > 0) {
      children.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [
            {
              type: 'text',
              text: { content: 'Report Data' },
            },
          ],
        },
      });

      // Format report data as a code block with table-like structure
      let reportTable = '';
      
      // Add header row if columns exist
      if (columns.length > 0) {
        const headers = columns.map((col: any) => col.ColTitle || '').join(' | ');
        reportTable += `| ${headers} |\n`;
        reportTable += `| ${columns.map(() => '---').join(' | ')} |\n`;
      }

      // Add data rows
      rows.forEach((row: any) => {
        if (row.ColData && row.ColData.length > 0) {
          const values = row.ColData.map((col: any) => col.value || '').join(' | ');
          reportTable += `| ${values} |\n`;
        }
      });

      children.push({
        object: 'block',
        type: 'code',
        code: {
          caption: [],
          rich_text: [
            {
              type: 'text',
              text: { content: reportTable },
            },
          ],
          language: 'plain text',
        },
      });
    }

    // Add all children blocks to the page in batches
    for (let i = 0; i < children.length; i += 100) {
      const batch = children.slice(i, i + 100);
      await notion.blocks.children.append({
        block_id: response.id,
        children: batch,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Report exported to Notion successfully',
      notionPageId: response.id,
      notionUrl: response.url,
    });
  } catch (error: any) {
    console.error('Error exporting report to Notion:', error);
    return NextResponse.json(
      {
        error: 'Failed to export report to Notion',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

