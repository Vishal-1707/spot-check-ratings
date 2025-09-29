import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(16, 'Password must be at most 16 characters')
    .regex(/^(?=.*[A-Z])(?=.*[!@#$%^&*])/, 'Password must contain at least one uppercase letter and one special character'),
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface StoreInfo {
  id: string;
  name: string;
  address: string;
  average_rating: number;
  total_ratings: number;
}

interface RatingInfo {
  id: string;
  rating: number;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

export const StoreOwnerDashboard = () => {
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [ratings, setRatings] = useState<RatingInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (user) {
      fetchStoreInfo();
      fetchRatings();
    }
  }, [user]);

  const fetchStoreInfo = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No store found for this user
          console.log('No store found for this user');
          return;
        }
        throw error;
      }

      setStore(data);
    } catch (error) {
      console.error('Error fetching store info:', error);
      toast({
        title: "Error",
        description: "Failed to fetch store information",
        variant: "destructive",
      });
    }
  };

  const fetchRatings = async () => {
    try {
      if (!user) return;

      // First get the store ID for this user
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (storeError || !storeData) {
        console.log('No store found for ratings');
        return;
      }

      // Get ratings for this store
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('id, rating, created_at, user_id')
        .eq('store_id', storeData.id)
        .order('created_at', { ascending: false });

      if (ratingsError) throw ratingsError;

      if (!ratingsData || ratingsData.length === 0) {
        setRatings([]);
        return;
      }

      // Get user profiles for the ratings
      const userIds = ratingsData.map(rating => rating.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Combine ratings with profile data
      const ratingsWithProfiles = ratingsData.map(rating => {
        const profile = profilesData?.find(p => p.user_id === rating.user_id);
        return {
          ...rating,
          profiles: {
            full_name: profile?.full_name || 'Anonymous'
          }
        };
      });

      setRatings(ratingsWithProfiles);
    } catch (error) {
      console.error('Error fetching ratings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch ratings",
        variant: "destructive",
      });
    }
  };

  const updatePassword = async (data: PasswordFormData) => {
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password updated successfully!",
      });

      passwordForm.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`w-4 h-4 ${
          index < rating 
            ? 'fill-star-filled text-star-filled' 
            : 'text-star-empty'
        }`}
      />
    ));
  };

  if (!store) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Store Owner Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No store is assigned to your account. Please contact an administrator to assign a store to your account.
            </p>
            <div className="mt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Update Password</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Update Password</DialogTitle>
                    <DialogDescription>Enter your new password</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={passwordForm.handleSubmit(updatePassword)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        {...passwordForm.register('password')}
                        disabled={loading}
                      />
                      {passwordForm.formState.errors.password && (
                        <p className="text-sm text-destructive">{passwordForm.formState.errors.password.message}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Updating...' : 'Update Password'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Store Info */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{store.name}</h1>
          <p className="text-muted-foreground">{store.address}</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Update Password</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Update Password</DialogTitle>
              <DialogDescription>Enter your new password</DialogDescription>
            </DialogHeader>
            <form onSubmit={passwordForm.handleSubmit(updatePassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  {...passwordForm.register('password')}
                  disabled={loading}
                />
                {passwordForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{passwordForm.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Store Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold">
                {store.average_rating ? store.average_rating.toFixed(1) : '0.0'}
              </div>
              <div className="flex">
                {renderStars(Math.round(store.average_rating || 0))}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Total Ratings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{store.total_ratings || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Ratings List */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Ratings</CardTitle>
          <CardDescription>
            See what customers are saying about your store
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ratings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratings.map((rating) => (
                  <TableRow key={rating.id}>
                    <TableCell className="font-medium">
                      {rating.profiles?.full_name || 'Anonymous'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {renderStars(rating.rating)}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          ({rating.rating}/5)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(rating.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No ratings yet. Encourage customers to rate your store!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};