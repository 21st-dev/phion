import { SupabaseClient } from "@supabase/supabase-js";
import {
  Database,
  CommitHistoryRow,
  CommitHistoryInsert,
  CommitHistoryUpdate,
} from "../types";

export interface CreateCommitHistory {
  project_id: string;
  github_commit_sha: string;
  github_commit_url: string;
  commit_message: string;
  files_count?: number;
  committed_by?: string;
}

export class CommitHistoryQueries {
  constructor(private client: SupabaseClient<Database>) {}

  /**
   * Получить историю коммитов проекта
   */
  async getProjectCommitHistory(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CommitHistoryRow[]> {
    const { data, error } = await this.client
      .from("commit_history")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch commit history: ${error.message}`);
    }

    return (data as unknown as CommitHistoryRow[]) || [];
  }

  /**
   * Создать запись о коммите
   */
  async createCommitHistory(
    commitData: CreateCommitHistory
  ): Promise<CommitHistoryRow> {
    const insertData: CommitHistoryInsert = {
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

    return data as unknown as CommitHistoryRow;
  }

  /**
   * Получить коммит по SHA
   */
  async getCommitBySha(
    projectId: string,
    githubCommitSha: string
  ): Promise<CommitHistoryRow | null> {
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

    return data as unknown as CommitHistoryRow;
  }

  /**
   * Получить последний коммит проекта
   */
  async getLatestCommit(projectId: string): Promise<CommitHistoryRow | null> {
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

    return data as unknown as CommitHistoryRow;
  }

  /**
   * Получить статистику коммитов проекта
   */
  async getCommitStats(projectId: string): Promise<{
    total_commits: number;
    total_files_changed: number;
    first_commit: string | null;
    last_commit: string | null;
  }> {
    const { data, error } = await this.client
      .from("commit_history")
      .select("files_count, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch commit stats: ${error.message}`);
    }

    const commits = data as unknown as Array<{
      files_count: number | null;
      created_at: string | null;
    }>;

    const totalCommits = commits.length;
    const totalFilesChanged = commits.reduce(
      (sum, commit) => sum + (commit.files_count || 0),
      0
    );
    const firstCommit = commits.length > 0 ? commits[0].created_at : null;
    const lastCommit =
      commits.length > 0 ? commits[commits.length - 1].created_at : null;

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
  async deleteCommit(commitId: string): Promise<void> {
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
  async getCommitsByDateRange(
    projectId: string,
    fromDate: string,
    toDate: string
  ): Promise<CommitHistoryRow[]> {
    const { data, error } = await this.client
      .from("commit_history")
      .select("*")
      .eq("project_id", projectId)
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(
        `Failed to fetch commits by date range: ${error.message}`
      );
    }

    return (data as unknown as CommitHistoryRow[]) || [];
  }
} 