import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX, LogOut } from 'lucide-react';
import logo from '@/assets/logo.png';

const AccessRestricted = () => {
  const { user, role, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in text-center">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center">
            <img src={logo} alt="VeneExpress Shipping" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold font-heading">VeneExpress Shipping</h1>
          <div className="flex justify-center">
            <div className="p-3 bg-muted rounded-full">
              <ShieldX className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-xl font-semibold font-heading">Access Restricted</h2>
          <CardDescription className="text-base">
            Your account is approved, but it does not have operational access to this workspace.
            Contact an administrator if you should be able to manage shipments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Signed in as <span className="font-medium text-foreground">{user?.email}</span>
            </p>
            <p>
              Role: <span className="font-medium text-foreground capitalize">{role ?? 'unknown'}</span>
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessRestricted;
