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

export interface ToolbarState {
  pendingChanges: number
  deployStatus: "ready" | "building" | "failed" | "pending"
  agentConnected: boolean
  netlifyUrl?: string
}

export interface WebSocketEvents {
  // Outgoing events
  authenticate: { projectId: string; clientType: "toolbar" }
  save_all_changes: void
  discard_all_changes: void
  toolbar_get_status: void

  // Incoming events
  authenticated: { success: boolean }
  file_change_staged: { file: string; action: string; changedFiles?: string[] }
  commit_created: { commitId: string; message: string }
  deploy_status_update: { status: string; url?: string }
  save_success: void
  discard_success: void
  toolbar_status: ToolbarState
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
