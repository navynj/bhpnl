'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { DataTableColumnHeader } from '@/components/ui/DataTableColumnHeader';
import { User } from '@prisma/client';
import { createColumnHelper } from '@tanstack/react-table';
import { UserConnectionsCell } from './UserConnectionsCell';

type UserWithConnections = User & {
  userConnections: Array<{
    id: string;
    qbConnectionId: string;
    qbConnection: {
      id: string;
      locationName: string | null;
      realmId: string;
      expiresAt: Date;
      refreshTokenExpiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }>;
};

const c = createColumnHelper<UserWithConnections>();

export const userColumns = [
  c.accessor('image', {
    header: () => null,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const user = row.original;
      return (
        <Avatar className="h-8 w-8">
          {user.image && (
            <AvatarImage src={user.image} alt={user.name || 'No Image'} />
          )}
          <AvatarFallback>
            {user.name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) ||
              user.email?.[0]?.toUpperCase() ||
              'U'}
          </AvatarFallback>
        </Avatar>
      );
    },
  }),
  c.accessor('email', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
  }),
  c.accessor('name', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  }),
  c.display({
    id: 'connections',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="QuickBooks Connections" />
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const user = row.original;
      return <UserConnectionsCell user={user} />;
    },
  }),
];
