import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Shield, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { AppRole } from '@/types/shipping';

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  approved: boolean;
  created_at: string;
}

interface RoleRow {
  user_id: string;
  role: AppRole;
  id: string;
}

const UserApprovals = () => {
  const queryClient = useQueryClient();
  const { isAdmin, user: currentUser } = useAuth();

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('user_id, full_name, approved, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProfileRow[];
    },
    enabled: isAdmin,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_roles')
        .select('user_id, role, id');
      if (error) throw error;
      return data as RoleRow[];
    },
    enabled: isAdmin,
  });

  const users = profiles.map((p) => ({
    ...p,
    role: roles.find((r) => r.user_id === p.user_id)?.role || null,
    roleId: roles.find((r) => r.user_id === p.user_id)?.id || null,
  }));

  const pendingCount = users.filter((u) => !u.approved).length;

  const approveMutation = useMutation({
    mutationFn: async ({ userId, approve }: { userId: string; approve: boolean }) => {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ approved: approve })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      toast.success(approve ? 'User approved' : 'User access revoked');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const existingRole = roles.find((r) => r.user_id === userId);
      if (existingRole) {
        const { error } = await (supabase as any)
          .from('user_roles')
          .update({ role: newRole })
          .eq('id', existingRole.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      toast.success('Role updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // UI-only check for better UX — actual security is enforced by RLS policies on the database
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">User Approvals</h1>
          <p className="text-muted-foreground text-sm">
            {pendingCount > 0
              ? `${pendingCount} pending approval${pendingCount > 1 ? 's' : ''}`
              : 'All users approved'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Users</CardTitle>
          <CardDescription>Approve new accounts and manage roles</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingProfiles ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-accent border-t-transparent rounded-full" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No users found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-48">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.user_id === currentUser?.id;
                  return (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">
                        {u.full_name || 'Unknown'}
                        {isSelf && (
                          <span className="text-xs text-muted-foreground ml-2">(you)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.role || 'staff'}
                          onValueChange={(val) =>
                            changeRoleMutation.mutate({ userId: u.user_id, newRole: val as AppRole })
                          }
                          disabled={isSelf}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="readonly">Read-only</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.approved ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(u.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {!isSelf && (
                          <Button
                            size="sm"
                            variant={u.approved ? 'outline' : 'default'}
                            onClick={() =>
                              approveMutation.mutate({
                                userId: u.user_id,
                                approve: !u.approved,
                              })
                            }
                            disabled={approveMutation.isPending}
                          >
                            {u.approved ? 'Revoke' : 'Approve'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserApprovals;
