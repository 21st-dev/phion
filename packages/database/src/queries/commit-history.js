export class CommitHistoryQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * Получить историю коммитов проекта
     */
    async getProjectCommitHistory(projectId, limit = 50, offset = 0) {
        const { data, error } = await this.client
            .from("commit_history")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) {
            throw new Error(`Failed to fetch commit history: ${error.message}`);
        }
        return data || [];
    }
    /**
     * Создать запись о коммите
     */
    async createCommitHistory(commitData) {
        const insertData = {
            project_id: commitData.project_id,
            github_commit_sha: commitData.github_commit_sha,
            github_commit_url: commitData.github_commit_url,
            commit_message: commitData.commit_message,
            files_count: commitData.files_count,
            committed_by: commitData.committed_by,
        };
        const { data, error } = await this.client
            .from("commit_history")
            .insert(insertData)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to create commit history: ${error.message}`);
        }
        return data;
    }
    /**
     * Получить коммит по SHA
     */
    async getCommitBySha(projectId, githubCommitSha) {
        const { data, error } = await this.client
            .from("commit_history")
            .select("*")
            .eq("project_id", projectId)
            .eq("github_commit_sha", githubCommitSha)
            .single();
        if (error) {
            if (error.code === "PGRST116") {
                return null; // Commit not found
            }
            throw new Error(`Failed to fetch commit by SHA: ${error.message}`);
        }
        return data;
    }
    /**
     * Получить последний коммит проекта
     */
    async getLatestCommit(projectId) {
        const { data, error } = await this.client
            .from("commit_history")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        if (error) {
            if (error.code === "PGRST116") {
                return null; // No commits yet
            }
            throw new Error(`Failed to fetch latest commit: ${error.message}`);
        }
        return data;
    }
    /**
     * Получить статистику коммитов проекта
     */
    async getCommitStats(projectId) {
        const { data, error } = await this.client
            .from("commit_history")
            .select("files_count, created_at")
            .eq("project_id", projectId)
            .order("created_at", { ascending: true });
        if (error) {
            throw new Error(`Failed to fetch commit stats: ${error.message}`);
        }
        const commits = data;
        const totalCommits = commits.length;
        const totalFilesChanged = commits.reduce((sum, commit) => sum + (commit.files_count || 0), 0);
        const firstCommit = commits.length > 0 ? commits[0].created_at : null;
        const lastCommit = commits.length > 0 ? commits[commits.length - 1].created_at : null;
        return {
            total_commits: totalCommits,
            total_files_changed: totalFilesChanged,
            first_commit: firstCommit,
            last_commit: lastCommit,
        };
    }
    /**
     * Удалить коммит по ID
     */
    async deleteCommit(commitId) {
        const { error } = await this.client
            .from("commit_history")
            .delete()
            .eq("id", commitId);
        if (error) {
            throw new Error(`Failed to delete commit: ${error.message}`);
        }
    }
    /**
     * Получить коммиты в диапазоне дат
     */
    async getCommitsByDateRange(projectId, fromDate, toDate) {
        const { data, error } = await this.client
            .from("commit_history")
            .select("*")
            .eq("project_id", projectId)
            .gte("created_at", fromDate)
            .lte("created_at", toDate)
            .order("created_at", { ascending: false });
        if (error) {
            throw new Error(`Failed to fetch commits by date range: ${error.message}`);
        }
        return data || [];
    }
}
