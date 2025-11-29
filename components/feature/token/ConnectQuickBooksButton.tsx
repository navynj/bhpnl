'use client';

import { usePathname } from 'next/navigation';
import { Button } from '../../ui/Button';

const ConnectQuickBooksButton = () => {
  const pathname = usePathname();

  const handleConnect = () => {
    // Redirect to OAuth authorization page with returnTo parameter
    // The API route will handle redirecting to Intuit's authorization page
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const returnTo = encodeURIComponent(pathname || '/admin');
    window.location.href = `${baseUrl}/api/quickbook/auth?returnTo=${returnTo}`;
  };

  return (
    <Button onClick={handleConnect} variant="outline">
      Connect QuickBooks
    </Button>
  );
};

export default ConnectQuickBooksButton;
