import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/components/auth/AuthPage';
import { Header } from '@/components/layout/Header';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { UserDashboard } from '@/components/user/UserDashboard';
import { StoreOwnerDashboard } from '@/components/store/StoreOwnerDashboard';

const Index = () => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderDashboard = () => {
    switch (userRole) {
      case 'system_administrator':
        return <AdminDashboard />;
      case 'normal_user':
        return <UserDashboard />;
      case 'store_owner':
        return <StoreOwnerDashboard />;
      default:
        return (
          <div className="container mx-auto p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Role Assignment Pending</h2>
              <p className="text-muted-foreground">
                Your account role is being processed. Please contact an administrator.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {renderDashboard()}
    </div>
  );
};

export default Index;
