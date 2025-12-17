import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getReportFromNotionById, normalizeNotionId, extractNotionDatabaseIdFromUrl } from '@/lib/notion-reports';
import { Client } from '@notionhq/client';
import { getQuickBooksConnectionById } from '@/lib/quickbooks-token';

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

    // Get connection info to retrieve locationName
    const connection = await getQuickBooksConnectionById(userId, report.connectionId);
    const locationName = connection?.locationName;
    const locationPrefix = locationName ? `${locationName} - ` : '';

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
                content: `${locationPrefix}P&L Report (${report.startDate} to ${report.endDate})`,
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

    // Page content is intentionally left empty

    // Format page ID with hyphens for URL construction
    const formatNotionId = (id: string): string => {
      const cleanId = id.replace(/-/g, '');
      if (cleanId.length !== 32) return id;
      return `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20, 32)}`;
    };

    const formattedId = formatNotionId(response.id);
    const notionUrl = (response as any).url || `https://www.notion.so/${formattedId}`;

    return NextResponse.json({
      success: true,
      message: 'Report exported to Notion successfully',
      notionPageId: response.id,
      notionUrl,
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

