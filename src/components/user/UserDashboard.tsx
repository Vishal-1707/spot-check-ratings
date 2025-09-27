import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface Store {
  id: string;
  name: string;
  address: string;
  average_rating: number;
  user_rating?: number;
}

export const UserDashboard = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const { user } = useAuth();
  const { toast } = useToast();

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (user) {
      fetchStores();
    }
  }, [user]);

  const fetchStores = async () => {
    try {
      if (!user) return;

      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('*')
        .order('name');

      if (storesError) throw storesError;

      // Get user's ratings for these stores
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('store_id, rating')
        .eq('user_id', user.id);

      if (ratingsError) throw ratingsError;

      const ratingsMap = ratingsData?.reduce((acc, rating) => {
        acc[rating.store_id] = rating.rating;
        return acc;
      }, {} as Record<string, number>) || {};

      const storesWithRatings = storesData?.map(store => ({
        ...store,
        user_rating: ratingsMap[store.id],
      })) || [];

      setStores(storesWithRatings);
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast({
        title: "Error",
        description: "Failed to fetch stores",
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

  const submitRating = async () => {
    try {
      if (!selectedStore || !user || selectedRating === 0) return;

      setLoading(true);

      const { error } = await supabase
        .from('ratings')
        .upsert({
          user_id: user.id,
          store_id: selectedStore.id,
          rating: selectedRating,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rating submitted successfully!",
      });

      setSelectedStore(null);
      setSelectedRating(0);
      fetchStores(); // Refresh to get updated ratings
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit rating",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStores = stores.filter(store => 
    store.name?.toLowerCase().includes(searchName.toLowerCase()) &&
    store.address?.toLowerCase().includes(searchAddress.toLowerCase())
  );

  const renderStars = (rating: number, interactive = false, onStarClick?: (rating: number) => void) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`w-5 h-5 ${
          index < rating 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-300'
        } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
        onClick={() => interactive && onStarClick?.(index + 1)}
      />
    ));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* User Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Store Directory</h2>
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

      {/* Search Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Stores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="searchName">Store Name</Label>
              <Input
                id="searchName"
                placeholder="Search by store name"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="searchAddress">Address</Label>
              <Input
                id="searchAddress"
                placeholder="Search by address"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStores.map((store) => (
          <Card key={store.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">{store.name}</CardTitle>
              <CardDescription>{store.address}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Overall Rating:</span>
                  <div className="flex items-center gap-1">
                    {renderStars(Math.round(store.average_rating || 0))}
                    <span className="text-sm text-muted-foreground ml-2">
                      ({(store.average_rating || 0).toFixed(1)})
                    </span>
                  </div>
                </div>
                
                {store.user_rating && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Your Rating:</span>
                    <div className="flex items-center gap-1">
                      {renderStars(store.user_rating)}
                    </div>
                  </div>
                )}
              </div>

              <Button 
                onClick={() => setSelectedStore(store)}
                className="w-full"
                variant={store.user_rating ? "outline" : "default"}
              >
                {store.user_rating ? 'Update Rating' : 'Rate Store'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rating Dialog */}
      <Dialog open={!!selectedStore} onOpenChange={() => setSelectedStore(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rate {selectedStore?.name}</DialogTitle>
            <DialogDescription>
              {selectedStore?.user_rating 
                ? 'Update your rating for this store' 
                : 'Rate this store from 1 to 5 stars'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex justify-center gap-1 mb-4">
                {renderStars(
                  selectedRating || selectedStore?.user_rating || 0, 
                  true, 
                  setSelectedRating
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Click a star to rate (Currently: {selectedRating || selectedStore?.user_rating || 0}/5)
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedStore(null)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={submitRating} 
                disabled={loading || selectedRating === 0}
                className="flex-1"
              >
                {loading ? 'Submitting...' : 'Submit Rating'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};