import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  userRole: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchUserRole(user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        setUserRole(null);
        setLoading(false);
        return;
      }
      
      // If no role exists, assign default role
      if (!data) {
        const assignedRole = await assignDefaultRole(userId);
        setUserRole(assignedRole);
        setLoading(false);
        return;
      }
      
      setUserRole(data.role || null);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole(null);
      setLoading(false);
    }
  };

  const assignDefaultRole = async (userId: string): Promise<string | null> => {
    try {
      // Check if this is the first user in the system
      const { count } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true });

      // If no users exist, make this user a system administrator
      const role = count === 0 ? 'system_administrator' : 'normal_user';

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role,
        });

      if (error) {
        console.error('Error assigning default role:', error);
        toast({
          title: "Error",
          description: "Failed to assign user role. Please contact an administrator.",
          variant: "destructive",
        });
        return null;
      }
      
      toast({
        title: "Welcome!",
        description: `You've been assigned the role: ${role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      });

      return role;
    } catch (error) {
      console.error('Error assigning default role:', error);
      toast({
        title: "Error",
        description: "Failed to assign user role. Please contact an administrator.",
        variant: "destructive",
      });
      return null;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};