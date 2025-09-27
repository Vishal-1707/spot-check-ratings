import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export const Header = () => {
  const { user, userRole, signOut } = useAuth();

  const getRoleDisplayName = (role: string | null) => {
    switch (role) {
      case 'system_administrator':
        return 'System Administrator';
      case 'store_owner':
        return 'Store Owner';
      case 'normal_user':
        return 'User';
      default:
        return 'Loading...';
    }
  };

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Store Rating Platform</h1>
          {userRole && (
            <p className="text-sm text-muted-foreground">
              Welcome, {getRoleDisplayName(userRole)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button onClick={signOut} variant="outline" size="sm">
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};