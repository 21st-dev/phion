-- Migration for staging branch - Creating all tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create commit_history table
CREATE TABLE IF NOT EXISTS "public"."commit_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "github_commit_sha" "text" NOT NULL,
    "github_commit_url" "text" NOT NULL,
    "commit_message" "text" NOT NULL,
    "files_count" integer DEFAULT 0,
    "committed_by" "text" DEFAULT 'Shipvibes Bot',
    "created_at" timestamp with time zone DEFAULT "now"()
);

-- Create deploy_status table
CREATE TABLE IF NOT EXISTS "public"."deploy_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "commit_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "step" "text",
    "logs" "text"[],
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "deploy_status_status_check" CHECK (("status" = ANY (ARRAY['pending', 'building', 'deploying', 'success', 'failed'])))
);

-- Create file_history table
CREATE TABLE IF NOT EXISTS "public"."file_history" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "project_id" "uuid",
    "file_path" "text" NOT NULL,
    "r2_object_key" "text" NOT NULL,
    "content_hash" "text",
    "diff_text" "text",
    "file_size" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "commit_id" "uuid",
    "commit_message" "text",
    "github_commit_sha" "text",
    "github_commit_url" "text"
);

-- Create pending_changes table
CREATE TABLE IF NOT EXISTS "public"."pending_changes" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "project_id" "uuid",
    "file_path" "text" NOT NULL,
    "content" "text" NOT NULL,
    "action" "text" NOT NULL,
    "content_hash" "text",
    "file_size" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pending_changes_action_check" CHECK (("action" = ANY (ARRAY['modified', 'added', 'deleted'])))
);

-- Create projects table
CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "uuid_generate_v4"() NOT NULL,
    "name" "text" DEFAULT 'Untitled Project' NOT NULL,
    "template_type" "text" DEFAULT 'vite-react' NOT NULL,
    "netlify_site_id" "text",
    "netlify_url" "text",
    "deploy_status" "text" DEFAULT 'pending',
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "netlify_deploy_id" "text",
    "user_id" "uuid",
    "github_repo_url" "text",
    "github_repo_name" "text",
    "github_owner" "text" DEFAULT 'phion-dev',
    "project_status" "text" DEFAULT 'created',
    CONSTRAINT "projects_deploy_status_check" CHECK (("deploy_status" = ANY (ARRAY['pending', 'building', 'ready', 'failed', 'cancelled']))),
    CONSTRAINT "projects_project_status_check" CHECK (("project_status" = ANY (ARRAY['created', 'initializing', 'ready', 'downloaded', 'connected', 'deployed', 'active'])))
);

-- Create waitlist table
CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying NOT NULL,
    "name" character varying NOT NULL,
    "coding_experience" "text" NOT NULL,
    "frustrations" "text" NOT NULL,
    "dream_project" "text" NOT NULL,
    "accepts_call" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    "tools_used" character varying,
    "tool_dislike" "text",
    "status" character varying(20) DEFAULT 'pending',
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "ai_analysis_score" integer,
    "ai_analysis_summary" "text",
    "ai_analysis_reasoning" "text",
    "ai_deployment_issues" boolean DEFAULT false,
    "ai_versioning_issues" boolean DEFAULT false,
    "ai_openness_score" integer,
    "ai_analyzed_at" timestamp with time zone,
    "ai_experience_level" "text",
    "ai_needs_reanalysis" boolean DEFAULT false,
    "ai_uses_cursor" boolean DEFAULT false
);

-- Add primary keys
ALTER TABLE ONLY "public"."commit_history" ADD CONSTRAINT "commit_history_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."deploy_status" ADD CONSTRAINT "deploy_status_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."file_history" ADD CONSTRAINT "file_history_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."pending_changes" ADD CONSTRAINT "pending_changes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."waitlist" ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");

-- Add unique constraints
ALTER TABLE ONLY "public"."waitlist" ADD CONSTRAINT "waitlist_email_key" UNIQUE ("email");

-- Add foreign key constraints
ALTER TABLE ONLY "public"."commit_history" ADD CONSTRAINT "commit_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."deploy_status" ADD CONSTRAINT "deploy_status_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."file_history" ADD CONSTRAINT "file_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."pending_changes" ADD CONSTRAINT "pending_changes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_commit_history_project_id" ON "public"."commit_history" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_deploy_status_project_id" ON "public"."deploy_status" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_file_history_project_id" ON "public"."file_history" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_pending_changes_project_id" ON "public"."pending_changes" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_waitlist_status" ON "public"."waitlist" ("status");

-- Add comments for documentation
COMMENT ON TABLE "public"."commit_history" IS 'История коммитов проекта в GitHub репозитории';
COMMENT ON COLUMN "public"."commit_history"."github_commit_sha" IS 'SHA коммита в GitHub';
COMMENT ON COLUMN "public"."file_history"."github_commit_sha" IS 'SHA коммита в GitHub где сохранен файл'; 