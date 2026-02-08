import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LogOut, Anchor } from 'lucide-react';

const PendingApproval = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in text-center">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <div className="p-2 bg-accent/10 rounded-xl">
              <Anchor className="h-8 w-8 text-accent" />
            </div>
          </div>
          <h1 className="text-2xl font-bold font-heading">Angel Shipping</h1>
          <div className="flex justify-center">
            <div className="p-3 bg-warning/10 rounded-full">
              <ShieldAlert className="h-10 w-10 text-warning" />
            </div>
          </div>
          <h2 className="text-xl font-semibold font-heading">Account Pending Approval</h2>
          <CardDescription className="text-base">
            Your account has been created but requires admin approval before you can access the system.
            Please contact your administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user?.email}</span>
          </p>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
