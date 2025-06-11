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
        transports: ['websocket'],
        timeout: 5000
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

      this.socket.on('disconnect', () => {
        console.log('[Vybcel Toolbar] Disconnected from WebSocket server')
        this.state.agentConnected = false
        this.emit('stateChange', this.state)
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

    this.socket.on('file_change_staged', (data: { file: string; action: string }) => {
      this.state.pendingChanges += 1
      this.emit('stateChange', this.state)
    })

    this.socket.on('commit_created', (data: { commitId: string; message: string }) => {
      this.state.pendingChanges = 0
      this.emit('stateChange', this.state)
      this.emit('commitCreated', data)
    })

    this.socket.on('deploy_status_update', (data: { status: string; url?: string }) => {
      this.state.deployStatus = data.status as ToolbarState['deployStatus']
      if (data.url) {
        this.state.netlifyUrl = data.url
      }
      this.emit('stateChange', this.state)
    })

    this.socket.on('save_success', () => {
      this.state.pendingChanges = 0
      this.emit('stateChange', this.state)
      this.emit('saveSuccess')
    })

    this.socket.on('discard_success', () => {
      this.state.pendingChanges = 0
      this.emit('stateChange', this.state)
      this.emit('discardSuccess')
    })

    this.socket.on('toolbar_status', (status: ToolbarState) => {
      this.state = { ...this.state, ...status }
      this.emit('stateChange', this.state)
    })

    this.socket.on('agent_connected', () => {
      this.state.agentConnected = true
      this.emit('stateChange', this.state)
    })

    this.socket.on('agent_disconnected', () => {
      this.state.agentConnected = false
      this.emit('stateChange', this.state)
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