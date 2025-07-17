export class ProjectQueries {
  client;
  constructor(client) {
    this.client = client;
  }
  /**
   * Получить все проекты (только для admin/service role)
   */
  async getAllProjects() {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }
    return data || [];
  }
  /**
   * Получить проекты пользователя (работает с RLS)
   */
  async getUserProjects(userId) {
    let query = this.client
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    // If userId is provided (for service role), filter by it
    if (userId) {
      query = query.eq("user_id", userId);
    }
    // Otherwise RLS will automatically filter by current user
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch user projects: ${error.message}`);
    }
    return data || [];
  }
  /**
   * Получить проект по ID
   */
  async getProjectById(projectId) {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        return null; // Project not found
      }
      throw new Error(`Failed to fetch project: ${error.message}`);
    }
    return data;
  }
  /**
   * Создать новый проект
   */
  async createProject(projectData) {
    const insertData = {
      name: projectData.name || `Project ${Date.now()}`,
      template_type: projectData.template_type || "vite-react",
      deploy_status: "pending",
      user_id: projectData.user_id, // Add user_id
    };
    const { data, error } = await this.client
      .from("projects")
      .insert(insertData)
      .select()
      .single();
    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
    return data;
  }
  /**
   * Обновить проект
   */
  async updateProject(projectId, updateData) {
    const { data, error } = await this.client
      .from("projects")
      .update(updateData)
      .eq("id", projectId)
      .select()
      .single();
    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }
    return data;
  }
  /**
   * Удалить проект
   */
  async deleteProject(projectId) {
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
  async updateDeployStatus(projectId, status, netlifyUrl, netlifyId) {
    const updateData = {
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
    return data;
  }
  /**
   * Получить проекты с определенным статусом деплоя
   */
  async getProjectsByDeployStatus(status) {
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
    return data || [];
  }
  /**
   * Поиск проектов по имени
   */
  async searchProjects(searchTerm) {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .ilike("name", `%${searchTerm}%`)
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to search projects: ${error.message}`);
    }
    return data || [];
  }
  /**
   * Поиск проектов пользователя по имени
   */
  async searchUserProjects(searchTerm, userId) {
    let query = this.client
      .from("projects")
      .select("*")
      .ilike("name", `%${searchTerm}%`)
      .order("created_at", { ascending: false });
    // If userId is provided (for service role), filter by it
    if (userId) {
      query = query.eq("user_id", userId);
    }
    // Otherwise RLS will automatically filter by current user
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to search user projects: ${error.message}`);
    }
    return data || [];
  }
  /**
   * Обновить GitHub информацию проекта
   */
  async updateGitHubInfo(projectId, githubInfo) {
    const updateData = {
      github_repo_url: githubInfo.github_repo_url,
      github_repo_name: githubInfo.github_repo_name,
      github_owner: githubInfo.github_owner || "phion-dev",
    };

    // First check how many records with this ID exist
    const { data: existingProjects, error: checkError } = await this.client
      .from("projects")
      .select("id")
      .eq("id", projectId);

    if (checkError) {
      throw new Error(
        `Failed to check project existence: ${checkError.message}`
      );
    }

    if (!existingProjects || existingProjects.length === 0) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (existingProjects.length > 1) {
      console.error(
        `⚠️ Multiple projects found with ID ${projectId}:`,
        existingProjects.length
      );

      // If there are duplicates, update all records but return the first one
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

      console.log(
        `✅ Updated GitHub info for project ${projectId} (${existingProjects.length} duplicate records found)`
      );
      return data[0];
    }

    // Standard case - one record
    const { data, error } = await this.client
      .from("projects")
      .update(updateData)
      .eq("id", projectId)
      .select()
      .single();
    if (error) {
      throw new Error(`Failed to update GitHub info: ${error.message}`);
    }
    return data;
  }
  /**
   * Получить проекты по GitHub репозиторию
   */
  async getProjectByGitHubRepo(repoName, owner = "phion-dev") {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("github_repo_name", repoName)
      .eq("github_owner", owner)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        return null; // Project not found
      }
      throw new Error(
        `Failed to fetch project by GitHub repo: ${error.message}`
      );
    }
    return data;
  }
  /**
   * Получить все проекты с настроенным GitHub репозиторием
   */
  async getProjectsWithGitHub() {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .not("github_repo_url", "is", null)
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to fetch projects with GitHub: ${error.message}`);
    }
    return data || [];
  }
}
