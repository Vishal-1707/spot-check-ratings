import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const userSchema = z.object({
  fullName: z.string().min(20, 'Name must be at least 20 characters').max(60, 'Name must be at most 60 characters'),
  email: z.string().email('Please enter a valid email address'),
  address: z.string().max(400, 'Address must be at most 400 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(16, 'Password must be at most 16 characters').regex(/^(?=.*[A-Z])(?=.*[!@#$%^&*])/, 'Password must contain at least one uppercase letter and one special character'),
  role: z.enum(['normal_user', 'store_owner', 'system_administrator']),
});

const storeSchema = z.object({
  name: z.string().min(20, 'Name must be at least 20 characters').max(60, 'Name must be at most 60 characters'),
  email: z.string().email('Please enter a valid email address'),
  address: z.string().max(400, 'Address must be at most 400 characters'),
  ownerId: z.string().min(1, 'Please select a store owner'),
});

type UserFormData = z.infer<typeof userSchema>;
type StoreFormData = z.infer<typeof storeSchema>;

export const AdminDashboard = () => {
  const [stats, setStats] = useState({ users: 0, stores: 0, ratings: 0 });
  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [storeOwners, setStoreOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const { toast } = useToast();

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const storeForm = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
  });

  useEffect(() => {
    fetchStats();
    fetchStores();
    fetchUsers();
    fetchStoreOwners();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, storesRes, ratingsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('stores').select('id', { count: 'exact', head: true }),
        supabase.from('ratings').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        users: usersRes.count || 0,
        stores: storesRes.count || 0,
        ratings: ratingsRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select(`
          *,
          profiles!inner(full_name)
        `)
        .order('name');

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles(role)
        `)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchStoreOwners = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles!inner(role)
        `)
        .eq('user_roles.role', 'store_owner');

      if (error) throw error;
      setStoreOwners(data || []);
    } catch (error) {
      console.error('Error fetching store owners:', error);
    }
  };

  const createUser = async (data: UserFormData) => {
    try {
      setLoading(true);
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
      });

      if (authError) throw authError;

      if (authData.user) {
        await Promise.all([
          supabase.from('profiles').insert({
            user_id: authData.user.id,
            full_name: data.fullName,
            address: data.address,
          }),
          supabase.from('user_roles').insert({
            user_id: authData.user.id,
            role: data.role,
          }),
        ]);

        toast({
          title: "Success",
          description: "User created successfully!",
        });

        userForm.reset();
        fetchStats();
        fetchUsers();
        if (data.role === 'store_owner') {
          fetchStoreOwners();
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createStore = async (data: StoreFormData) => {
    try {
      setLoading(true);
      
      const { error } = await supabase.from('stores').insert({
        user_id: data.ownerId,
        name: data.name,
        email: data.email,
        address: data.address,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Store created successfully!",
      });

      storeForm.reset();
      fetchStats();
      fetchStores();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create store",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStores = stores.filter(store => 
    store.name?.toLowerCase().includes(filterName.toLowerCase()) &&
    store.email?.toLowerCase().includes(filterEmail.toLowerCase()) &&
    store.address?.toLowerCase().includes(filterAddress.toLowerCase())
  );

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(filterName.toLowerCase()) &&
    (!filterEmail || user.user_id?.toLowerCase().includes(filterEmail.toLowerCase())) &&
    user.address?.toLowerCase().includes(filterAddress.toLowerCase()) &&
    (!filterRole || user.user_roles?.[0]?.role === filterRole)
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.users}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Stores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.stores}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Ratings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.ratings}</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button>Add User</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account</DialogDescription>
            </DialogHeader>
            <form onSubmit={userForm.handleSubmit(createUser)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userFullName">Full Name</Label>
                <Input
                  id="userFullName"
                  {...userForm.register('fullName')}
                  disabled={loading}
                />
                {userForm.formState.errors.fullName && (
                  <p className="text-sm text-destructive">{userForm.formState.errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="userEmail">Email</Label>
                <Input
                  id="userEmail"
                  type="email"
                  {...userForm.register('email')}
                  disabled={loading}
                />
                {userForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{userForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="userAddress">Address</Label>
                <Input
                  id="userAddress"
                  {...userForm.register('address')}
                  disabled={loading}
                />
                {userForm.formState.errors.address && (
                  <p className="text-sm text-destructive">{userForm.formState.errors.address.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="userPassword">Password</Label>
                <Input
                  id="userPassword"
                  type="password"
                  {...userForm.register('password')}
                  disabled={loading}
                />
                {userForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{userForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="userRole">Role</Label>
                <Select onValueChange={(value) => userForm.setValue('role', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal_user">Normal User</SelectItem>
                    <SelectItem value="store_owner">Store Owner</SelectItem>
                    <SelectItem value="system_administrator">System Administrator</SelectItem>
                  </SelectContent>
                </Select>
                {userForm.formState.errors.role && (
                  <p className="text-sm text-destructive">{userForm.formState.errors.role.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Create User'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button>Add Store</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Store</DialogTitle>
              <DialogDescription>Create a new store</DialogDescription>
            </DialogHeader>
            <form onSubmit={storeForm.handleSubmit(createStore)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Store Name</Label>
                <Input
                  id="storeName"
                  {...storeForm.register('name')}
                  disabled={loading}
                />
                {storeForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{storeForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeEmail">Email</Label>
                <Input
                  id="storeEmail"
                  type="email"
                  {...storeForm.register('email')}
                  disabled={loading}
                />
                {storeForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{storeForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeAddress">Address</Label>
                <Input
                  id="storeAddress"
                  {...storeForm.register('address')}
                  disabled={loading}
                />
                {storeForm.formState.errors.address && (
                  <p className="text-sm text-destructive">{storeForm.formState.errors.address.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeOwner">Store Owner</Label>
                <Select onValueChange={(value) => storeForm.setValue('ownerId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select store owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {storeOwners.map((owner) => (
                      <SelectItem key={owner.user_id} value={owner.user_id}>
                        {owner.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {storeForm.formState.errors.ownerId && (
                  <p className="text-sm text-destructive">{storeForm.formState.errors.ownerId.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Create Store'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="filterName">Name</Label>
              <Input
                id="filterName"
                placeholder="Filter by name"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filterEmail">Email</Label>
              <Input
                id="filterEmail"
                placeholder="Filter by email"
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filterAddress">Address</Label>
              <Input
                id="filterAddress"
                placeholder="Filter by address"
                value={filterAddress}
                onChange={(e) => setFilterAddress(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filterRole">Role</Label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Roles</SelectItem>
                  <SelectItem value="normal_user">Normal User</SelectItem>
                  <SelectItem value="store_owner">Store Owner</SelectItem>
                  <SelectItem value="system_administrator">System Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stores Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell>{store.name}</TableCell>
                  <TableCell>{store.email}</TableCell>
                  <TableCell>{store.address}</TableCell>
                  <TableCell>{store.average_rating ? store.average_rating.toFixed(1) : '0.0'}</TableCell>
                  <TableCell>{store.profiles?.full_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell>{user.address}</TableCell>
                  <TableCell>
                    {user.user_roles?.[0]?.role?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};