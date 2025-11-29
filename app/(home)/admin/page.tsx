import RefreshTokenButton from '@/components/feature/token/RefreshTokenButton';
import ConnectQuickBooksButton from '@/components/feature/token/ConnectQuickBooksButton';
import QuickBooksSuccessToast from '@/components/feature/token/QuickBooksSuccessToast';
import { TokenRefreshAlert } from '@/components/feature/token/TokenRefreshAlert';
import { userColumns } from '@/components/feature/user/userColumns';
import { DataTable } from '@/components/ui/DataTable';
import { requireAdmin } from '@/lib/auth-helpers';
import { prisma } from '@/prisma/client';

const AdminPage = async () => {
  // Ensure user is admin
  await requireAdmin();

  // Fetch users directly from database
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      createdConnections: true,
      userConnections: {
        include: {
          qbConnection: true,
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <QuickBooksSuccessToast />
      <TokenRefreshAlert />
      <div className="flex gap-2">
        <ConnectQuickBooksButton />
        <RefreshTokenButton />
      </div>
      <DataTable columns={userColumns} data={users} />
    </div>
  );
};

export default AdminPage;
