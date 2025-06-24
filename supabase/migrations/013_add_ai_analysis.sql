-- Migration: Add AI analysis fields to waitlist table
-- Description: Adds fields to store AI analysis results and user fitness score

-- Add AI analysis fields
ALTER TABLE waitlist 
ADD COLUMN ai_analysis_score INTEGER CHECK (ai_analysis_score >= 0 AND ai_analysis_score <= 100),
ADD COLUMN ai_analysis_summary TEXT,
ADD COLUMN ai_analysis_reasoning TEXT,
ADD COLUMN ai_deployment_issues BOOLEAN DEFAULT false,
ADD COLUMN ai_versioning_issues BOOLEAN DEFAULT false,
ADD COLUMN ai_openness_score INTEGER CHECK (ai_openness_score >= 0 AND ai_openness_score <= 10),
ADD COLUMN ai_analyzed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN ai_needs_reanalysis BOOLEAN DEFAULT true;

-- Create index on AI score for sorting
CREATE INDEX IF NOT EXISTS idx_waitlist_ai_score ON waitlist(ai_analysis_score);

-- Create index on analysis status for filtering
CREATE INDEX IF NOT EXISTS idx_waitlist_ai_analyzed ON waitlist(ai_analyzed_at);

-- Create index on needs reanalysis for batch processing
CREATE INDEX IF NOT EXISTS idx_waitlist_reanalysis ON waitlist(ai_needs_reanalysis); 