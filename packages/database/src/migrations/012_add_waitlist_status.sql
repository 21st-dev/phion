-- Migration: Add status field to waitlist table
-- Description: Adds status field to track approval state of waitlist applications

-- Add status column with enum values
ALTER TABLE waitlist 
ADD COLUMN status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);

-- Add approved_at and approved_by fields for audit trail
ALTER TABLE waitlist 
ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN approved_by UUID REFERENCES auth.users(id);

-- Update existing entries to be pending by default
UPDATE waitlist SET status = 'pending' WHERE status IS NULL; 