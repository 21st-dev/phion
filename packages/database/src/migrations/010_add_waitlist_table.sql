-- Migration: Add waitlist table for early access applications
-- Description: Creates a table to store waitlist applications with user information and preferences

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  coding_experience TEXT NOT NULL,
  frustrations TEXT NOT NULL,
  dream_project TEXT NOT NULL,
  accepts_call BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- Create index on created_at for admin sorting
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);

-- Add RLS (Row Level Security) policies if needed
-- Note: Since this is an admin-only table, we might want to restrict access
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows service role to read/write all data
-- This is for the API to work properly
CREATE POLICY "Service role can manage waitlist" ON waitlist
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Optional: Create a policy for admins to view waitlist entries
-- You can modify this based on your admin authentication setup
-- CREATE POLICY "Admins can view waitlist" ON waitlist
-- FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM auth.users 
--     WHERE auth.users.id = auth.uid() 
--     AND auth.users.email IN ('admin@phion.dev') -- Replace with actual admin emails
--   )
-- );

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_waitlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language plpgsql;

-- Create trigger to automatically update updated_at on row updates
CREATE TRIGGER update_waitlist_updated_at_trigger
  BEFORE UPDATE ON waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_waitlist_updated_at(); 