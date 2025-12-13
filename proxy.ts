import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exclude API routes, static files, and NextAuth routes
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/vercel.svg')
  ) {
    return NextResponse.next();
  }

  // Use NextAuth's auth() function to check session
  // This works properly with NextAuth v5 and handles all cookie variations
  const session = await auth();

  // If no session, redirect to auth page (unless already on auth page or public pages)
  if (!session) {
    const publicPages = ['/auth', '/eula', '/privacy'];
    if (!publicPages.includes(pathname)) {
      const redirectUrl = new URL('/auth', request.url);
      redirectUrl.searchParams.set(
        'callbackUrl',
        pathname + request.nextUrl.search
      );
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  // If session exists, allow the request through
  // Role-based redirects will be handled in layout/page components where auth() works
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

