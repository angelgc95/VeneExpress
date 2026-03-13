import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PendingApproval from '@/pages/PendingApproval';
import AccessRestricted from '@/pages/AccessRestricted';

const ProtectedRoute = ({
  children,
  requireStaff = false,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireStaff?: boolean;
  requireAdmin?: boolean;
}) => {
  const { user, loading, approved, isAdmin, isStaff } = useAuth();

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

  if (requireAdmin && !isAdmin) {
    return isStaff ? <Navigate to="/dashboard" replace /> : <AccessRestricted />;
  }

  if (requireStaff && !isStaff) {
    return <AccessRestricted />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
