import { z } from "zod";
// Deploy statuses
export const DeployStatus = z.enum([
    "pending",
    "building",
    "ready",
    "failed",
    "cancelled",
]);
// Project template types
export const TemplateType = z.enum([
    "vite-react",
    "vite-vue",
    "next-js",
    "nuxt-js",
    "vanilla-js",
]);
// Project schema
export const ProjectSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    name: z.string().min(1).max(100),
    template_type: TemplateType,
    netlify_site_id: z.string().nullable(),
    netlify_url: z.string().url().nullable(),
    deploy_status: DeployStatus,
    github_repo_url: z.string().url().nullable(),
    github_repo_name: z.string().nullable(),
    github_owner: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});
// Schema for creating project
export const CreateProjectSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    template_type: TemplateType.default("vite-react"),
});
// Schema for updating project
export const UpdateProjectSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    deploy_status: DeployStatus.optional(),
    netlify_site_id: z.string().optional(),
    netlify_url: z.string().url().optional(),
    netlify_deploy_id: z.string().optional(),
    github_repo_url: z.string().url().optional(),
    github_repo_name: z.string().optional(),
    github_owner: z.string().optional(),
});
