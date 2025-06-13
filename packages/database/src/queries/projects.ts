import { SupabaseClient } from "@supabase/supabase-js";
import { Database, ProjectRow, ProjectInsert, ProjectUpdate } from "../types";
import { CreateProject, UpdateProject } from "@shipvibes/shared";

export class ProjectQueries {
  constructor(private client: SupabaseClient<Database>) {}

  /**
   * Получить все проекты (только для admin/service role)
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
   * Получить проекты пользователя (работает с RLS)
   */
  async getUserProjects(userId?: string): Promise<ProjectRow[]> {
    let query = this.client
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    // Если передан userId (для service role), фильтруем по нему
    if (userId) {
      query = query.eq("user_id", userId);
    }
    // Иначе RLS автоматически отфильтрует по текущему пользователю

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch user projects: ${error.message}`);
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
  async createProject(projectData: CreateProject & { user_id?: string }): Promise<ProjectRow> {
    const insertData: ProjectInsert = {
      name: projectData.name || `Project ${Date.now()}`,
      template_type: projectData.template_type || "vite-react",
      deploy_status: "pending",
      user_id: projectData.user_id, // Добавляем user_id
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

  /**
   * Поиск проектов пользователя по имени
   */
  async searchUserProjects(searchTerm: string, userId?: string): Promise<ProjectRow[]> {
    let query = this.client
      .from("projects")
      .select("*")
      .ilike("name", `%${searchTerm}%`)
      .order("created_at", { ascending: false });

    // Если передан userId (для service role), фильтруем по нему
    if (userId) {
      query = query.eq("user_id", userId);
    }
    // Иначе RLS автоматически отфильтрует по текущему пользователю

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search user projects: ${error.message}`);
    }

    return (data as unknown as ProjectRow[]) || [];
  }

  /**
   * Обновить GitHub информацию проекта
   */
  async updateGitHubInfo(
    projectId: string,
    githubInfo: {
      github_repo_url: string;
      github_repo_name: string;
      github_owner?: string;
    }
  ): Promise<ProjectRow> {
    const updateData: ProjectUpdate = {
      github_repo_url: githubInfo.github_repo_url,
      github_repo_name: githubInfo.github_repo_name,
      github_owner: githubInfo.github_owner || "vybcel",
    };

    // Сначала проверяем, сколько записей с таким ID существует
    const { data: existingProjects, error: checkError } = await this.client
      .from("projects")
      .select("id")
      .eq("id", projectId);

    if (checkError) {
      throw new Error(`Failed to check project existence: ${checkError.message}`);
    }

    if (!existingProjects || existingProjects.length === 0) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (existingProjects.length > 1) {
      console.error(`⚠️ Multiple projects found with ID ${projectId}:`, existingProjects.length);
      
      // Если есть дубликаты, обновляем все записи, но возвращаем первую
      const { data, error } = await this.client
        .from("projects")
        .update(updateData)
        .eq("id", projectId)
        .select()
        .limit(1);

      if (error) {
        throw new Error(`Failed to update GitHub info: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error(`No project updated for ID: ${projectId}`);
      }

      console.log(`✅ Updated GitHub info for project ${projectId} (${existingProjects.length} duplicate records found)`);
      return data[0] as unknown as ProjectRow;
    }

    // Стандартный случай - одна запись
    const { data, error } = await this.client
      .from("projects")
      .update(updateData)
      .eq("id", projectId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update GitHub info: ${error.message}`);
    }

    return data as unknown as ProjectRow;
  }

  /**
   * Получить проекты по GitHub репозиторию
   */
  async getProjectByGitHubRepo(
    repoName: string,
    owner: string = "shipvibes"
  ): Promise<ProjectRow | null> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("github_repo_name", repoName)
      .eq("github_owner", owner)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Проект не найден
      }
      throw new Error(`Failed to fetch project by GitHub repo: ${error.message}`);
    }

    return data as unknown as ProjectRow;
  }

  /**
   * Получить все проекты с настроенным GitHub репозиторием
   */
  async getProjectsWithGitHub(): Promise<ProjectRow[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .not("github_repo_url", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch projects with GitHub: ${error.message}`);
    }

    return (data as unknown as ProjectRow[]) || [];
  }
}
