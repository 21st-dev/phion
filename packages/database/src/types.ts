// Database schema types
export interface Database {
  public: {
    Tables: {
      projects: {
        Row: ProjectRow
        Insert: ProjectInsert
        Update: ProjectUpdate
      }
      file_history: {
        Row: FileHistoryRow
        Insert: FileHistoryInsert
        Update: FileHistoryUpdate
      }
      commit_history: {
        Row: CommitHistoryRow
        Insert: CommitHistoryInsert
        Update: CommitHistoryUpdate
      }
      pending_changes: {
        Row: PendingChangeRow
        Insert: PendingChangeInsert
        Update: PendingChangeUpdate
      }
    }
  }
}

// Project types
export interface ProjectRow {
  id: string
  user_id: string
  name: string
  template_type: string
  github_repo_url?: string
  github_repo_name?: string
  github_owner?: string
  netlify_url?: string
  netlify_site_id?: string
  deploy_status: "pending" | "building" | "ready" | "failed" | "cancelled"
  created_at: string
  updated_at?: string
}

export interface ProjectInsert {
  id?: string
  user_id: string
  name: string
  template_type: string
  github_repo_url?: string
  github_repo_name?: string
  github_owner?: string
  netlify_url?: string
  netlify_site_id?: string
  deploy_status?: "pending" | "building" | "ready" | "failed" | "cancelled"
  created_at?: string
  updated_at?: string
}

export interface ProjectUpdate {
  name?: string
  github_repo_url?: string
  github_repo_name?: string
  github_owner?: string
  netlify_url?: string
  netlify_site_id?: string
  deploy_status?: "pending" | "building" | "ready" | "failed" | "cancelled"
  updated_at?: string
}

// File history types
export interface FileHistoryRow {
  id: string
  project_id: string
  file_path: string
  content: string
  commit_sha?: string
  version: number
  created_at: string
  r2_object_key?: string
  content_hash?: string
  diff_text?: string
  file_size?: number
  commit_id?: string
  commit_message?: string
  github_commit_sha?: string
  github_commit_url?: string
}

export interface FileHistoryInsert {
  id?: string
  project_id: string
  file_path: string
  content: string
  commit_sha?: string
  version?: number
  created_at?: string
  r2_object_key?: string
  content_hash?: string
  diff_text?: string
  file_size?: number
  commit_id?: string
  commit_message?: string
  github_commit_sha?: string
  github_commit_url?: string
}

export interface FileHistoryUpdate {
  content?: string
  commit_sha?: string
  version?: number
  github_commit_sha?: string
  github_commit_url?: string
}

// Commit history types
export interface CommitHistoryRow {
  id: string
  project_id: string
  github_commit_sha: string
  github_commit_url: string
  commit_message: string
  files_count?: number
  committed_by?: string
  created_at: string
}

export interface CommitHistoryInsert {
  id?: string
  project_id: string
  github_commit_sha: string
  github_commit_url: string
  commit_message: string
  files_count?: number
  committed_by?: string
  created_at?: string
}

export interface CommitHistoryUpdate {
  commit_message?: string
  files_count?: number
  committed_by?: string
}

// Pending changes types
export interface PendingChangeRow {
  id: string
  project_id: string
  file_path: string
  content: string
  action: "added" | "modified" | "deleted"
  updated_at: string
}

export interface PendingChangeInsert {
  id?: string
  project_id: string
  file_path: string
  content: string
  action: "added" | "modified" | "deleted"
  updated_at?: string
}

export interface PendingChangeUpdate {
  file_path?: string
  content?: string
  action?: "added" | "modified" | "deleted"
  updated_at?: string
}

// Локальные типы для database пакета
export interface DatabaseConnection {
  connected: boolean
  url?: string
}

export interface QueryResult<T = any> {
  data: T[]
  error?: Error
  count?: number
}
