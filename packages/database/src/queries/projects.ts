import { SupabaseClient } from "@supabase/supabase-js";
import { Database, ProjectRow, ProjectInsert, ProjectUpdate } from "../types";
import { CreateProject, UpdateProject } from "@shipvibes/shared";

export class ProjectQueries {
  constructor(private client: SupabaseClient<Database>) {}

  /**
   * Получить все проекты
   */
  async getAllProjects(): Promise<ProjectRow[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    return (data as unknown as ProjectRow[]) || [];
  }

  /**
   * Получить проект по ID
   */
  async getProjectById(projectId: string): Promise<ProjectRow | null> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Проект не найден
      }
      throw new Error(`Failed to fetch project: ${error.message}`);
    }

    return data as unknown as ProjectRow;
  }

  /**
   * Создать новый проект
   */
  async createProject(projectData: CreateProject): Promise<ProjectRow> {
    const insertData: ProjectInsert = {
      name: projectData.name || `Project ${Date.now()}`,
      template_type: projectData.template_type || "vite-react",
      deploy_status: "pending",
    };

    const { data, error } = await this.client
      .from("projects")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    return data as unknown as ProjectRow;
  }

  /**
   * Обновить проект
   */
  async updateProject(
    projectId: string,
    updateData: UpdateProject
  ): Promise<ProjectRow> {
    const { data, error } = await this.client
      .from("projects")
      .update(updateData as ProjectUpdate)
      .eq("id", projectId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    return data as unknown as ProjectRow;
  }

  /**
   * Удалить проект
   */
  async deleteProject(projectId: string): Promise<void> {
    const { error } = await this.client
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * Обновить статус деплоя
   */
  async updateDeployStatus(
    projectId: string,
    status: "pending" | "building" | "ready" | "failed" | "cancelled",
    netlifyUrl?: string,
    netlifyId?: string
  ): Promise<ProjectRow> {
    const updateData: ProjectUpdate = {
      deploy_status: status,
    };

    if (netlifyUrl) {
      updateData.netlify_url = netlifyUrl;
    }

    if (netlifyId) {
      updateData.netlify_site_id = netlifyId;
    }

    const { data, error } = await this.client
      .from("projects")
      .update(updateData)
      .eq("id", projectId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update deploy status: ${error.message}`);
    }

    return data as unknown as ProjectRow;
  }

  /**
   * Получить проекты с определенным статусом деплоя
   */
  async getProjectsByDeployStatus(
    status: "pending" | "building" | "ready" | "failed" | "cancelled"
  ): Promise<ProjectRow[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("deploy_status", status)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(
        `Failed to fetch projects by deploy status: ${error.message}`
      );
    }

    return (data as unknown as ProjectRow[]) || [];
  }

  /**
   * Поиск проектов по имени
   */
  async searchProjects(searchTerm: string): Promise<ProjectRow[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .ilike("name", `%${searchTerm}%`)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to search projects: ${error.message}`);
    }

    return (data as unknown as ProjectRow[]) || [];
  }
}
