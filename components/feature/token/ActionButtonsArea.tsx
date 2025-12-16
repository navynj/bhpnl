'use client';

import { useEffect, useState } from 'react';
import ConnectQuickBooksButton from './ConnectQuickBooksButton';
import RefreshTokenButton from './RefreshTokenButton';
import { TokenRefreshAlert } from './TokenRefreshAlert';
import { fetchData } from '@/lib/fetch';

export interface ConnectionStatus {
  id: string;
  locationName: string | null;
  realmId: string;
  expiresAt: string;
  refreshTokenExpiresAt: string | null;
  status: {
    accessExpired: boolean;
    refreshExpired: boolean;
    accessExpiresSoon: boolean;
    needsRefresh: boolean;
  };
  admin?: {
    id: string;
    name: string | null;
    email: string | null;
  };
}
const ActionButtonsArea = () => {
  const [isTokensNeedRefresh, setIsTokensNeedRefresh] = useState<
    boolean | null
  >(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [totalConnections, setTotalConnections] = useState(0);
  const [connectionsNeedingRefresh, setConnectionsNeedingRefresh] = useState<
    ConnectionStatus[]
  >([]);

  // Check token status on mount and periodically
  useEffect(() => {
    const checkTokens = async () => {
      try {
        setIsChecking(true);
        const data = await fetchData(
          'quickbook/admin/check-tokens',
          setIsChecking
        );

        if (data?.success) {
          const needsRefresh =
            (data.connectionsNeedingRefresh?.length || 0) > 0;
          setIsTokensNeedRefresh(needsRefresh);
          setTotalConnections(data.totalConnections || 0);
          setConnectionsNeedingRefresh(data.connectionsNeedingRefresh || []);
        }
      } catch (error) {
        console.error('Failed to check token status:', error);
      }
    };

    checkTokens();

    // Check every 5 minutes
    const interval = setInterval(checkTokens, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <TokenRefreshAlert
        connectionsNeedingRefresh={connectionsNeedingRefresh}
        isChecking={isChecking}
      />
      <div className="flex gap-2">
        <ConnectQuickBooksButton />
        <RefreshTokenButton
          isTokensNeedRefresh={isTokensNeedRefresh ?? false}
          setIsTokensNeedRefresh={setIsTokensNeedRefresh}
          totalConnections={totalConnections}
          isChecking={isChecking}
        />
      </div>
    </>
  );
};

export default ActionButtonsArea;
