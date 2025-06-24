-- Migration: Add admin policy for waitlist table
-- Description: Allows specific admin user to view all waitlist entries

-- Create a policy for the specific admin user to manage all waitlist entries
CREATE POLICY "Admin can manage all waitlist entries" ON waitlist
FOR ALL
TO authenticated
USING (auth.uid() = '28a1b02f-d1a1-4ca4-968f-ab186dcb59e0'::uuid)
WITH CHECK (auth.uid() = '28a1b02f-d1a1-4ca4-968f-ab186dcb59e0'::uuid); 