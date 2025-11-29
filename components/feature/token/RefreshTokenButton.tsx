'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../ui/Button';
import { fetchData } from '@/lib/fetch';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

const RefreshTokenButton = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [tokensNeedRefresh, setTokensNeedRefresh] = useState<boolean | null>(
    null
  );
  const [totalConnections, setTotalConnections] = useState(0);

  // Check token status on mount
  useEffect(() => {
    const checkTokenStatus = async () => {
      try {
        setIsCheckingStatus(true);
        const data = await fetchData('quickbook/admin/check-tokens');

        if (data?.success) {
          const needsRefresh =
            (data.connectionsNeedingRefresh?.length || 0) > 0;
          setTokensNeedRefresh(needsRefresh);
          setTotalConnections(data.totalConnections || 0);
        }
      } catch (error) {
        console.error('Failed to check token status:', error);
        // On error, assume we should enable the button
        setTokensNeedRefresh(null);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkTokenStatus();
  }, []);

  const refreshToken = async () => {
    // If we know tokens don't need refresh, show message immediately
    if (tokensNeedRefresh === false) {
      toast.info(
        `All tokens are valid and no refresh is needed. Tokens are only refreshed if they are expired or expiring within 5 minutes.`,
        {
          action: 'dismiss',
          duration: 6000,
        }
      );
      return;
    }

    const data = await fetchData(
      '/quickbook/admin/refresh-tokens',
      setIsLoading,
      {
        method: 'POST',
      }
    );

    if (data.success) {
      const refreshedCount = data.refreshed?.length || 0;
      const skippedCount = data.skipped?.length || 0;
      const errorCount = data.errors?.length || 0;

      // Build detailed message
      let message = '';
      if (refreshedCount > 0) {
        message = `Refreshed ${refreshedCount} connection(s)`;
        toast.success(message, {
          action: 'dismiss',
        });
      } else if (errorCount > 0) {
        message = `${errorCount} connection(s) had errors`;
        toast.error(message, {
          action: 'dismiss',
        });
      } else {
        // No tokens needed refresh
        message = `All tokens are valid and no refresh is needed`;
        toast.info(
          `${message}. Tokens are only refreshed if they are expired or expiring within 5 minutes.`,
          {
            action: 'dismiss',
            duration: 6000,
          }
        );
      }

      // Update status after refresh
      if (refreshedCount === 0 && errorCount === 0) {
        setTokensNeedRefresh(false);
      } else if (refreshedCount > 0) {
        // Re-check status after refresh
        const statusData = await fetchData('quickbook/admin/check-tokens');
        if (statusData?.success) {
          const stillNeedsRefresh =
            (statusData.connectionsNeedingRefresh?.length || 0) > 0;
          setTokensNeedRefresh(stillNeedsRefresh);
        }
      }

      // Refresh server component to show updated QBConnection data
      router.refresh();
    }
  };

  // Show status indicator
  const showValidStatus = tokensNeedRefresh === false && !isCheckingStatus;

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={refreshToken}
        disabled={isLoading || isCheckingStatus || !tokensNeedRefresh}
        isLoading={isLoading}
        title={
          tokensNeedRefresh === false
            ? 'All tokens are valid. No refresh needed.'
            : undefined
        }
      >
        Refresh Token
      </Button>
      {showValidStatus && totalConnections > 0 && (
        <div className="flex items-center gap-1 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs">
            All {totalConnections} token{totalConnections !== 1 ? 's' : ''}{' '}
            valid
          </span>
        </div>
      )}
    </div>
  );
};

export default RefreshTokenButton;
