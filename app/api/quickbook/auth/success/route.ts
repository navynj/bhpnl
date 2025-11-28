import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksTokens } from '@/lib/quickbooks-token';

/**
 * GET /api/quickbook/auth/success
 * Success page after OAuth callback - shows that tokens were saved
 */
export async function GET(request: NextRequest) {
  const tokens = await getQuickBooksTokens();

  if (!tokens) {
    return NextResponse.json(
      { error: 'Tokens not found. Authentication may have failed.' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'QuickBooks authentication successful! Tokens have been saved.',
    realmId: tokens.realmId,
    // Don't expose tokens in response for security
  });
}

