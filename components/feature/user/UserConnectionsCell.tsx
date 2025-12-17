'use client';

import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/DropdownMenu';
import { User } from '@prisma/client';
import { toast } from 'sonner';
import { Settings2, CheckCircle2, XCircle } from 'lucide-react';
import { fetchData } from '@/lib/fetch';

interface QBConnection {
  id: string;
  locationName: string | null;
  realmId: string;
  expiresAt: Date | string;
  refreshTokenExpiresAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface UserWithConnections extends User {
  userConnections: Array<{
    id: string;
    qbConnectionId: string;
    qbConnection: QBConnection;
  }>;
}

interface UserConnectionsCellProps {
  user: UserWithConnections;
  onUpdate?: () => void;
}

export function UserConnectionsCell({
  user,
  onUpdate,
}: UserConnectionsCellProps) {
  const router = useRouter();
  const [availableConnections, setAvailableConnections] = useState<
    QBConnection[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingConnections, setIsFetchingConnections] = useState(false);
  // Track loading state for individual connections
  const [loadingConnectionIds, setLoadingConnectionIds] = useState<Set<string>>(
    new Set()
  );

  // Optimistic state for user connections (just track IDs)
  const initialConnectionIds = new Set(
    user.userConnections?.map((uc) => uc.qbConnectionId) || []
  );
  const [userConnectionIds, setUserConnectionIds] = useState<Set<string>>(
    initialConnectionIds
  );
  
  // Track if we have pending optimistic updates to prevent overwriting
  const [hasPendingUpdates, setHasPendingUpdates] = useState(false);
  
  // Use ref to track the last synced server state to avoid unnecessary updates
  const lastSyncedServerIdsRef = useRef<string>(
    Array.from(initialConnectionIds).sort().join(',')
  );
  // Use ref to track current optimistic state to avoid dependency issues
  const currentConnectionIdsRef = useRef<Set<string>>(initialConnectionIds);

  // Sync optimistic state when user prop changes, but only if there are no pending updates
  useEffect(() => {
    // Only sync from server data if we don't have pending optimistic updates
    if (!hasPendingUpdates && loadingConnectionIds.size === 0) {
      const serverConnectionIds = new Set(
        user.userConnections?.map((uc) => uc.qbConnectionId) || []
      );
      const serverIds = Array.from(serverConnectionIds).sort().join(',');
      const currentIds = Array.from(currentConnectionIdsRef.current).sort().join(',');
      
      // Only update if:
      // 1. Server data is different from what we last synced
      // 2. Current state doesn't match server data (meaning we need to sync)
      // This prevents overwriting optimistic updates that match the server state
      if (serverIds !== lastSyncedServerIdsRef.current && serverIds !== currentIds) {
        flushSync(() => {
          setUserConnectionIds(serverConnectionIds);
          currentConnectionIdsRef.current = serverConnectionIds;
        });
        lastSyncedServerIdsRef.current = serverIds;
      } else if (serverIds === currentIds && serverIds !== lastSyncedServerIdsRef.current) {
        // If current state matches server data but ref doesn't, just update the ref
        // This means our optimistic update was correct and server confirmed it
        lastSyncedServerIdsRef.current = serverIds;
      }
    }
  }, [user.userConnections, hasPendingUpdates, loadingConnectionIds.size]);

  // Fetch available connections (created by current admin)
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        setIsFetchingConnections(true);
        // Get all connections - filter to only show ones created by current admin
        const response = await fetchData(
          'quickbook/admin/refresh-tokens',
          setIsFetchingConnections
        );
        if (response?.success && response?.connections) {
          // Get current admin ID from the first connection's admin field
          // or filter connections that have createdBy matching the admin
          // For now, show all connections - backend will handle authorization
          setAvailableConnections(response.connections);
        }
      } catch (error) {
        console.error('Failed to fetch connections:', error);
        toast.error('Failed to load connections');
      }
    };

    fetchConnections();
  }, []);

  const handleToggleConnection = async (
    connectionId: string,
    grant: boolean
  ) => {
    // Optimistic update: update UI immediately
    const previousConnectionIds = new Set(userConnectionIds);
    
    // Calculate new state immediately
    const nextConnectionIds = new Set(userConnectionIds);
    if (grant) {
      nextConnectionIds.add(connectionId);
    } else {
      nextConnectionIds.delete(connectionId);
    }
    
    // Update state synchronously for immediate UI feedback
    flushSync(() => {
      setUserConnectionIds(nextConnectionIds);
      currentConnectionIdsRef.current = nextConnectionIds;
    });
    // Update ref immediately to reflect optimistic state
    lastSyncedServerIdsRef.current = Array.from(nextConnectionIds).sort().join(',');

    // Mark that we have pending optimistic updates
    setHasPendingUpdates(true);
    
    // Set loading state for this specific connection
    setLoadingConnectionIds((prev) => new Set(prev).add(connectionId));
    setIsLoading(true);

    try {
      const url = `/api/quickbook/connections/${connectionId}/grant`;
      const method = grant ? 'POST' : 'DELETE';

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${url}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userIds: [user.id] }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update connection');
      }

      if (data?.granted?.length <= 0 && data?.revoked?.length <= 0) {
        throw new Error('Failed to update connection');
      }

      // Optimistic update succeeded, keep the UI state
      toast.success(
        grant
          ? 'Connection granted successfully'
          : 'Connection revoked successfully'
      );
      
      // Ref is already updated in the optimistic update above (line 137)
      // The ref now matches our optimistic state, so when router.refresh() runs
      // and server data comes back, useEffect will see that current state matches
      // server state and won't overwrite it
    } catch (error) {
      // Revert optimistic update on error
      flushSync(() => {
        setUserConnectionIds(previousConnectionIds);
        currentConnectionIdsRef.current = previousConnectionIds;
      });
      // Also revert the ref
      lastSyncedServerIdsRef.current = Array.from(previousConnectionIds).sort().join(',');
      const message =
        error instanceof Error ? error.message : 'Something went wrong';
      toast.error(message);
    } finally {
      // Clear loading state for this connection
      setLoadingConnectionIds((prev) => {
        const next = new Set(prev);
        next.delete(connectionId);
        const hasMoreLoading = next.size > 0;
        
        // If no more connections are loading, we can safely refresh
        if (!hasMoreLoading) {
          // Use flushSync to ensure state update happens before router.refresh()
          flushSync(() => {
            setHasPendingUpdates(false);
          });
          // Refresh data after a short delay to sync with server
          // The delay allows the optimistic state to be visible first
          setTimeout(() => {
            onUpdate?.();
            router.refresh();
          }, 100);
        }
        
        return next;
      });
      setIsLoading(false);
    }
  };

  // Use optimistic state for display
  const hasConnections = userConnectionIds.size > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isFetchingConnections}
          isLoading={isLoading}
        >
          <Settings2 className="h-4 w-4" />
          <span className="ml-2">
            {hasConnections
              ? `${userConnectionIds.size} connection${
                  userConnectionIds.size !== 1 ? 's' : ''
                }`
              : 'No connections'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>QuickBooks Connections</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableConnections.length === 0 ? (
          <DropdownMenuItem disabled>No connections available</DropdownMenuItem>
        ) : (
          availableConnections.map((connection) => {
            const isGranted = userConnectionIds.has(connection.id);
            const isConnectionLoading = loadingConnectionIds.has(connection.id);
            return (
              <DropdownMenuCheckboxItem
                key={connection.id}
                checked={isGranted}
                onCheckedChange={(checked) => {
                  // Prevent default behavior and handle immediately
                  handleToggleConnection(connection.id, checked as boolean);
                }}
                disabled={isConnectionLoading || isLoading}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="flex-1 truncate">
                    {connection.locationName || connection.realmId}
                  </span>
                  {isGranted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-2" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400 ml-2" />
                  )}
                </div>
              </DropdownMenuCheckboxItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
