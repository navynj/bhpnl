import { Client } from '@notionhq/client';
import { generatePDFFromReportData } from './pdf-generator';

/**
 * Normalize Notion database ID - remove hyphens if present
 * Notion API accepts both formats, but we'll normalize to format without hyphens
 */
export function normalizeNotionId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  // Remove all hyphens and convert to lowercase
  return id.replace(/-/g, '').toLowerCase();
}

/**
 * Extract Notion database ID from a Notion URL
 * Supports formats like:
 * - https://www.notion.so/workspace/2c839d9ac71480ac995dffbb59a12e98
 * - https://www.notion.so/workspace/2c839d9ac71480ac995dffbb59a12e98?v=...
 */
export function extractNotionDatabaseIdFromUrl(url: string): string | null {
  try {
    // Match 32-character hex string (with or without hyphens) in the URL
    const match = url.match(/([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})/i);
    if (match) {
      return normalizeNotionId(match[1]) || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Format Notion ID with hyphens for display (8-4-4-4-12 format)
 */
function formatNotionId(id: string): string {
  const cleanId = id.replace(/-/g, '');
  if (cleanId.length !== 32) return id; // Invalid UUID format
  return `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20, 32)}`;
}

/**
 * Get Notion client instance (singleton pattern for serverless environments)
 */
let notionClientInstance: Client & { databases: { query: (args: any) => Promise<any> } } | null = null;

function getNotionClient(): Client & { databases: { query: (args: any) => Promise<any> } } {
  if (!notionClientInstance) {
    const notionToken = process.env.NOTION_API_KEY;
    if (!notionToken) {
      throw new Error('NOTION_API_KEY environment variable is not set');
    }
    const client = new Client({ auth: notionToken });
    
    // Add the missing databases.query method if it doesn't exist
    // This is a workaround for @notionhq/client 5.4.0 which may have removed this method
    if (!client.databases.query) {
      (client.databases as any).query = async (args: { database_id: string; filter?: any; sorts?: any[] }) => {
        // Make a direct API call to the Notion database query endpoint
        const response = await fetch(`https://api.notion.com/v1/databases/${args.database_id}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${notionToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter: args.filter,
            sorts: args.sorts,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(`Notion API error: ${error.message || response.statusText}`);
        }

        return response.json();
      };
    }
    
    notionClientInstance = client as Client & { databases: { query: (args: any) => Promise<any> } };
  }
  return notionClientInstance;
}

/**
 * Get Notion database ID (normalized)
 */
function getNotionDatabaseId(): string {
  const rawDatabaseId = process.env.NOTION_DATABASE_ID;
  const notionDatabaseId = normalizeNotionId(rawDatabaseId);
  
  if (!notionDatabaseId) {
    throw new Error('NOTION_DATABASE_ID environment variable is not set');
  }
  
  // Log the database ID being used (formatted for readability)
  if (rawDatabaseId) {
    console.log(`Using Notion Database ID: ${formatNotionId(notionDatabaseId)}`);
  }
  
  return notionDatabaseId;
}

export interface NotionReport {
  id: string;
  connectionId: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  notionPageId?: string;
  notionUrl?: string;
  pdfUrl?: string;
}

/**
 * Create a report in Notion database
 */
export async function createReportInNotion(
  userId: string,
  connectionId: string,
  startDate: Date,
  endDate: Date,
  reportData: any
): Promise<NotionReport> {
  const notion = getNotionClient();
  const notionDatabaseId = getNotionDatabaseId();

  try {
    // Create a page in the Notion database
    const response = await notion.pages.create({
      parent: {
        database_id: notionDatabaseId,
      },
    properties: {
      Title: {
        title: [
          {
            text: {
              content: `P&L Report (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`,
            },
          },
        ],
      },
      'User ID': {
        rich_text: [
          {
            text: {
              content: userId,
            },
          },
        ],
      },
      'Connection ID': {
        rich_text: [
          {
            text: {
              content: connectionId,
            },
          },
        ],
      },
      'Start Date': {
        date: {
          start: startDate.toISOString().split('T')[0],
        },
      },
      'End Date': {
        date: {
          start: endDate.toISOString().split('T')[0],
        },
      },
      'Created At': {
        date: {
          start: new Date().toISOString(),
        },
      },
    },
  });

  // Generate PDF from report data
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  // Create PDF download URL (will be served by API endpoint)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const pdfUrl = `${baseUrl}/api/reports/${response.id}/pdf`;

  // Update page to add PDF file to "Report" property (if it exists)
  try {
    await notion.pages.update({
      page_id: response.id,
      properties: {
        'Report': {
          files: [
            {
              name: `P&L_Report_${startDateStr}_${endDateStr}.pdf`,
              external: {
                url: pdfUrl,
              },
            },
          ],
        },
      },
    });
  } catch (updateError: any) {
    // If "Report" property doesn't exist, just log the error and continue
    console.warn('Could not update Report property (may not exist):', updateError.message);
  }

  // Add report content as blocks
  // Note: reportData is still used here for creating Notion blocks during initial creation
  // but it's not stored in the database
  const reportDataObj = reportData as any;
  const header = reportDataObj?.Header || {};
  const rows = reportDataObj?.Rows?.Row || [];
  const columns = reportDataObj?.Columns?.Column || [];

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
            content: `Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
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

  // Add PDF file block to Notion page content
  children.push({
    object: 'block',
    type: 'file',
    file: {
      type: 'external',
      external: {
        url: pdfUrl,
      },
      caption: [
        {
          type: 'text',
          text: { content: 'P&L Report PDF' },
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

  // Extract properties from the response
  const props = response.properties as any;
  const startDateProp = props['Start Date']?.date?.start || startDate.toISOString().split('T')[0];
  const endDateProp = props['End Date']?.date?.start || endDate.toISOString().split('T')[0];
  const createdAtProp = props['Created At']?.date?.start || new Date().toISOString();

    return {
      id: response.id,
      connectionId,
      startDate: startDateProp,
      endDate: endDateProp,
      createdAt: createdAtProp,
      updatedAt: createdAtProp,
      notionPageId: response.id,
      notionUrl: response.url,
      pdfUrl,
    };
  } catch (error: any) {
    // Provide more helpful error messages
    if (error.code === 'object_not_found') {
      throw new Error(
        `Could not find Notion database with ID: ${formatNotionId(notionDatabaseId)}. ` +
        `Please verify that:\n` +
        `1. The database ID is correct\n` +
        `2. Your Notion integration has access to this database\n` +
        `3. The database exists in your Notion workspace`
      );
    }
    if (error.code === 'unauthorized') {
      throw new Error(
        `Notion API key does not have access to database: ${formatNotionId(notionDatabaseId)}. ` +
        `Please ensure your Notion integration is connected to this database.`
      );
    }
    throw error;
  }
}

/**
 * Get reports from Notion database
 */
export async function getReportsFromNotion(
  userId: string,
  connectionId?: string
): Promise<NotionReport[]> {
  const notion = getNotionClient();
  const notionDatabaseId = getNotionDatabaseId();

  let filter: any = {
    property: 'User ID',
    rich_text: {
      equals: userId,
    },
  };

  if (connectionId) {
    filter = {
      and: [
        {
          property: 'User ID',
          rich_text: {
            equals: userId,
          },
        },
        {
          property: 'Connection ID',
          rich_text: {
            equals: connectionId,
          },
        },
      ],
    };
  }

  try {
    const response = await notion.databases.query({
      database_id: notionDatabaseId,
      filter,
      sorts: [
        {
          property: 'Created At',
          direction: 'descending',
        },
      ],
    });

    return response.results.map((page: any) => {
      const props = page.properties;
      const startDateProp = props['Start Date']?.date?.start;
      const endDateProp = props['End Date']?.date?.start;
      const createdAtProp = props['Created At']?.date?.start || page.created_time;
      const connectionIdProp = props['Connection ID']?.rich_text?.[0]?.text?.content || '';

      return {
        id: page.id,
        connectionId: connectionIdProp,
        startDate: startDateProp || '',
        endDate: endDateProp || '',
        createdAt: createdAtProp || page.created_time,
        updatedAt: page.last_edited_time || page.created_time,
        notionPageId: page.id,
        notionUrl: page.url,
      };
    });
  } catch (error: any) {
    // Provide more helpful error messages
    if (error.code === 'object_not_found') {
      throw new Error(
        `Could not find Notion database with ID: ${formatNotionId(notionDatabaseId)}. ` +
        `Please verify that:\n` +
        `1. The database ID is correct\n` +
        `2. Your Notion integration has access to this database\n` +
        `3. The database exists in your Notion workspace`
      );
    }
    if (error.code === 'unauthorized') {
      throw new Error(
        `Notion API key does not have access to database: ${formatNotionId(notionDatabaseId)}. ` +
        `Please ensure your Notion integration is connected to this database.`
      );
    }
    throw error;
  }
}

/**
 * Get a specific report from Notion by ID
 */
export async function getReportFromNotionById(
  pageId: string,
  userId: string
): Promise<NotionReport | null> {
  const notion = getNotionClient();
  
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const props = (page as any).properties;

    // Verify user owns this report
    const userIdProp = props['User ID']?.rich_text?.[0]?.text?.content;
    if (userIdProp !== userId) {
      return null;
    }

    const startDateProp = props['Start Date']?.date?.start;
    const endDateProp = props['End Date']?.date?.start;
    const createdAtProp = props['Created At']?.date?.start || (page as any).created_time;
    const connectionIdProp = props['Connection ID']?.rich_text?.[0]?.text?.content || '';

    return {
      id: page.id,
      connectionId: connectionIdProp,
      startDate: startDateProp || '',
      endDate: endDateProp || '',
      createdAt: createdAtProp || (page as any).created_time,
      updatedAt: (page as any).last_edited_time || (page as any).created_time,
      notionPageId: page.id,
      notionUrl: (page as any).url,
    };
  } catch (error) {
    console.error('Error fetching report from Notion:', error);
    return null;
  }
}

