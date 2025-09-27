-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('system_administrator', 'normal_user', 'store_owner');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Create stores table
CREATE TABLE public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL CHECK (char_length(name) >= 20 AND char_length(name) <= 60),
    email TEXT NOT NULL,
    address TEXT NOT NULL CHECK (char_length(address) <= 400),
    average_rating DECIMAL(2,1) DEFAULT 0.0,
    total_ratings INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Create ratings table
CREATE TABLE public.ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, store_id)
);

-- Enable RLS on ratings
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Update profiles table to match requirements
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS date_of_birth,
DROP COLUMN IF EXISTS emergency_contact,
DROP COLUMN IF EXISTS medical_conditions,
DROP COLUMN IF EXISTS allergies,
DROP COLUMN IF EXISTS medications;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT CHECK (char_length(full_name) >= 20 AND char_length(full_name) <= 60),
ADD COLUMN IF NOT EXISTS address TEXT CHECK (char_length(address) <= 400);

-- Drop existing profiles columns that don't match requirements
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS last_name;

-- Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'system_administrator'));

-- Create RLS policies for stores
CREATE POLICY "Everyone can view stores"
ON public.stores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Store owners can update their own stores"
ON public.stores
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System admins can manage all stores"
ON public.stores
FOR ALL
USING (public.has_role(auth.uid(), 'system_administrator'));

-- Create RLS policies for ratings
CREATE POLICY "Users can view all ratings"
ON public.ratings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Normal users can create ratings"
ON public.ratings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'normal_user') AND auth.uid() = user_id);

CREATE POLICY "Normal users can update their own ratings"
ON public.ratings
FOR UPDATE
USING (public.has_role(auth.uid(), 'normal_user') AND auth.uid() = user_id);

CREATE POLICY "System admins can manage all ratings"
ON public.ratings
FOR ALL
USING (public.has_role(auth.uid(), 'system_administrator'));

-- Create function to update store average rating
CREATE OR REPLACE FUNCTION public.update_store_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.stores 
    SET 
        average_rating = (
            SELECT COALESCE(AVG(rating), 0) 
            FROM public.ratings 
            WHERE store_id = COALESCE(NEW.store_id, OLD.store_id)
        ),
        total_ratings = (
            SELECT COUNT(*) 
            FROM public.ratings 
            WHERE store_id = COALESCE(NEW.store_id, OLD.store_id)
        ),
        updated_at = now()
    WHERE id = COALESCE(NEW.store_id, OLD.store_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update store ratings
CREATE TRIGGER update_store_rating_on_insert
    AFTER INSERT ON public.ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_store_rating();

CREATE TRIGGER update_store_rating_on_update
    AFTER UPDATE ON public.ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_store_rating();

CREATE TRIGGER update_store_rating_on_delete
    AFTER DELETE ON public.ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_store_rating();

-- Create trigger for stores updated_at
CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON public.stores
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for ratings updated_at
CREATE TRIGGER update_ratings_updated_at
    BEFORE UPDATE ON public.ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();