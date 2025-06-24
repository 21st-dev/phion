-- Migration: Add Next.js and Vercel support
-- Description: Extends the current Vite + Netlify architecture to support Next.js + Vercel

-- ========================================
-- 1. UPDATE PROJECTS TABLE
-- ========================================

-- Add Vercel-specific fields
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS vercel_project_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS vercel_project_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS vercel_url TEXT,
ADD COLUMN IF NOT EXISTS vercel_deploy_status VARCHAR(20) CHECK (vercel_deploy_status IN ('building', 'ready', 'failed'));

-- Update template_type to support nextjs
-- First, remove the existing constraint if it exists
DO $$
BEGIN
    -- Check if the constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%template_type%' 
        AND conrelid = 'projects'::regclass
    ) THEN
        ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_template_type_check;
    END IF;
END $$;

-- Add new constraint with both vite and nextjs support
ALTER TABLE projects 
ADD CONSTRAINT projects_template_type_check 
CHECK (template_type IN ('vite', 'nextjs', 'vite-react'));

-- Update existing projects to use 'vite' if they have 'vite-react'
UPDATE projects 
SET template_type = 'vite' 
WHERE template_type = 'vite-react';

-- ========================================
-- 2. CREATE INDEXES
-- ========================================

-- Indexes for Vercel fields
CREATE INDEX IF NOT EXISTS idx_projects_vercel_project_id ON projects(vercel_project_id) WHERE vercel_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_vercel_deploy_status ON projects(vercel_deploy_status) WHERE vercel_deploy_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_template_type ON projects(template_type);

-- Combined index for template-specific queries
CREATE INDEX IF NOT EXISTS idx_projects_template_deploy_status ON projects(template_type, deploy_status);
CREATE INDEX IF NOT EXISTS idx_projects_template_vercel_status ON projects(template_type, vercel_deploy_status) WHERE vercel_deploy_status IS NOT NULL;

-- ========================================
-- 3. ADD COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON COLUMN projects.vercel_project_id IS 'Vercel project ID for Next.js deployments';
COMMENT ON COLUMN projects.vercel_project_name IS 'Vercel project name (usually matches GitHub repo name)';
COMMENT ON COLUMN projects.vercel_url IS 'Live Vercel deployment URL';
COMMENT ON COLUMN projects.vercel_deploy_status IS 'Current Vercel deployment status (building/ready/failed)';
COMMENT ON COLUMN projects.template_type IS 'Project template type: vite (Vite+React+Netlify) or nextjs (Next.js+Vercel)';

-- ========================================
-- 4. DATA VALIDATION
-- ========================================

-- Ensure no projects have both Netlify and Vercel configured
-- This is a business rule to prevent confusion
DO $$
DECLARE
    dual_deploy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dual_deploy_count
    FROM projects
    WHERE netlify_site_id IS NOT NULL 
    AND vercel_project_id IS NOT NULL;
    
    IF dual_deploy_count > 0 THEN
        RAISE WARNING 'Found % projects with both Netlify and Vercel configured. This should be reviewed.', dual_deploy_count;
    ELSE
        RAISE NOTICE 'Data validation passed: No projects have dual deployment configurations.';
    END IF;
END $$;

-- ========================================
-- 5. MIGRATION SUMMARY
-- ========================================

DO $$
DECLARE
    total_projects INTEGER;
    vite_projects INTEGER;
    nextjs_projects INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_projects FROM projects;
    SELECT COUNT(*) INTO vite_projects FROM projects WHERE template_type = 'vite';
    SELECT COUNT(*) INTO nextjs_projects FROM projects WHERE template_type = 'nextjs';
    
    RAISE NOTICE 'Migration 016 completed successfully:';
    RAISE NOTICE '- Total projects: %', total_projects;
    RAISE NOTICE '- Vite projects: %', vite_projects;
    RAISE NOTICE '- Next.js projects: %', nextjs_projects;
    RAISE NOTICE '- Added Vercel support fields';
    RAISE NOTICE '- Updated template_type constraints';
    RAISE NOTICE '- Created optimization indexes';
END $$; 