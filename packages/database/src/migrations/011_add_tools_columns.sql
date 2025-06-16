-- Migration: Add tools experience columns to waitlist table
-- Description: Adds columns to track which development tools users have experience with and their feedback

ALTER TABLE waitlist 
ADD COLUMN tools_used VARCHAR,
ADD COLUMN tool_dislike TEXT;

-- Add comments for documentation
COMMENT ON COLUMN waitlist.tools_used IS 'Which development tool the user has used the most (lovable, cursor, windsurf, bolt, v0, claude-code, jetbrains-ai, replit, none)';
COMMENT ON COLUMN waitlist.tool_dislike IS 'What the user didn''t like about the tool they used (optional if tools_used is "none")'; 