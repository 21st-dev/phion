import { io, Socket } from 'socket.io-client'
import type { ToolbarState, WebSocketEvents } from '../types'

export class ToolbarWebSocketClient {
  private socket: Socket | null = null
  private projectId: string
  private websocketUrl: string
  private listeners: Map<string, Function[]> = new Map()
  private state: ToolbarState = {
    pendingChanges: 0,
    deployStatus: 'ready',
    agentConnected: false,
    netlifyUrl: undefined
  }

  constructor(projectId: string, websocketUrl: string) {
    this.projectId = projectId
    this.websocketUrl = websocketUrl
  }

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      this.socket = io(this.websocketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 30000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.5,
        
        upgrade: true,
        rememberUpgrade: true,
        
        auth: {
          projectId: this.projectId,
        }
      })

      this.socket.on('connect', () => {
        console.log('[Vybcel Toolbar] Connected to WebSocket server')
        this.authenticate()
      })

      this.socket.on('authenticated', (data: { success: boolean }) => {
        if (data.success) {
          console.log('[Vybcel Toolbar] Authenticated successfully')
          this.setupEventListeners()
          this.requestStatus()
          resolve(true)
        } else {
          console.error('[Vybcel Toolbar] Authentication failed')
          resolve(false)
        }
      })

      this.socket.on('connect_error', (error) => {
        console.error('[Vybcel Toolbar] Connection error:', error)
        resolve(false)
      })

      this.socket.on('disconnect', (reason: string) => {
        console.log(`[Vybcel Toolbar] Disconnected from WebSocket server: ${reason}`)
        
        // 📊 ENHANCED DISCONNECT HANDLING
        const clientInitiated = ['io client disconnect', 'client namespace disconnect'];
        
        this.state = {
          ...this.state,
          agentConnected: false
        }
        this.emit('stateChange', this.state)
        
        // Log disconnect reason for debugging
        if (!clientInitiated.includes(reason)) {
          console.log(`[Vybcel Toolbar] Unexpected disconnect: ${reason}`)
        }
      })
    })
  }

  private authenticate() {
    if (this.socket) {
      this.socket.emit('authenticate', {
        projectId: this.projectId,
        clientType: 'toolbar'
      })
    }
  }

  private setupEventListeners() {
    if (!this.socket) return

    const processedFiles = new Set<string>()

    this.socket.on('file_change_staged', (data: { file?: string; filePath?: string; action: string; timestamp?: number }) => {
      console.log('[Vybcel Toolbar] File change staged:', data)
      
      const filePath = data.filePath || data.file || 'unknown'
      const changeKey = `${filePath}:${data.timestamp || Date.now()}`
      
      if (processedFiles.has(changeKey)) {
        console.log('[Vybcel Toolbar] Skipping duplicate file change:', changeKey)
        return
      }
      
      processedFiles.add(changeKey)
      
      if (processedFiles.size > 100) {
        const entries = Array.from(processedFiles)
        entries.slice(0, 50).forEach(key => processedFiles.delete(key))
      }
      
      this.state = {
        ...this.state,
        pendingChanges: this.state.pendingChanges + 1
      }
      this.emit('stateChange', this.state)
    })

    this.socket.on('commit_created', (data: { commitId: string; message: string }) => {
      this.state = {
        ...this.state,
        pendingChanges: 0
      }
      this.emit('stateChange', this.state)
      this.emit('commitCreated', data)
    })

    this.socket.on('deploy_status_update', (data: { status: string; url?: string }) => {
      this.state = {
        ...this.state,
        deployStatus: data.status as ToolbarState['deployStatus'],
        netlifyUrl: data.url || this.state.netlifyUrl
      }
      this.emit('stateChange', this.state)
    })

    this.socket.on('save_success', () => {
      console.log('[Vybcel Toolbar] Save success')
      this.state = {
        ...this.state,
        pendingChanges: 0
      }
      this.emit('stateChange', this.state)
      this.emit('saveSuccess')
    })

    this.socket.on('discard_success', () => {
      console.log('[Vybcel Toolbar] Discard success')
      this.state = {
        ...this.state,
        pendingChanges: 0
      }
      this.emit('stateChange', this.state)
      this.emit('discardSuccess')
    })

    this.socket.on('toolbar_status', (status: ToolbarState) => {
      console.log('[Vybcel Toolbar] Status update:', status)
      this.state = { ...this.state, ...status }
      this.emit('stateChange', this.state)
    })

    this.socket.on('agent_connected', () => {
      this.state = {
        ...this.state,
        agentConnected: true
      }
      this.emit('stateChange', this.state)
    })

    this.socket.on('agent_disconnected', () => {
      this.state = {
        ...this.state,
        agentConnected: false
      }
      this.emit('stateChange', this.state)
    })

    this.socket.on('toolbar_update_available', (data: { 
      version: string; 
      forceUpdate?: boolean; 
      releaseNotes?: string 
    }) => {
      console.log(`[Vybcel Toolbar] Update available: ${data.version}`)
      this.emit('updateAvailable', data)
    })

    this.socket.on('toolbar_force_update', (data: { 
      version: string; 
      reason?: string 
    }) => {
      console.log(`[Vybcel Toolbar] Force update required: ${data.version}`)
      this.emit('forceUpdate', data)
    })

    this.socket.on('toolbar_reload', (data: { reason?: string }) => {
      console.log('[Vybcel Toolbar] Reload requested from server')
      this.emit('reloadRequested', data)
    })

    this.socket.on('server_maintenance', (data: {
      message: string;
      estimatedDuration?: number;
      maintenanceStart?: string;
    }) => {
      this.emit('serverMaintenance', data)
    })

    this.socket.on('toolbar_preview_response', (data: {
      success: boolean;
      url?: string;
      error?: string;
      projectId?: string;
    }) => {
      console.log('[Vybcel Toolbar] Preview response:', data)
      this.emit('previewResponse', data)
    })
  }

  private requestStatus() {
    if (this.socket) {
      this.socket.emit('toolbar_get_status')
    }
  }

  saveAll() {
    if (this.socket) {
      this.socket.emit('save_all_changes')
    }
  }

  discardAll() {
    if (this.socket) {
      this.socket.emit('discard_all_changes')
    }
  }

  openPreview() {
    if (this.state.netlifyUrl) {
      window.open(this.state.netlifyUrl, '_blank')
    }
  }

  requestPreview() {
    if (this.socket) {
      console.log('[Vybcel Toolbar] Requesting preview via WebSocket...')
      this.socket.emit('toolbar_open_preview')
    }
  }

  checkForUpdates() {
    if (this.socket) {
      this.socket.emit('toolbar_check_updates')
    }
  }

  acknowledgeUpdate(version: string) {
    if (this.socket) {
      this.socket.emit('toolbar_update_acknowledged', { version })
    }
  }

  reportUpdateSuccess(version: string) {
    if (this.socket) {
      this.socket.emit('toolbar_update_success', { version })
    }
  }

  reportUpdateError(version: string, error: string) {
    if (this.socket) {
      this.socket.emit('toolbar_update_error', { version, error })
    }
  }

  getState(): ToolbarState {
    return { ...this.state }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(callback)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data))
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.listeners.clear()
  }
} 