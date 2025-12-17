import { Client } from '@notionhq/client';
import { generatePDFFromReportData } from './pdf-generator';
import { getQuickBooksConnectionById } from './quickbooks-token';

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
    const match = url.match(
      /([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})/i
    );
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
  return `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(
    12,
    16
  )}-${cleanId.slice(16, 20)}-${cleanId.slice(20, 32)}`;
}

/**
 * Get Notion client instance (singleton pattern for serverless environments)
 */
let notionClientInstance:
  | (Client & { databases: { query: (args: any) => Promise<any> } })
  | null = null;

function getNotionClient(): Client & {
  databases: { query: (args: any) => Promise<any> };
} {
  if (!notionClientInstance) {
    const notionToken = process.env.NOTION_API_KEY;
    if (!notionToken) {
      throw new Error('NOTION_API_KEY environment variable is not set');
    }
    const client = new Client({ auth: notionToken });

    // Add the missing databases.query method if it doesn't exist
    // This is a workaround for @notionhq/client 5.4.0 which may have removed this method
    const databasesAny = client.databases as any;
    if (!databasesAny.query) {
      databasesAny.query = async (args: {
        database_id: string;
        filter?: any;
        sorts?: any[];
      }) => {
        // Make a direct API call to the Notion database query endpoint
        const response = await fetch(
          `https://api.notion.com/v1/databases/${args.database_id}/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${notionToken}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filter: args.filter,
              sorts: args.sorts,
            }),
          }
        );

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ message: 'Unknown error' }));
          throw new Error(
            `Notion API error: ${error.message || response.statusText}`
          );
        }

        return response.json();
      };
    }

    notionClientInstance = client as Client & {
      databases: { query: (args: any) => Promise<any> };
    };
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
    console.log(
      `Using Notion Database ID: ${formatNotionId(notionDatabaseId)}`
    );
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
  months?: Array<{ year: number; month: number }>;
  isMonthly?: boolean;
  targetPercentages?: {
    costOfSales?: number;
    payroll?: number;
    profit?: number;
  };
}

/**
 * Create a report in Notion database
 */
export async function createReportInNotion(
  userId: string,
  connectionId: string,
  startDate: Date,
  endDate: Date,
  reportData: any,
  months?: Array<{ year: number; month: number }>,
  targetPercentages?: {
    costOfSales?: number;
    payroll?: number;
    profit?: number;
  }
): Promise<NotionReport> {
  const notion = getNotionClient();
  const notionDatabaseId = getNotionDatabaseId();

  try {
    // Get connection info to retrieve locationName
    const connection = await getQuickBooksConnectionById(userId, connectionId);
    const locationName = connection?.locationName;
    const locationPrefix = locationName ? `${locationName} - ` : '';

    // Determine if this is a monthly report
    const isMonthly = months && months.length > 0;
    const reportType = isMonthly ? 'Monthly P&L Report' : 'P&L Report';
    const dateRange = `(${startDate.toISOString().split('T')[0]} to ${
      endDate.toISOString().split('T')[0]
    })`;

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
                content: `${locationPrefix}${reportType} ${dateRange}`,
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
        Monthly: {
          checkbox: isMonthly || false,
        },
        ...(targetPercentages?.costOfSales !== undefined && {
          'Cost of Sales Target %': {
            number: targetPercentages.costOfSales,
          },
        }),
        ...(targetPercentages?.payroll !== undefined && {
          'Payroll Target %': {
            number: targetPercentages.payroll,
          },
        }),
        ...(targetPercentages?.profit !== undefined && {
          'Profit Target %': {
            number: targetPercentages.profit,
          },
        }),
      },
    });

    // Note: months array is used to calculate startDate/endDate above
    // We don't store months separately in Notion since startDate/endDate already capture the date range

    // Generate PDF from report data
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Create PDF download URL (will be served by API endpoint)
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000');
    const pdfUrl = `${baseUrl}/api/reports/${response.id}/pdf`;

    // Build PDF filename with location name and monthly indicator
    const locationPrefixForFile = locationName ? `${locationName}_` : '';
    const monthlyPrefix = isMonthly ? 'Monthly_' : '';
    const pdfFileName = `${locationPrefixForFile}${monthlyPrefix}P&L_Report_${startDateStr}_${endDateStr}.pdf`;

    // Update page to add PDF file to "Report" property (if it exists)
    try {
      await notion.pages.update({
        page_id: response.id,
        properties: {
          Report: {
            files: [
              {
                name: pdfFileName,
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
      console.warn(
        'Could not update Report property (may not exist):',
        updateError.message
      );
    }

    // Page content is intentionally left empty

    // Extract properties from the response
    const responseAny = response as any;
    const props = responseAny.properties || {};
    const startDateProp =
      props['Start Date']?.date?.start || startDate.toISOString().split('T')[0];
    const endDateProp =
      props['End Date']?.date?.start || endDate.toISOString().split('T')[0];
    const createdAtProp =
      props['Created At']?.date?.start || new Date().toISOString();

    // Format page ID with hyphens for URL construction
    const formattedId = formatNotionId(response.id);
    const notionUrl = responseAny.url || `https://www.notion.so/${formattedId}`;

    // Extract months if available
    const monthsProp = props['Months']?.rich_text?.[0]?.text?.content;
    let parsedMonths: Array<{ year: number; month: number }> | undefined;
    if (monthsProp) {
      try {
        parsedMonths = JSON.parse(monthsProp);
      } catch {
        // Ignore parse errors
      }
    }

    const isMonthlyProp = props['Monthly']?.checkbox || false;

    return {
      id: response.id,
      connectionId,
      startDate: startDateProp,
      endDate: endDateProp,
      createdAt: createdAtProp,
      updatedAt: createdAtProp,
      notionPageId: response.id,
      notionUrl,
      pdfUrl,
      months: parsedMonths || months,
      isMonthly: isMonthlyProp,
      targetPercentages,
    };
  } catch (error: any) {
    // Provide more helpful error messages
    if (error.code === 'object_not_found') {
      throw new Error(
        `Could not find Notion database with ID: ${formatNotionId(
          notionDatabaseId
        )}. ` +
          `Please verify that:\n` +
          `1. The database ID is correct\n` +
          `2. Your Notion integration has access to this database\n` +
          `3. The database exists in your Notion workspace`
      );
    }
    if (error.code === 'unauthorized') {
      throw new Error(
        `Notion API key does not have access to database: ${formatNotionId(
          notionDatabaseId
        )}. ` +
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
      const createdAtProp =
        props['Created At']?.date?.start || page.created_time;
      const connectionIdProp =
        props['Connection ID']?.rich_text?.[0]?.text?.content || '';

      const monthsProp = props['Months']?.rich_text?.[0]?.text?.content;
      let parsedMonths: Array<{ year: number; month: number }> | undefined;
      if (monthsProp) {
        try {
          parsedMonths = JSON.parse(monthsProp);
        } catch {
          // Ignore parse errors
        }
      }

      const isMonthly = props['Monthly']?.checkbox || false;

      // Extract target percentages from Notion properties
      const costOfSalesTarget = props['Cost of Sales Target %']?.number;
      const payrollTarget = props['Payroll Target %']?.number;
      const profitTarget = props['Profit Target %']?.number;

      const targetPercentages =
        costOfSalesTarget !== undefined ||
        payrollTarget !== undefined ||
        profitTarget !== undefined
          ? {
              ...(costOfSalesTarget !== undefined && {
                costOfSales: costOfSalesTarget,
              }),
              ...(payrollTarget !== undefined && { payroll: payrollTarget }),
              ...(profitTarget !== undefined && { profit: profitTarget }),
            }
          : undefined;

      return {
        id: page.id,
        connectionId: connectionIdProp,
        startDate: startDateProp || '',
        endDate: endDateProp || '',
        createdAt: createdAtProp || page.created_time,
        updatedAt: page.last_edited_time || page.created_time,
        notionPageId: page.id,
        notionUrl: page.url,
        months: parsedMonths,
        isMonthly,
        targetPercentages,
      };
    });
  } catch (error: any) {
    // Provide more helpful error messages
    if (error.code === 'object_not_found') {
      throw new Error(
        `Could not find Notion database with ID: ${formatNotionId(
          notionDatabaseId
        )}. ` +
          `Please verify that:\n` +
          `1. The database ID is correct\n` +
          `2. Your Notion integration has access to this database\n` +
          `3. The database exists in your Notion workspace`
      );
    }
    if (error.code === 'unauthorized') {
      throw new Error(
        `Notion API key does not have access to database: ${formatNotionId(
          notionDatabaseId
        )}. ` +
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
    const createdAtProp =
      props['Created At']?.date?.start || (page as any).created_time;
    const connectionIdProp =
      props['Connection ID']?.rich_text?.[0]?.text?.content || '';

    const monthsProp = props['Months']?.rich_text?.[0]?.text?.content;
    let parsedMonths: Array<{ year: number; month: number }> | undefined;
    if (monthsProp) {
      try {
        parsedMonths = JSON.parse(monthsProp);
      } catch {
        // Ignore parse errors
      }
    }

    const isMonthly = props['Monthly']?.checkbox || false;

    // Extract target percentages from Notion properties
    const costOfSalesTarget = props['Cost of Sales Target %']?.number;
    const payrollTarget = props['Payroll Target %']?.number;
    const profitTarget = props['Profit Target %']?.number;

    const targetPercentages =
      costOfSalesTarget !== undefined ||
      payrollTarget !== undefined ||
      profitTarget !== undefined
        ? {
            ...(costOfSalesTarget !== undefined && {
              costOfSales: costOfSalesTarget,
            }),
            ...(payrollTarget !== undefined && { payroll: payrollTarget }),
            ...(profitTarget !== undefined && { profit: profitTarget }),
          }
        : undefined;

    return {
      id: page.id,
      connectionId: connectionIdProp,
      startDate: startDateProp || '',
      endDate: endDateProp || '',
      createdAt: createdAtProp || (page as any).created_time,
      updatedAt: (page as any).last_edited_time || (page as any).created_time,
      notionPageId: page.id,
      notionUrl: (page as any).url,
      months: parsedMonths,
      isMonthly,
      targetPercentages,
    };
  } catch (error) {
    console.error('Error fetching report from Notion:', error);
    return null;
  }
}
