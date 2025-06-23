export interface PhionConfig {
  projectId: string
  wsUrl?: string
  debug?: boolean
  toolbar?: {
    enabled?: boolean
    position?: "top" | "bottom"
    autoOpen?: boolean
    autoUpdate?: boolean
    updateChannel?: "stable" | "beta" | "dev"
  }
  autoSync?: boolean
  autoStart?: "first" | "always" | "never"
}

export interface PhionPluginOptions {
  configPath?: string
  websocketUrl?: string
  toolbarUrl?: string
  debug?: boolean
  enabled?: boolean
  autoUpdateToolbar?: boolean
  autoUpdate?: boolean
  updateEndpoint?: string
}

export interface Project {
  id: string
  name: string
  template_type: string
  github_repo_url?: string
  github_repo_name?: string
  github_owner?: string
  netlify_url?: string
  deploy_status: "pending" | "building" | "ready" | "failed"
  created_at: string
  updated_at?: string
}

export interface PendingChange {
  id: string
  project_id: string
  file_path: string
  content: string
  action: "added" | "modified" | "deleted"
  updated_at: string
}

export interface CommitInfo {
  id: string
  sha: string
  message: string
  url: string
  filesCount: number
  createdAt: string
  committedBy: string
}

export interface ToolbarState {
  pendingChanges: number
  deployStatus: "ready" | "building" | "failed" | "pending"
  agentConnected: boolean
  netlifyUrl?: string
  lastCommit?: CommitInfo
  commitHistory?: CommitInfo[]
}

export interface WebSocketEvents {
  // Outgoing events
  authenticate: { projectId: string; clientType: "toolbar" }
  save_all_changes: void
  discard_all_changes: void
  toolbar_get_status: void
  toolbar_get_commit_history: { limit?: number; offset?: number }
  toolbar_save_with_ai_message: { projectId: string }
  toolbar_revert_to_commit: { projectId: string; targetCommitSha: string; commitMessage?: string }
  toolbar_runtime_error: RuntimeErrorPayload
  insert_prompt: { projectId: string; prompt: string }

  // Incoming events
  authenticated: { success: boolean }
  file_change_staged: { file: string; action: string; changedFiles?: string[] }
  commit_created: { commitId: string; message: string; commit: CommitInfo }
  deploy_status_update: { status: string; url?: string }
  save_success: void
  discard_success: void
  toolbar_status: ToolbarState
  commit_history_response: { commits: CommitInfo[]; stats: any; pagination: any }
  revert_progress: {
    projectId: string
    stage: string
    progress: number
    message: string
    error?: string
  }
  ai_commit_message_generated: {
    projectId: string
    commitMessage: string
    changesCount: number
    files: string[]
  }
  runtime_error_received: { success: boolean; errorId?: string }
}

export interface RuntimeErrorPayload {
  projectId: string
  clientType: "toolbar"
  timestamp: number
  url: string
  userAgent: string
  error: {
    message: string
    stack?: string
    fileName?: string
    lineNumber?: number
    columnNumber?: number
    source?: string
  }
  context: {
    toolbarVersion?: string
    browserInfo?: {
      language: string
      platform: string
      cookieEnabled: boolean
      onLine: boolean
    }
    pageInfo?: {
      title: string
      referrer: string
      pathname: string
    }
  }
}

export interface ToolbarVersion {
  version: string
  url: string
  checksum?: string
}

export interface UpdateCheckResponse {
  hasUpdate: boolean
  latestVersion?: ToolbarVersion
  currentVersion: string
}
