export class FileHistoryQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     */
    async getProjectFileHistory(projectId, limit = 100, offset = 0) {
        const { data, error } = await this.client
            .from("file_history")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) {
            throw new Error(`Failed to fetch file history: ${error.message}`);
        }
        return data || [];
    }
    /**
     */
    async getFileHistory(projectId, filePath, limit = 50) {
        const { data, error } = await this.client
            .from("file_history")
            .select("*")
            .eq("project_id", projectId)
            .eq("file_path", filePath)
            .order("created_at", { ascending: false })
            .limit(limit);
        if (error) {
            throw new Error(`Failed to fetch file history: ${error.message}`);
        }
        return data || [];
    }
    /**
     */
    async getLatestFileVersion(projectId, filePath) {
        const { data, error } = await this.client
            .from("file_history")
            .select("*")
            .eq("project_id", projectId)
            .eq("file_path", filePath)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        if (error) {
            if (error.code === "PGRST116") {
                return null; // File not found
            }
            throw new Error(`Failed to fetch latest file version: ${error.message}`);
        }
        return data;
    }
    /**
     */
    async createFileHistory(historyData) {
        const insertData = {
            project_id: historyData.project_id,
            file_path: historyData.file_path,
            r2_object_key: historyData.r2_object_key,
            content_hash: historyData.content_hash,
            diff_text: historyData.diff_text,
            file_size: historyData.file_size,
            commit_id: historyData.commit_id,
            commit_message: historyData.commit_message,
        };
        const { data, error } = await this.client
            .from("file_history")
            .insert(insertData)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to create file history: ${error.message}`);
        }
        return data;
    }
    /**
     */
    async getFileHistoryById(id) {
        const { data, error } = await this.client
            .from("file_history")
            .select("*")
            .eq("id", id)
            .single();
        if (error) {
            if (error.code === "PGRST116") {
                return null;
            }
            throw new Error(`Failed to fetch file history by ID: ${error.message}`);
        }
        return data;
    }
    /**
     */
    async findFilesByContentHash(contentHash) {
        const { data, error } = await this.client
            .from("file_history")
            .select("*")
            .eq("content_hash", contentHash)
            .order("created_at", { ascending: false });
        if (error) {
            throw new Error(`Failed to find files by content hash: ${error.message}`);
        }
        return data || [];
    }
    /**
     */
    async getChangesBetweenVersions(projectId, fromDate, toDate) {
        const { data, error } = await this.client
            .from("file_history")
            .select("*")
            .eq("project_id", projectId)
            .gte("created_at", fromDate)
            .lte("created_at", toDate)
            .order("created_at", { ascending: true });
        if (error) {
            throw new Error(`Failed to fetch changes between versions: ${error.message}`);
        }
        return data || [];
    }
    /**
     */
    async getProjectFileStats(projectId) {
        // Get all history records for project
        const { data, error } = await this.client
            .from("file_history")
            .select("file_path, file_size, created_at");
        if (error) {
            throw new Error(`Failed to fetch project file stats: ${error.message}`);
        }
        const files = data;
        // Calculate statistics
        const uniqueFiles = new Set(files.map((f) => f.file_path));
        const totalSize = files.reduce((sum, f) => sum + f.file_size, 0);
        const lastUpdated = files.length > 0
            ? files.sort((a, b) => new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime())[0].created_at
            : null;
        return {
            total_files: uniqueFiles.size,
            total_versions: files.length,
            total_size: totalSize,
            last_updated: lastUpdated,
        };
    }
    /**
     */
    async getLatestFileVersions(projectId) {
        const { data, error } = await this.client
            .from("file_history")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false });
        if (error) {
            throw new Error(`Failed to fetch latest file versions: ${error.message}`);
        }
        // Group by file_path and take latest version of each file
        const latestVersionsMap = new Map();
        for (const file of data || []) {
            const existing = latestVersionsMap.get(file.file_path);
            if (!existing ||
                (file.created_at && existing.created_at && new Date(file.created_at) > new Date(existing.created_at)) ||
                (file.created_at && !existing.created_at)) {
                latestVersionsMap.set(file.file_path, file);
            }
        }
        return Array.from(latestVersionsMap.values());
    }
    /**
     */
    async createFileHistoryWithGitHub(historyData) {
        const insertData = {
            project_id: historyData.project_id,
            file_path: historyData.file_path,
            r2_object_key: historyData.r2_object_key,
            content_hash: historyData.content_hash,
            diff_text: historyData.diff_text,
            file_size: historyData.file_size,
            commit_id: historyData.commit_id,
            commit_message: historyData.commit_message,
            github_commit_sha: historyData.github_commit_sha,
            github_commit_url: historyData.github_commit_url,
        };
        const { data, error } = await this.client
            .from("file_history")
            .insert(insertData)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to create file history with GitHub: ${error.message}`);
        }
        return data;
    }
    /**
     */
    async updateGitHubInfo(fileHistoryId, githubInfo) {
        const updateData = {
            github_commit_sha: githubInfo.github_commit_sha,
            github_commit_url: githubInfo.github_commit_url,
        };
        const { data, error } = await this.client
            .from("file_history")
            .update(updateData)
            .eq("id", fileHistoryId)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to update GitHub info: ${error.message}`);
        }
        return data;
    }
    /**
     */
    async getFilesByGitHubCommit(projectId, githubCommitSha) {
        const { data, error } = await this.client
            .from("file_history")
            .select("*")
            .eq("project_id", projectId)
            .eq("github_commit_sha", githubCommitSha)
            .order("file_path", { ascending: true });
        if (error) {
            throw new Error(`Failed to fetch files by GitHub commit: ${error.message}`);
        }
        return data || [];
    }
    /**
     */
    async getFilesWithoutGitHubInfo(projectId, limit = 100) {
        let query = this.client
            .from("file_history")
            .select("*")
            .is("github_commit_sha", null)
            .order("created_at", { ascending: false })
            .limit(limit);
        if (projectId) {
            query = query.eq("project_id", projectId);
        }
        const { data, error } = await query;
        if (error) {
            throw new Error(`Failed to fetch files without GitHub info: ${error.message}`);
        }
        return data || [];
    }
}
