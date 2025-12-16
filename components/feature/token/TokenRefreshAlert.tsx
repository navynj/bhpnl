'use client';

import { AlertTriangle } from 'lucide-react';
import { ConnectionStatus } from './ActionButtonsArea';

interface TokenRefreshAlertProps {
  connectionsNeedingRefresh: ConnectionStatus[];
  isChecking: boolean;
}

export function TokenRefreshAlert({
  connectionsNeedingRefresh,
  isChecking,
}: TokenRefreshAlertProps) {
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
              const statusColor =
                conn.status.refreshExpired || conn.status.accessExpired
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
