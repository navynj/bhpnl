import {
  getQuickBooksTokens,
  isAccessTokenExpired,
  type QuickBooksTokens,
} from './quickbooks-token';
import { getQuickBooksOAuthClient } from './quickbooks';

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

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<{
  accessToken: string;
  realmId: string;
}> {
  let tokens = await getQuickBooksTokens();

  if (!tokens) {
    throw new Error('No QuickBooks tokens found. Please authenticate first.');
  }

  // Check if access token needs refresh
  if (isAccessTokenExpired(tokens)) {
    const oauthClient = getQuickBooksOAuthClient();
    oauthClient.setRefreshToken(tokens.refresh_token);

    try {
      const authResponse = await oauthClient.refresh();
      const newTokenData = authResponse.getJson();

      // Update tokens
      const updatedTokens: QuickBooksTokens = {
        ...tokens,
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        expires_in: newTokenData.expires_in,
        expires_at: Math.floor(
          (Date.now() + newTokenData.expires_in * 1000) / 1000
        ),
      };

      // Save updated tokens
      const { saveQuickBooksTokens } = await import('./quickbooks-token');
      await saveQuickBooksTokens(updatedTokens);
      
      tokens = updatedTokens;
    } catch (error: any) {
      throw new Error(
        `Failed to refresh access token: ${error.message}. Please re-authenticate.`
      );
    }
  }

  return {
    accessToken: tokens.access_token,
    realmId: tokens.realmId,
  };
}

/**
 * Make an authenticated request to QuickBooks API
 */
export async function quickBooksApiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken, realmId } = await getValidAccessToken();
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/v3/company/${realmId}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `QuickBooks API error: ${response.status} ${response.statusText}. ${
        errorData.fault?.error?.[0]?.message || 'Unknown error'
      }`
    );
  }

  return response.json();
}

/**
 * Get Profit & Loss report
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param accountingMethod - 'Accrual' or 'Cash' (default: 'Accrual')
 */
export async function getProfitAndLossReport(
  startDate: string,
  endDate: string,
  accountingMethod: 'Accrual' | 'Cash' = 'Accrual'
) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    accounting_method: accountingMethod,
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
  }>(`/reports/ProfitAndLoss?${params.toString()}`);
}

