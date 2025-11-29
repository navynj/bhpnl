import { Header } from '@/components/layout/Header';
import { RoleRedirect } from '@/components/layout/RoleRedirect';
import { getCurrentUser } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';
import React from 'react';

const HomeLayout = async ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth');
  }

  return (
    <>
      <RoleRedirect userRole={user.role} />
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <Header />
        {children}
      </div>
    </>
  );
};

export default HomeLayout;
