import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { normalizeNotionId, extractNotionDatabaseIdFromUrl } from '@/lib/notion-reports';

/**
 * GET /api/notion/test
 * Test if NOTION_API_KEY is valid and optionally test database access
 * 
 * Query parameters:
 * - databaseId (optional): Test access to a specific database
 * - databaseUrl (optional): Test access using a Notion URL
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Notion API key is valid",
 *   "bot": { ... },
 *   "database": { ... } (if databaseId provided)
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const notionToken = process.env.NOTION_API_KEY;
    
    if (!notionToken) {
      return NextResponse.json(
        { 
          success: false,
          error: 'NOTION_API_KEY environment variable is not set' 
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const databaseId = searchParams.get('databaseId');
    const databaseUrl = searchParams.get('databaseUrl');

    // Test the API key by retrieving the bot user info
    const notion = new Client({ auth: notionToken });
    
    let botInfo;
    try {
      const response = await notion.users.me({});
      botInfo = {
        id: response.id,
        type: response.type,
        name: response.name || 'Unknown',
        avatar_url: (response as any).avatar_url || null,
      };
    } catch (apiError: any) {
      // Check for specific error codes
      if (apiError.code === 'unauthorized') {
        return NextResponse.json(
          {
            success: false,
            error: 'Notion API key is invalid or unauthorized',
            details: apiError.message,
          },
          { status: 401 }
        );
      }
      
      throw apiError;
    }

    const result: any = {
      success: true,
      message: 'Notion API key is valid',
      bot: botInfo,
    };

    // Test database access if provided
    if (databaseId || databaseUrl) {
      let normalizedDatabaseId: string | null = null;
      
      if (databaseUrl) {
        normalizedDatabaseId = extractNotionDatabaseIdFromUrl(databaseUrl);
        if (!normalizedDatabaseId) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid Notion URL format',
              bot: botInfo,
            },
            { status: 400 }
          );
        }
      } else if (databaseId) {
        normalizedDatabaseId = normalizeNotionId(databaseId) || null;
      }

      if (normalizedDatabaseId) {
        try {
          const dbResponse = await notion.databases.retrieve({
            database_id: normalizedDatabaseId,
          });
          
          result.database = {
            id: dbResponse.id,
            title: (dbResponse as any).title?.[0]?.plain_text || 'Untitled',
            url: (dbResponse as any).url || null,
            accessible: true,
          };
          result.message = 'Notion API key is valid and database is accessible';
        } catch (dbError: any) {
          const errorCode = dbError.code || dbError.status;
          const errorMessage = dbError.message || 'Unknown error';
          const fullError = JSON.stringify(dbError, null, 2);
          
          console.error('Database access error:', {
            code: errorCode,
            message: errorMessage,
            fullError: dbError,
          });
          
          if (errorCode === 'object_not_found' || errorCode === 404) {
            result.database = {
              id: normalizedDatabaseId,
              accessible: false,
              error: 'Database not found',
              errorCode: errorCode,
              errorMessage: errorMessage,
              details: 'This could mean: (1) Database ID is incorrect, (2) Database was deleted, or (3) Integration needs to be connected to this specific database.',
              solution: [
                '1. Verify the database ID is correct (32-character hex string)',
                '2. Open the database in Notion and check if it exists',
                '3. Even if integration is in workspace, you need to connect it to this specific database:',
                '   - Click "..." menu → "Connections" → Add "BH P&L"',
                '4. Workspace-level connection does NOT automatically grant database access',
              ],
              rawError: fullError,
            };
          } else if (errorCode === 'unauthorized' || errorCode === 401 || errorCode === 403) {
            result.database = {
              id: normalizedDatabaseId,
              accessible: false,
              error: 'Integration does not have access to this database',
              errorCode: errorCode,
              errorMessage: errorMessage,
              details: 'Your integration needs to be explicitly connected to this database, even if it\'s already in the workspace.',
              solution: [
                '1. Open the database in Notion',
                '2. Click the "..." menu in the top right',
                '3. Select "Connections" or "연결"',
                '4. Click "Add connections" or "연결 추가"',
                '5. Search for and select "BH P&L" integration',
                '6. Workspace connection ≠ Database connection',
              ],
              rawError: fullError,
            };
          } else {
            result.database = {
              id: normalizedDatabaseId,
              accessible: false,
              error: errorMessage,
              errorCode: errorCode,
              details: 'Unexpected error occurred while accessing the database.',
              rawError: fullError,
            };
          }
        }
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error testing Notion API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test Notion API key',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

