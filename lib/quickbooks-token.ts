import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export interface QuickBooksTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  realmId: string;
  expires_at?: number; // Unix timestamp when access token expires
  refresh_token_expires_at?: number; // Unix timestamp when refresh token expires
}

const TOKEN_COOKIE_NAME = 'qb_tokens';
const REALM_ID_COOKIE_NAME = 'qb_realm_id';

/**
 * Save QuickBooks tokens to HTTP-only cookies
 * In production, consider using a database for better security and persistence
 */
export async function saveQuickBooksTokens(
  tokens: QuickBooksTokens,
  response?: NextResponse
): Promise<void> {
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  const refreshExpiresAt = tokens.refresh_token_expires_at
    ? tokens.refresh_token_expires_at * 1000
    : Date.now() + 100 * 24 * 60 * 60 * 1000; // 100 days default if not provided

  const tokensWithExpiry: QuickBooksTokens = {
    ...tokens,
    expires_at: Math.floor(expiresAt / 1000),
    refresh_token_expires_at: Math.floor(refreshExpiresAt / 1000),
  };

  // Use Next.js cookies() API for server components/route handlers
  if (typeof cookies === 'function') {
    const cookieStore = await cookies();
    cookieStore.set(TOKEN_COOKIE_NAME, JSON.stringify(tokensWithExpiry), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 100 * 24 * 60 * 60, // 100 days
      path: '/',
    });
    cookieStore.set(REALM_ID_COOKIE_NAME, tokens.realmId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 100 * 24 * 60 * 60,
      path: '/',
    });
  }

  // For response object (e.g., in route handlers)
  if (response) {
    response.cookies.set(TOKEN_COOKIE_NAME, JSON.stringify(tokensWithExpiry), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 100 * 24 * 60 * 60,
      path: '/',
    });
    response.cookies.set(REALM_ID_COOKIE_NAME, tokens.realmId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 100 * 24 * 60 * 60,
      path: '/',
    });
  }
}

/**
 * Get QuickBooks tokens from cookies
 */
export async function getQuickBooksTokens(): Promise<QuickBooksTokens | null> {
  try {
    const cookieStore = await cookies();
    const tokensCookie = cookieStore.get(TOKEN_COOKIE_NAME);

    if (!tokensCookie?.value) {
      return null;
    }

    const tokens: QuickBooksTokens = JSON.parse(tokensCookie.value);
    return tokens;
  } catch (error) {
    console.error('Error reading QuickBooks tokens from cookies:', error);
    return null;
  }
}

/**
 * Get QuickBooks realm ID from cookies
 */
export async function getQuickBooksRealmId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const realmIdCookie = cookieStore.get(REALM_ID_COOKIE_NAME);
    return realmIdCookie?.value || null;
  } catch (error) {
    console.error('Error reading QuickBooks realm ID from cookies:', error);
    return null;
  }
}

/**
 * Check if access token is expired or will expire soon (within 5 minutes)
 */
export function isAccessTokenExpired(tokens: QuickBooksTokens): boolean {
  if (!tokens.expires_at) {
    return true; // If no expiry info, assume expired
  }

  const now = Math.floor(Date.now() / 1000);
  const buffer = 5 * 60; // 5 minutes buffer
  return tokens.expires_at <= now + buffer;
}

/**
 * Clear QuickBooks tokens from cookies
 */
export async function clearQuickBooksTokens(
  response?: NextResponse
): Promise<void> {
  if (typeof cookies === 'function') {
    const cookieStore = await cookies();
    cookieStore.delete(TOKEN_COOKIE_NAME);
    cookieStore.delete(REALM_ID_COOKIE_NAME);
  }

  if (response) {
    response.cookies.delete(TOKEN_COOKIE_NAME);
    response.cookies.delete(REALM_ID_COOKIE_NAME);
  }
}
