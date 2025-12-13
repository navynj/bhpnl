'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RoleRedirectProps {
  userRole: string;
}

export function RoleRedirect({ userRole }: RoleRedirectProps) {
  const pathname = usePathname();
  const router = useRouter();

  console.log({ userRole });

  useEffect(() => {
    // Admin users should be redirected to /admin from / or /auth
    if (userRole === 'admin') {
      if (pathname === '/' || pathname === '/auth') {
        router.replace('/admin');
      }
    }

    // Regular users should be redirected to / from /admin or /auth
    if (userRole === 'user') {
      if (pathname === '/admin' || pathname === '/auth' || pathname === '/') {
        router.replace('/report');
      }
    }
  }, [userRole, pathname, router]);

  return null;
}
