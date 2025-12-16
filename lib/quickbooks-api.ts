/**
 * QuickBooks API Client
 * 
 * This module handles authenticated API requests to QuickBooks.
 * It automatically manages token refresh and provides helper functions for common API operations.
 * 
 * Structure:
 * - Token Management: getValidAccessToken() - handles token refresh automatically
 * - API Requests: quickBooksApiRequest() - makes authenticated API calls
 * - Report Helpers: getProfitAndLossReport() - convenience functions for common reports
 */

import {
  getQuickBooksConnectionById,
  getUserQuickBooksConnections,
  isAccessTokenExpired,
  isRefreshTokenExpired,
  updateQuickBooksTokens,
  type QBConnectionData,
} from './quickbooks-token';
import { getQuickBooksOAuthClient } from './quickbooks-oauth';

// ============================================================================
// Configuration
// ============================================================================

const QUICKBOOKS_API_BASE_URL = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
};

/**
 * Get the QuickBooks API base URL based on environment
 */
function getApiBaseUrl(): string {
  const environment =
    (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
  return QUICKBOOKS_API_BASE_URL[environment];
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Get a valid access token for a specific connection, refreshing if necessary
 * 
 * This function:
 * 1. Retrieves the connection from the database
 * 2. Checks if the refresh token is expired (throws error if so)
 * 3. Checks if the access token needs refresh
 * 4. Automatically refreshes the access token if needed
 * 5. Updates the database with new tokens
 * 
 * @param userId - The user ID
 * @param connectionId - The connection ID (optional, uses first connection if not provided)
 * @returns Object containing accessToken, realmId, and connectionId
 * @throws Error if connection not found, refresh token expired, or refresh fails
 */
export async function getValidAccessToken(
  userId: string,
  connectionId?: string
): Promise<{
  accessToken: string;
  realmId: string;
  connectionId: string;
}> {
  let connection: QBConnectionData | null;

  if (connectionId) {
    connection = await getQuickBooksConnectionById(userId, connectionId);
  } else {
    // Get first available connection
    const connections = await getUserQuickBooksConnections(userId);
    if (connections.length === 0) {
      throw new Error('No QuickBooks connections found. Please authenticate first.');
    }
    connection = connections[0];
  }

  if (!connection) {
    throw new Error('QuickBooks connection not found or access denied.');
  }

  // Check if refresh token is expired
  if (isRefreshTokenExpired(connection)) {
    throw new Error(
      'Refresh token is expired. Please re-authenticate your QuickBooks connection.'
    );
  }

  // Check if access token needs refresh
  if (isAccessTokenExpired(connection)) {
    const oauthClient = getQuickBooksOAuthClient();

    try {
      const authResponse = await oauthClient.refreshUsingToken(connection.refreshToken);
      const newTokenData = authResponse.getJson();

      // Calculate new expiration dates
      const expiresAt = new Date(
        Date.now() + (newTokenData.expires_in || 3600) * 1000
      );
      const refreshExpiresAt = newTokenData.x_refresh_token_expires_in
        ? new Date(Date.now() + newTokenData.x_refresh_token_expires_in * 1000)
        : connection.refreshTokenExpiresAt;

      // Update tokens in database
      connection = await updateQuickBooksTokens(connection.id, {
        accessToken: newTokenData.access_token,
        refreshToken: newTokenData.refresh_token,
        expiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
      });
    } catch (error: any) {
      throw new Error(
        `Failed to refresh access token: ${error.message}. Please re-authenticate.`
      );
    }
  }

  return {
    accessToken: connection.accessToken,
    realmId: connection.realmId,
    connectionId: connection.id,
  };
}

// ============================================================================
// API Request Functions
// ============================================================================

/**
 * Refresh a connection's tokens (for use when API returns 401)
 * 
 * @param userId - The user ID
 * @param connectionId - The connection ID
 * @returns Updated connection with new tokens
 * @throws Error if refresh fails
 */
async function refreshConnectionToken(
  userId: string,
  connectionId: string
): Promise<QBConnectionData> {
  const connection = await getQuickBooksConnectionById(userId, connectionId);
  
  if (!connection) {
    throw new Error('QuickBooks connection not found or access denied.');
  }

  // Check if refresh token is expired
  if (isRefreshTokenExpired(connection)) {
    throw new Error(
      'Refresh token is expired. Please re-authenticate your QuickBooks connection.'
    );
  }

  const oauthClient = getQuickBooksOAuthClient();

  try {
    const authResponse = await oauthClient.refreshUsingToken(connection.refreshToken);
    const newTokenData = authResponse.getJson();

    // Calculate new expiration dates
    const expiresAt = new Date(
      Date.now() + (newTokenData.expires_in || 3600) * 1000
    );
    const refreshExpiresAt = newTokenData.x_refresh_token_expires_in
      ? new Date(Date.now() + newTokenData.x_refresh_token_expires_in * 1000)
      : connection.refreshTokenExpiresAt;

    // Update tokens in database
    const updatedConnection = await updateQuickBooksTokens(connection.id, {
      accessToken: newTokenData.access_token,
      refreshToken: newTokenData.refresh_token,
      expiresAt,
      refreshTokenExpiresAt: refreshExpiresAt,
    });

    return updatedConnection;
  } catch (error: any) {
    throw new Error(
      `Failed to refresh access token: ${error.message}. Please re-authenticate.`
    );
  }
}

/**
 * Make an authenticated request to QuickBooks API
 * 
 * This function:
 * 1. Gets a valid access token (refreshes if needed)
 * 2. Constructs the full API URL with realmId
 * 3. Makes the authenticated request
 * 4. If 401 error occurs, automatically refreshes token and retries once
 * 5. Handles errors and returns parsed JSON
 * 
 * @param userId - The user ID
 * @param endpoint - The API endpoint (e.g., '/reports/ProfitAndLoss')
 * @param connectionId - Optional connection ID (uses first connection if not provided)
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Parsed JSON response from QuickBooks API
 * @throws Error if API request fails
 */
export async function quickBooksApiRequest<T = any>(
  userId: string,
  endpoint: string,
  connectionId?: string,
  options: RequestInit = {}
): Promise<T> {
  let { accessToken, realmId, connectionId: resolvedConnectionId } = await getValidAccessToken(userId, connectionId);
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/v3/company/${realmId}${endpoint}`;

  const makeRequest = async (token: string): Promise<Response> => {
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  };

  // Helper function to extract intuit_tid from response headers
  const getIntuitTid = (response: Response): string | undefined => {
    return response.headers.get('intuit_tid') || response.headers.get('intuit-tid') || undefined;
  };

  // First attempt
  let response = await makeRequest(accessToken);
  let hasRetried = false;
  let intuitTid: string | undefined = getIntuitTid(response);

  // If 401 Unauthorized, try refreshing token and retry once (only once to prevent infinite loop)
  if (response.status === 401 && !hasRetried) {
    hasRetried = true; // Mark as retried to prevent infinite loop
    
    try {
      // Refresh the token
      const updatedConnection = await refreshConnectionToken(userId, resolvedConnectionId);
      
      // Retry with new token (only once)
      response = await makeRequest(updatedConnection.accessToken);
      intuitTid = getIntuitTid(response); // Update intuit_tid from retry response
      
      // If retry also returns 401, throw error immediately (don't retry again)
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = `QuickBooks API error: 401 Unauthorized after token refresh. ${
          errorData.fault?.error?.[0]?.message || 'Token may be invalid or expired. Please re-authenticate.'
        }`;
        
        // Log error with intuit_tid for troubleshooting
        console.error('QuickBooks API error:', {
          status: 401,
          endpoint,
          realmId,
          intuit_tid: intuitTid,
          error: errorMessage,
        });
        
        throw new Error(intuitTid ? `${errorMessage} [intuit_tid: ${intuitTid}]` : errorMessage);
      }
    } catch (refreshError: any) {
      // If refresh fails, throw the original 401 error with refresh error details
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = `QuickBooks API error: 401 Unauthorized. Token refresh failed: ${refreshError.message}. ${
        errorData.fault?.error?.[0]?.message || 'Please re-authenticate.'
      }`;
      
      // Log error with intuit_tid for troubleshooting
      console.error('QuickBooks API error:', {
        status: 401,
        endpoint,
        realmId,
        intuit_tid: intuitTid,
        error: errorMessage,
        refreshError: refreshError.message,
      });
      
      throw new Error(intuitTid ? `${errorMessage} [intuit_tid: ${intuitTid}]` : errorMessage);
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = `QuickBooks API error: ${response.status} ${response.statusText}. ${
      errorData.fault?.error?.[0]?.message || 'Unknown error'
    }`;
    
    // Log error with intuit_tid for troubleshooting
    console.error('QuickBooks API error:', {
      status: response.status,
      statusText: response.statusText,
      endpoint,
      realmId,
      intuit_tid: intuitTid,
      error: errorMessage,
    });
    
    throw new Error(intuitTid ? `${errorMessage} [intuit_tid: ${intuitTid}]` : errorMessage);
  }

  return response.json();
}

// ============================================================================
// Report Helper Functions
// ============================================================================

/**
 * Get Profit & Loss report from QuickBooks
 * 
 * @param userId - The user ID
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param accountingMethod - 'Accrual' or 'Cash' (default: 'Accrual')
 * @param connectionId - Optional connection ID (uses first connection if not provided)
 * @returns Profit & Loss report data with Header, Columns, and Rows
 */
export async function getProfitAndLossReport(
  userId: string,
  startDate: string,
  endDate: string,
  accountingMethod: 'Accrual' | 'Cash' = 'Accrual',
  connectionId?: string
) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    accounting_method: accountingMethod,
    // Request more detailed data
    minorversion: '65', // Use a recent API version
  });

  return quickBooksApiRequest<{
    Header: {
      Time: string;
      ReportName: string;
      ReportBasis: string;
      StartPeriod: string;
      EndPeriod: string;
      Currency: string;
      Option: Array<{ Name: string; Value: string }>;
    };
    Columns: {
      Column: Array<{
        ColTitle: string;
        ColType: string;
        MetaData: Array<{ Name: string; Value: string }>;
      }>;
    };
    Rows: {
      Row: Array<{
        group?: string;
        ColData: Array<{ value: string; id?: string }>;
        Rows?: {
          Row: Array<{
            group?: string;
            ColData: Array<{ value: string; id?: string }>;
          }>;
        };
      }>;
    };
  }>(userId, `/reports/ProfitAndLoss?${params.toString()}`, connectionId);
}

