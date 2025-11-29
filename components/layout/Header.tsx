import { auth } from '@/lib/auth';
import { UserMenu } from '@/components/feature/user/UserMenu';

export async function Header() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-24 lg:h-32 items-center justify-between">
        <h1 className="text-3xl font-extrabold">BH P&L</h1>
        <UserMenu
          user={{
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
          }}
        />
      </div>
    </header>
  );
}
