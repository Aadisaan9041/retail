import { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, Users, Loader2, Shield, Briefcase, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AppRole } from '@/types/retail';

interface UserManagementProps {
  onBack: () => void;
}

interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  created_at: string;
}

export function UserManagement({ onBack }: UserManagementProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'cashier' as 'manager' | 'cashier',
  });

  const fetchStaffUsers = async () => {
    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at')
        .in('role', ['admin', 'manager', 'cashier']);

      if (error) throw error;

      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const users: StaffUser[] = roles.map(r => {
          const profile = profiles?.find(p => p.user_id === r.user_id);
          return {
            id: r.user_id,
            email: '', // We'll show role info primarily
            full_name: profile?.full_name || 'Unknown',
            role: r.role as AppRole,
            created_at: r.created_at,
          };
        });

        setStaffUsers(users);
      }
    } catch (error) {
      console.error('Error fetching staff users:', error);
    }
  };

  useEffect(() => {
    fetchStaffUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          role: formData.role,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'User Created',
          description: `${formData.fullName} has been added as ${formData.role}`,
        });
        setFormData({ email: '', password: '', fullName: '', role: 'cashier' });
        fetchStaffUsers();
      } else {
        throw new Error(data?.error || 'Failed to create user');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadge = (role: AppRole) => {
    const config = {
      admin: { icon: Shield, className: 'badge-danger' },
      manager: { icon: Briefcase, className: 'badge-warning' },
      cashier: { icon: Store, className: 'badge-success' },
      customer: { icon: Users, className: 'bg-secondary' },
    };
    const { icon: Icon, className } = config[role] || config.customer;
    return (
      <Badge variant="outline" className={className}>
        <Icon className="w-3 h-3 mr-1" />
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Create and manage staff accounts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create User Form */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-primary/20 text-primary">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create Staff Account</h2>
              <p className="text-sm text-muted-foreground">Add manager or cashier</p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
                className="input-retail"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="staff@store.com"
                className="input-retail"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="input-retail"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'manager' | 'cashier') => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="input-retail">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Manager
                    </div>
                  </SelectItem>
                  <SelectItem value="cashier">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      Cashier
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Create Account
            </Button>
          </form>
        </div>

        {/* Staff List */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-accent/20 text-accent">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Staff Members</h2>
              <p className="text-sm text-muted-foreground">{staffUsers.length} staff accounts</p>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No staff members found
                    </TableCell>
                  </TableRow>
                ) : (
                  staffUsers.map((user) => (
                    <TableRow key={`${user.id}-${user.role}`} className="table-row-hover">
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
