export interface VybcelConfig {
  projectId: string
  toolbar?: {
    enabled?: boolean
    position?: 'top' | 'bottom'
    autoOpen?: boolean
  }
}

export interface VybcelPluginOptions {
  configPath?: string
  websocketUrl?: string
}

export interface ToolbarState {
  pendingChanges: number
  deployStatus: 'ready' | 'building' | 'failed' | 'pending'
  agentConnected: boolean
  netlifyUrl?: string
}

export interface WebSocketEvents {
  // Outgoing events
  authenticate: { projectId: string; clientType: 'toolbar' }
  save_all_changes: void
  discard_all_changes: void
  toolbar_get_status: void

  // Incoming events
  authenticated: { success: boolean }
  file_change_staged: { file: string; action: string }
  commit_created: { commitId: string; message: string }
  deploy_status_update: { status: string; url?: string }
  save_success: void
  discard_success: void
  toolbar_status: ToolbarState
} 