

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."update_project_status"("project_id_param" "uuid", "new_status" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Проверяем валидность статуса
  IF new_status NOT IN ('created', 'initializing', 'ready', 'downloaded', 'connected', 'deployed', 'active') THEN
    RAISE EXCEPTION 'Invalid project status: %', new_status;
  END IF;
  
  -- Обновляем статус
  UPDATE projects 
  SET project_status = new_status, updated_at = NOW()
  WHERE id = project_id_param;
  
  -- Возвращаем success
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_project_status"("project_id_param" "uuid", "new_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_waitlist_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_waitlist_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."commit_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "github_commit_sha" "text" NOT NULL,
    "github_commit_url" "text" NOT NULL,
    "commit_message" "text" NOT NULL,
    "files_count" integer DEFAULT 0,
    "committed_by" "text" DEFAULT 'Shipvibes Bot'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."commit_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."commit_history" IS 'История коммитов проекта в GitHub репозитории';



COMMENT ON COLUMN "public"."commit_history"."github_commit_sha" IS 'SHA коммита в GitHub';



COMMENT ON COLUMN "public"."commit_history"."github_commit_url" IS 'URL коммита в GitHub';



COMMENT ON COLUMN "public"."commit_history"."commit_message" IS 'Сообщение коммита';



COMMENT ON COLUMN "public"."commit_history"."files_count" IS 'Количество файлов в коммите';



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
    CONSTRAINT "deploy_status_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'building'::"text", 'deploying'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."deploy_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
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


ALTER TABLE "public"."file_history" OWNER TO "postgres";


COMMENT ON COLUMN "public"."file_history"."github_commit_sha" IS 'SHA коммита в GitHub где сохранен файл';



COMMENT ON COLUMN "public"."file_history"."github_commit_url" IS 'URL коммита в GitHub';



CREATE TABLE IF NOT EXISTS "public"."pending_changes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid",
    "file_path" "text" NOT NULL,
    "content" "text" NOT NULL,
    "action" "text" NOT NULL,
    "content_hash" "text",
    "file_size" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pending_changes_action_check" CHECK (("action" = ANY (ARRAY['modified'::"text", 'added'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."pending_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" DEFAULT 'Untitled Project'::"text" NOT NULL,
    "template_type" "text" DEFAULT 'vite-react'::"text" NOT NULL,
    "netlify_site_id" "text",
    "netlify_url" "text",
    "deploy_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "netlify_deploy_id" "text",
    "user_id" "uuid",
    "github_repo_url" "text",
    "github_repo_name" "text",
    "github_owner" "text" DEFAULT '''phion-dev''::text'::"text",
    "project_status" "text" DEFAULT 'created'::"text",
    CONSTRAINT "projects_deploy_status_check" CHECK (("deploy_status" = ANY (ARRAY['pending'::"text", 'building'::"text", 'ready'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "projects_project_status_check" CHECK (("project_status" = ANY (ARRAY['created'::"text", 'initializing'::"text", 'ready'::"text", 'downloaded'::"text", 'connected'::"text", 'deployed'::"text", 'active'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."github_repo_url" IS 'URL GitHub репозитория (https://github.com/vybcel/vybcel-project-{id})';



COMMENT ON COLUMN "public"."projects"."github_repo_name" IS 'Имя GitHub репозитория (vybcel-project-{id})';



COMMENT ON COLUMN "public"."projects"."github_owner" IS 'Владелец GitHub репозитория (организация vybcel)';



COMMENT ON COLUMN "public"."projects"."project_status" IS 'Статус проекта для логики онбординга: created -> initializing -> ready -> downloaded -> connected -> deployed -> active';



CREATE OR REPLACE VIEW "public"."project_status_analytics" AS
 SELECT "projects"."project_status",
    "count"(*) AS "count",
    ((("count"(*))::numeric * 100.0) / (( SELECT "count"(*) AS "count"
           FROM "public"."projects" "projects_1"))::numeric) AS "percentage"
   FROM "public"."projects"
  GROUP BY "projects"."project_status"
  ORDER BY
        CASE "projects"."project_status"
            WHEN 'created'::"text" THEN 1
            WHEN 'initializing'::"text" THEN 2
            WHEN 'ready'::"text" THEN 3
            WHEN 'downloaded'::"text" THEN 4
            WHEN 'connected'::"text" THEN 5
            WHEN 'deployed'::"text" THEN 6
            WHEN 'active'::"text" THEN 7
            ELSE 8
        END;


ALTER TABLE "public"."project_status_analytics" OWNER TO "postgres";


COMMENT ON VIEW "public"."project_status_analytics" IS 'Аналитика распределения проектов по статусам';



CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying NOT NULL,
    "name" character varying NOT NULL,
    "coding_experience" "text" NOT NULL,
    "frustrations" "text" NOT NULL,
    "dream_project" "text" NOT NULL,
    "accepts_call" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "tools_used" character varying,
    "tool_dislike" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "ai_analysis_score" integer,
    "ai_analysis_summary" "text",
    "ai_analysis_reasoning" "text",
    "ai_deployment_issues" boolean DEFAULT false,
    "ai_versioning_issues" boolean DEFAULT false,
    "ai_openness_score" integer,
    "ai_analyzed_at" timestamp with time zone,
    "ai_needs_reanalysis" boolean DEFAULT true,
    "ai_experience_level" character varying(20),
    "ai_uses_cursor" boolean DEFAULT false,
    CONSTRAINT "waitlist_ai_analysis_score_check" CHECK ((("ai_analysis_score" >= 0) AND ("ai_analysis_score" <= 100))),
    CONSTRAINT "waitlist_ai_experience_level_check" CHECK ((("ai_experience_level")::"text" = ANY ((ARRAY['beginner'::character varying, 'intermediate'::character varying, 'senior'::character varying])::"text"[]))),
    CONSTRAINT "waitlist_ai_openness_score_check" CHECK ((("ai_openness_score" >= 0) AND ("ai_openness_score" <= 10))),
    CONSTRAINT "waitlist_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


COMMENT ON COLUMN "public"."waitlist"."tools_used" IS 'Which development tool the user has used the most (lovable, cursor, windsurf, bolt, v0, claude-code, jetbrains-ai, replit, none)';



COMMENT ON COLUMN "public"."waitlist"."tool_dislike" IS 'What the user didn''t like about the tool they used (optional if tools_used is "none")';



ALTER TABLE ONLY "public"."commit_history"
    ADD CONSTRAINT "commit_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deploy_status"
    ADD CONSTRAINT "deploy_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_history"
    ADD CONSTRAINT "file_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_changes"
    ADD CONSTRAINT "pending_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_changes"
    ADD CONSTRAINT "pending_changes_project_id_file_path_key" UNIQUE ("project_id", "file_path");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_id_unique" UNIQUE ("id");



COMMENT ON CONSTRAINT "projects_id_unique" ON "public"."projects" IS 'Ensures each project ID is unique in the database';



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_commit_history_created_at" ON "public"."commit_history" USING "btree" ("project_id", "created_at" DESC);



CREATE INDEX "idx_commit_history_github_sha" ON "public"."commit_history" USING "btree" ("github_commit_sha");



CREATE INDEX "idx_commit_history_project_id" ON "public"."commit_history" USING "btree" ("project_id");



CREATE UNIQUE INDEX "idx_commit_history_project_sha" ON "public"."commit_history" USING "btree" ("project_id", "github_commit_sha");



CREATE INDEX "idx_deploy_status_commit_id" ON "public"."deploy_status" USING "btree" ("commit_id");



CREATE INDEX "idx_deploy_status_created_at" ON "public"."deploy_status" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_deploy_status_project_id" ON "public"."deploy_status" USING "btree" ("project_id");



CREATE INDEX "idx_file_history_commit_id" ON "public"."file_history" USING "btree" ("commit_id") WHERE ("commit_id" IS NOT NULL);



CREATE INDEX "idx_file_history_content_hash" ON "public"."file_history" USING "btree" ("content_hash") WHERE ("content_hash" IS NOT NULL);



CREATE INDEX "idx_file_history_created_at" ON "public"."file_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_file_history_file_path" ON "public"."file_history" USING "btree" ("project_id", "file_path", "created_at" DESC);



CREATE INDEX "idx_file_history_github_commit_sha" ON "public"."file_history" USING "btree" ("github_commit_sha");



CREATE INDEX "idx_file_history_project_github" ON "public"."file_history" USING "btree" ("project_id", "github_commit_sha");



CREATE INDEX "idx_file_history_project_id" ON "public"."file_history" USING "btree" ("project_id");



CREATE INDEX "idx_pending_changes_action" ON "public"."pending_changes" USING "btree" ("action");



CREATE INDEX "idx_pending_changes_project_id" ON "public"."pending_changes" USING "btree" ("project_id");



CREATE INDEX "idx_pending_changes_updated_at" ON "public"."pending_changes" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_projects_created_at" ON "public"."projects" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_projects_deploy_status" ON "public"."projects" USING "btree" ("deploy_status");



CREATE INDEX "idx_projects_github_owner" ON "public"."projects" USING "btree" ("github_owner");



CREATE INDEX "idx_projects_github_repo_name" ON "public"."projects" USING "btree" ("github_repo_name");



CREATE INDEX "idx_projects_github_repo_unique" ON "public"."projects" USING "btree" ("github_repo_name") WHERE ("github_repo_name" IS NOT NULL);



COMMENT ON INDEX "public"."idx_projects_github_repo_unique" IS 'Optimizes GitHub repository name lookups and prevents repo name conflicts';



CREATE INDEX "idx_projects_netlify_deploy_id" ON "public"."projects" USING "btree" ("netlify_deploy_id") WHERE ("netlify_deploy_id" IS NOT NULL);



CREATE INDEX "idx_projects_project_status" ON "public"."projects" USING "btree" ("project_status");



CREATE INDEX "idx_projects_user_id" ON "public"."projects" USING "btree" ("user_id");



CREATE INDEX "idx_projects_user_id_created_at" ON "public"."projects" USING "btree" ("user_id", "created_at" DESC);



COMMENT ON INDEX "public"."idx_projects_user_id_created_at" IS 'Optimizes user project listings ordered by creation date';



CREATE INDEX "idx_waitlist_ai_analyzed" ON "public"."waitlist" USING "btree" ("ai_analyzed_at");



CREATE INDEX "idx_waitlist_ai_score" ON "public"."waitlist" USING "btree" ("ai_analysis_score");



CREATE INDEX "idx_waitlist_created_at" ON "public"."waitlist" USING "btree" ("created_at");



CREATE INDEX "idx_waitlist_email" ON "public"."waitlist" USING "btree" ("email");



CREATE INDEX "idx_waitlist_experience_level" ON "public"."waitlist" USING "btree" ("ai_experience_level");



CREATE INDEX "idx_waitlist_reanalysis" ON "public"."waitlist" USING "btree" ("ai_needs_reanalysis");



CREATE INDEX "idx_waitlist_status" ON "public"."waitlist" USING "btree" ("status");



CREATE INDEX "idx_waitlist_uses_cursor" ON "public"."waitlist" USING "btree" ("ai_uses_cursor");



CREATE OR REPLACE TRIGGER "update_pending_changes_updated_at" BEFORE UPDATE ON "public"."pending_changes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_waitlist_updated_at_trigger" BEFORE UPDATE ON "public"."waitlist" FOR EACH ROW EXECUTE FUNCTION "public"."update_waitlist_updated_at"();



ALTER TABLE ONLY "public"."commit_history"
    ADD CONSTRAINT "commit_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deploy_status"
    ADD CONSTRAINT "deploy_status_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_history"
    ADD CONSTRAINT "file_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_changes"
    ADD CONSTRAINT "pending_changes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Admin can manage all waitlist entries" ON "public"."waitlist" TO "authenticated" USING (("auth"."uid"() = '28a1b02f-d1a1-4ca4-968f-ab186dcb59e0'::"uuid")) WITH CHECK (("auth"."uid"() = '28a1b02f-d1a1-4ca4-968f-ab186dcb59e0'::"uuid"));



CREATE POLICY "Service role full access" ON "public"."waitlist" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "System can manage pending changes" ON "public"."pending_changes" USING (true) WITH CHECK (true);



CREATE POLICY "Users can delete files from own projects" ON "public"."file_history" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "file_history"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own projects" ON "public"."projects" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert files to own projects" ON "public"."file_history" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "file_history"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own projects" ON "public"."projects" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own waitlist entry" ON "public"."waitlist" FOR SELECT TO "authenticated" USING ((("email")::"text" = ("auth"."jwt"() ->> 'email'::"text")));



CREATE POLICY "Users can update files in own projects" ON "public"."file_history" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "file_history"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own projects" ON "public"."projects" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own waitlist entry" ON "public"."waitlist" FOR UPDATE TO "authenticated" USING ((("email")::"text" = ("auth"."jwt"() ->> 'email'::"text"))) WITH CHECK ((("email")::"text" = ("auth"."jwt"() ->> 'email'::"text")));



CREATE POLICY "Users can view own project files" ON "public"."file_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "file_history"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own projects" ON "public"."projects" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view pending changes of own projects" ON "public"."pending_changes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "pending_changes"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."file_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."update_project_status"("project_id_param" "uuid", "new_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_project_status"("project_id_param" "uuid", "new_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_project_status"("project_id_param" "uuid", "new_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_waitlist_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_waitlist_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_waitlist_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."commit_history" TO "anon";
GRANT ALL ON TABLE "public"."commit_history" TO "authenticated";
GRANT ALL ON TABLE "public"."commit_history" TO "service_role";



GRANT ALL ON TABLE "public"."deploy_status" TO "anon";
GRANT ALL ON TABLE "public"."deploy_status" TO "authenticated";
GRANT ALL ON TABLE "public"."deploy_status" TO "service_role";



GRANT ALL ON TABLE "public"."file_history" TO "anon";
GRANT ALL ON TABLE "public"."file_history" TO "authenticated";
GRANT ALL ON TABLE "public"."file_history" TO "service_role";



GRANT ALL ON TABLE "public"."pending_changes" TO "anon";
GRANT ALL ON TABLE "public"."pending_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_changes" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."project_status_analytics" TO "anon";
GRANT ALL ON TABLE "public"."project_status_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."project_status_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
