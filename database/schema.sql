-- PDF-to-Text SaaS Database Schema
-- This script creates the core database schema with Row Level Security (RLS)

-- Create custom types
CREATE TYPE user_status AS ENUM ('free', 'pay_per_use');
CREATE TYPE output_format AS ENUM ('txt', 'markdown', 'docx');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  user_status user_status DEFAULT 'free' NOT NULL,
  pages_used INTEGER DEFAULT 0 NOT NULL CHECK (pages_used >= 0),
  pages_limit INTEGER DEFAULT 5 NOT NULL CHECK (pages_limit > 0),
  stripe_customer_id VARCHAR(255) UNIQUE
);

-- Processing history table
CREATE TABLE public.processing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  pages_processed INTEGER NOT NULL CHECK (pages_processed > 0),
  output_format output_format NOT NULL,
  processing_status VARCHAR(20) DEFAULT 'processing' NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional fields for tracking
  processing_time_ms INTEGER,
  file_hash VARCHAR(64), -- For deduplication
  
  -- Payment tracking
  was_paid BOOLEAN DEFAULT FALSE NOT NULL,
  payment_amount DECIMAL(10,2) DEFAULT 0.00,
  stripe_payment_intent_id VARCHAR(255)
);

-- Create indexes for performance
CREATE INDEX idx_processing_history_user_id ON public.processing_history (user_id);
CREATE INDEX idx_processing_history_created_at ON public.processing_history (created_at);
CREATE INDEX idx_processing_history_status ON public.processing_history (processing_status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger to users table
CREATE TRIGGER handle_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for processing_history table
CREATE POLICY "Users can view their own processing history" ON public.processing_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processing records" ON public.processing_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own processing records" ON public.processing_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create function to update user pages usage (for paid documents)
CREATE OR REPLACE FUNCTION public.update_user_pages_usage(user_uuid UUID, pages_count INTEGER, is_paid BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN AS $$
DECLARE
  current_usage INTEGER;
  current_limit INTEGER;
BEGIN
  -- Get current user data
  SELECT pages_used, pages_limit 
  INTO current_usage, current_limit
  FROM public.users 
  WHERE id = user_uuid;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- If it's a paid document, always allow processing
  IF is_paid THEN
    -- Don't count paid pages against the free limit
    RETURN TRUE;
  END IF;
  
  -- Check if user has enough free pages
  IF (current_usage + pages_count) > current_limit THEN
    RETURN FALSE;
  END IF;
  
  -- Update pages usage only for free documents
  UPDATE public.users 
  SET pages_used = pages_used + pages_count,
      updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN TRUE;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create function to check if user can process pages for free
CREATE OR REPLACE FUNCTION public.can_user_process_pages_free(user_uuid UUID, pages_count INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_usage INTEGER;
  current_limit INTEGER;
BEGIN
  -- Get current user data
  SELECT pages_used, pages_limit 
  INTO current_usage, current_limit
  FROM public.users 
  WHERE id = user_uuid;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if free user has enough pages within their monthly limit
  RETURN (current_usage + pages_count) <= current_limit;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, authenticated, service_role;

-- Comments for documentation
COMMENT ON TABLE public.users IS 'User profiles with subscription and usage tracking';
COMMENT ON TABLE public.processing_history IS 'History of all PDF processing operations';
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user profile when auth user is created';
COMMENT ON FUNCTION public.update_user_pages_usage(UUID, INTEGER) IS 'Updates user page usage with validation';
COMMENT ON FUNCTION public.can_user_process_pages(UUID, INTEGER) IS 'Checks if user can process specified number of pages';