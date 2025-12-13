'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { fetchData } from '@/lib/fetch';
import { toast } from 'sonner';
import Link from 'next/link';
import { CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';

interface QBConnection {
  id: string;
  realmId: string;
  locationName: string | null;
  expiresAt: string;
  refreshTokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasAccess: boolean;
}

const UserPage = () => {
  const [connections, setConnections] = useState<QBConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requestingIds, setRequestingIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        setIsLoading(true);
        const response = await fetchData(
          'quickbook/connections?all=true',
          setIsLoading
        );
        if (response?.success && response?.connections) {
          setConnections(response.connections);
        }
      } catch (error) {
        console.error('Failed to fetch connections:', error);
        toast.error('Failed to load connections');
      }
    };

    // Load requested connections from localStorage
    const stored = localStorage.getItem('qb_requested_connections');
    if (stored) {
      try {
        const requested = JSON.parse(stored);
        setRequestedIds(new Set(requested));
      } catch (e) {
        console.error('Failed to parse stored requests:', e);
      }
    }

    fetchConnections();
  }, []);

  const handleRequestAccess = async (connectionId: string) => {
    if (requestingIds.has(connectionId)) return;

    try {
      setRequestingIds((prev) => new Set(prev).add(connectionId));
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        }/api/quickbook/connections/${connectionId}/request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send request');
      }

      // Mark as requested and save to localStorage
      setRequestedIds((prev) => {
        const next = new Set(prev);
        next.add(connectionId);
        // Save to localStorage
        localStorage.setItem(
          'qb_requested_connections',
          JSON.stringify(Array.from(next))
        );
        return next;
      });

      toast.success(data.message || 'Access request sent successfully');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setRequestingIds((prev) => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center">
          <Loader />
          <p className="text-muted-foreground">Loading connections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Select company</h1>
        <p className="text-muted-foreground mt-2">
          Select quickbook and manage your QuickBooks connections
        </p>
      </div>

      {connections.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">No connections available</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="border rounded-lg p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-2">
                  {connection.hasAccess ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">
                    {connection.locationName || connection.realmId}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Realm ID: {connection.realmId}
                  </p>
                  {connection.hasAccess && (
                    <p className="text-xs text-green-600 mt-1">
                      Access granted
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {connection.hasAccess ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/report/${connection.id}`}
                      className="flex items-center gap-2"
                    >
                      Access
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Contact an admin to request access
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserPage;
