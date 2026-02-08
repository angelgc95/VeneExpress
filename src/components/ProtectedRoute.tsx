import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PendingApproval from '@/pages/PendingApproval';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, approved } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!approved) {
    return <PendingApproval />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
