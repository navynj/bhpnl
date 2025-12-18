'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Component to show success toast when QuickBooks OAuth succeeds
 * Checks for qb_success query parameter and shows toast
 */
const QuickBooksSuccessToast = () => {
  const router = useRouter();

  useEffect(() => {
    // Use window.location.search to avoid Suspense boundary requirement
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get('qb_success');
    const realmId = searchParams.get('realmId');

    if (success === 'true') {
      toast.success(
        `QuickBooks connected successfully!${
          realmId ? ` (Realm: ${realmId})` : ''
        }`,
        {
          action: 'dismiss',
        }
      );

      // Remove query parameters from URL without reloading
      searchParams.delete('qb_success');
      searchParams.delete('realmId');
      const newSearch = searchParams.toString();
      const newUrl =
        window.location.pathname + (newSearch ? `?${newSearch}` : '');
      router.replace(newUrl);
    }
  }, [router]);

  return null;
};

export default QuickBooksSuccessToast;



