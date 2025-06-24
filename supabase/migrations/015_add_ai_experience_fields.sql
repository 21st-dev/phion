-- Migration: Add experience level and Cursor usage fields to waitlist AI analysis
-- Description: Adds fields to track experience level and Cursor IDE usage

-- Add new AI analysis fields
ALTER TABLE waitlist 
ADD COLUMN ai_experience_level VARCHAR(20) CHECK (ai_experience_level IN ('beginner', 'intermediate', 'senior')),
ADD COLUMN ai_uses_cursor BOOLEAN DEFAULT false;

-- Create index for experience level filtering
CREATE INDEX IF NOT EXISTS idx_waitlist_experience_level ON waitlist(ai_experience_level);

-- Create index for cursor usage filtering  
CREATE INDEX IF NOT EXISTS idx_waitlist_uses_cursor ON waitlist(ai_uses_cursor); 