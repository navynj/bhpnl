'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fetchData } from '@/lib/fetch';
import { toast } from 'sonner';

interface ConnectionStatus {
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

export function TokenRefreshAlert() {
  const [connectionsNeedingRefresh, setConnectionsNeedingRefresh] = useState<
    ConnectionStatus[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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

  const handleSendEmail = async () => {
    try {
      setIsSendingEmail(true);
      const data = await fetchData(
        'quickbook/admin/check-tokens?sendEmail=true',
        setIsSendingEmail
      );

      if (data?.success) {
        if (data.emailSent) {
          toast.success('Email alert sent to admin(s) successfully');
        } else {
          toast.warning(
            'Email alert attempted but may not have been sent. Check email configuration.'
          );
        }
      }
    } catch (error) {
      console.error('Failed to send email alert:', error);
      toast.error('Failed to send email alert');
    }
  };

  if (isChecking) {
    return null; // Don't show anything while checking
  }

  if (connectionsNeedingRefresh.length === 0) {
    return null; // No alerts needed
  }

  const expiredCount = connectionsNeedingRefresh.filter(
    (c) => c.status.accessExpired || c.status.refreshExpired
  ).length;
  const expiringSoonCount = connectionsNeedingRefresh.filter(
    (c) => c.status.accessExpiresSoon && !c.status.accessExpired
  ).length;

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-orange-900 mb-1">
              Token Refresh Required
            </h3>
            <p className="text-sm text-orange-800 mb-2">
              {expiredCount > 0 && (
                <span className="font-semibold text-red-600">
                  {expiredCount} connection(s) have expired tokens.{' '}
                </span>
              )}
              {expiringSoonCount > 0 && (
                <span>
                  {expiringSoonCount} connection(s) will expire within 5
                  minutes.{' '}
                </span>
              )}
              Total: {connectionsNeedingRefresh.length} connection(s) need
              attention.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                isLoading={isSendingEmail}
              >
                <Mail className="h-4 w-4" />
                <span className="ml-2">Send Email Alert</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Connection details */}
      <div className="mt-4 space-y-2">
        <details className="text-sm">
          <summary className="cursor-pointer text-orange-800 font-medium hover:text-orange-900">
            View connection details ({connectionsNeedingRefresh.length})
          </summary>
          <div className="mt-2 space-y-1 pl-4">
            {connectionsNeedingRefresh.map((conn) => {
              const location = conn.locationName || conn.realmId;
              const statusText = conn.status.refreshExpired
                ? 'Refresh Token Expired'
                : conn.status.accessExpired
                ? 'Access Token Expired'
                : 'Expires Soon';
              const statusColor = conn.status.refreshExpired || conn.status.accessExpired
                ? 'text-red-600'
                : 'text-orange-600';

              return (
                <div
                  key={conn.id}
                  className="flex items-center justify-between py-1 border-b border-orange-200 last:border-0"
                >
                  <span className="text-orange-800">{location}</span>
                  <span className={`font-medium ${statusColor}`}>
                    {statusText}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}

