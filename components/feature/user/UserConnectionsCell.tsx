'use client';

import { useState, useEffect } from 'react';
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

  // Optimistic state for user connections (just track IDs)
  const [userConnectionIds, setUserConnectionIds] = useState<Set<string>>(
    () => new Set(user.userConnections?.map((uc) => uc.qbConnectionId) || [])
  );

  // Sync optimistic state when user prop changes
  useEffect(() => {
    setUserConnectionIds(
      new Set(user.userConnections?.map((uc) => uc.qbConnectionId) || [])
    );
  }, [user.userConnections]);

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
    setUserConnectionIds((prev) => {
      const next = new Set(prev);
      if (grant) {
        next.add(connectionId);
      } else {
        next.delete(connectionId);
      }
      return next;
    });

    try {
      setIsLoading(true);
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

      toast.success(
        grant
          ? 'Connection granted successfully'
          : 'Connection revoked successfully'
      );
      // Refresh the page to update the data
      router.refresh();
      setIsLoading(false);
      onUpdate?.();
    } catch (error) {
      // Revert optimistic update on error
      setUserConnectionIds(previousConnectionIds);
      const message =
        error instanceof Error ? error.message : 'Something went wrong';
      toast.error(message);
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
            return (
              <DropdownMenuCheckboxItem
                key={connection.id}
                checked={isGranted}
                onCheckedChange={(checked) => {
                  handleToggleConnection(connection.id, checked as boolean);
                }}
                disabled={isLoading}
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
