"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  projectId?: string;
  onFileTracked?: (data: any) => void;
  onSaveSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  onAgentConnected?: (data: { projectId: string; clientId: string; timestamp: string }) => void;
  onAgentDisconnected?: (data: { projectId: string; clientId: string; timestamp: string }) => void;
  onDeployStatusUpdate?: (data: { 
    projectId: string; 
    status: string; 
    url?: string; 
    error?: string;
    timestamp: string 
  }) => void;
  onInitializationProgress?: (data: {
    projectId: string;
    stage: string;
    progress: number;
    message: string;
  }) => void;
  onCommitCreated?: (data: { projectId: string; commit: any; timestamp: number }) => void;
}

export function useWebSocket({ 
  projectId, 
  onFileTracked, 
  onSaveSuccess, 
  onError,
  onAgentConnected,
  onAgentDisconnected,
  onDeployStatusUpdate,
  onInitializationProgress,
  onCommitCreated
}: UseWebSocketOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isConnecting = useRef(false);

  // Стабильные ссылки на callback функции
  const stableCallbacks = useRef({
    onFileTracked,
    onSaveSuccess,
    onError,
    onAgentConnected,
    onAgentDisconnected,
    onDeployStatusUpdate,
    onInitializationProgress,
    onCommitCreated
  });

  // Обновляем ссылки на callbacks при изменении
  useEffect(() => {
    stableCallbacks.current = {
      onFileTracked,
      onSaveSuccess,
      onError,
      onAgentConnected,
      onAgentDisconnected,
      onDeployStatusUpdate,
      onInitializationProgress,
      onCommitCreated
    };
  }, [onFileTracked, onSaveSuccess, onError, onAgentConnected, onAgentDisconnected, onDeployStatusUpdate, onInitializationProgress, onCommitCreated]);

  const disconnect = useCallback(() => {
    if (socket) {
      console.log('🛑 [WebSocket] Manually disconnecting...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      isConnecting.current = false;
    }
  }, [socket]);

  useEffect(() => {
    if (!projectId || isConnecting.current) {
      return;
    }

    console.log('🔌 [WebSocket] Initializing connection for project:', projectId);
    isConnecting.current = true;

    // Создаем новое подключение
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080', {
      transports: ['websocket'],
      autoConnect: true,
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 2000,
      forceNew: true, // Принудительно создаем новое подключение
    });

    newSocket.on('connect', () => {
      console.log('✅ [WebSocket] Connected to server');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
      isConnecting.current = false;
      
      // Аутентификация при подключении
      console.log('🔐 [WebSocket] Authenticating for project:', projectId);
      newSocket.emit('authenticate', { 
        projectId,
        clientType: 'web'
      });
    });

    newSocket.on('authenticated', (data) => {
      console.log('✅ [WebSocket] Authenticated:', data);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ [WebSocket] Disconnected:', reason);
      setIsConnected(false);
      isConnecting.current = false;
      
      // Автоматическое переподключение только при неожиданном отключении
      if (reason === 'io server disconnect' && reconnectAttempts.current < maxReconnectAttempts) {
        setTimeout(() => {
          reconnectAttempts.current++;
          console.log(`🔄 [WebSocket] Reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
          newSocket.connect();
        }, 1000 * reconnectAttempts.current);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ [WebSocket] Connection error:', error);
      setConnectionError('Failed to connect to server');
      setIsConnected(false);
      isConnecting.current = false;
    });

    // Обработчики событий файлов
    newSocket.on('file_tracked', (data) => {
      console.log('📝 [WebSocket] File tracked:', data);
      stableCallbacks.current.onFileTracked?.(data);
    });

    // Новое событие для staged изменений
    newSocket.on('file_change_staged', (data) => {
      console.log('📝 [WebSocket] File change staged received:', {
        projectId: data.projectId,
        filePath: data.filePath,
        action: data.action,
        status: data.status,
        contentLength: data.content?.length || 0
      });
      stableCallbacks.current.onFileTracked?.(data);
    });

    newSocket.on('save_success', (data) => {
      console.log('💾 [WebSocket] Save success:', data);
      stableCallbacks.current.onSaveSuccess?.(data);
    });

    // Обработчик для discard_success (очистка pending changes при откате)
    newSocket.on('discard_success', (data) => {
      console.log('🔄 [WebSocket] Discard success:', data);
      stableCallbacks.current.onSaveSuccess?.(data); // Используем тот же callback для очистки pending changes
    });

    newSocket.on('agent_connected', (data) => {
      console.log('🟢 [WebSocket] Agent connected:', data);
      stableCallbacks.current.onAgentConnected?.(data);
    });

    newSocket.on('agent_disconnected', (data) => {
      console.log('🔴 [WebSocket] Agent disconnected:', data);
      stableCallbacks.current.onAgentDisconnected?.(data);
    });

    newSocket.on('deploy_status_update', (data) => {
      console.log('🚀 [WebSocket] Deploy status update:', data);
      stableCallbacks.current.onDeployStatusUpdate?.(data);
    });

    newSocket.on('commit_created', (data) => {
      console.log('📝 [WebSocket] Commit created:', data);
      stableCallbacks.current.onCommitCreated?.(data);
    });

    newSocket.on('initialization_progress', (data) => {
      console.log('📊 [WebSocket] Initialization progress:', data);
      stableCallbacks.current.onInitializationProgress?.(data);
    });

    newSocket.on('file_updated', (data) => {
      console.log('📄 [WebSocket] File updated:', data);
      // Файл обновлен другим пользователем
    });

    newSocket.on('files_saved', (data) => {
      console.log('💾 [WebSocket] Files saved:', data);
      // Файлы сохранены другим пользователем
    });

    newSocket.on('error', (error) => {
      console.error('❌ [WebSocket] Error:', error);
      stableCallbacks.current.onError?.(error);
    });

    setSocket(newSocket);

    // Cleanup при размонтировании
    return () => {
      console.log('🛑 [WebSocket] Disconnecting...');
      isConnecting.current = false;
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [projectId]); // Только projectId в зависимостях

  // Методы для отправки событий
  const saveAllChanges = useCallback((commitMessage?: string) => {
    if (socket && isConnected) {
      socket.emit('save_all_changes', { 
        projectId, 
        commitMessage 
      });
    } else {
      stableCallbacks.current.onError?.({ message: 'Not connected to server' });
    }
  }, [socket, isConnected, projectId]);

  const discardAllChanges = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('discard_all_changes', { 
        projectId 
      });
    } else {
      stableCallbacks.current.onError?.({ message: 'Not connected to server' });
    }
  }, [socket, isConnected, projectId]);

  return {
    socket,
    isConnected,
    connectionError,
    saveAllChanges,
    discardAllChanges,
    disconnect,
  };
} 