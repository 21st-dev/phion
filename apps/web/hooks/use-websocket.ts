"use client";

import { useEffect, useState, useRef } from 'react';
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
    deployStatusId: string; 
    status: string; 
    message: string; 
    timestamp: string 
  }) => void;
}

export function useWebSocket({ 
  projectId, 
  onFileTracked, 
  onSaveSuccess, 
  onError,
  onAgentConnected,
  onAgentDisconnected,
  onDeployStatusUpdate
}: UseWebSocketOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;

    console.log('🔌 [WebSocket] Initializing connection for project:', projectId);

    // Создаем новое подключение
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080', {
      transports: ['websocket'],
      autoConnect: true,
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      console.log('✅ [WebSocket] Connected to server');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
      
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
      
      // Автоматическое переподключение
      if (reason === 'io server disconnect') {
        setTimeout(() => {
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            newSocket.connect();
          }
        }, 1000 * reconnectAttempts.current);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ [WebSocket] Connection error:', error);
      setConnectionError('Failed to connect to server');
      setIsConnected(false);
    });

    // Обработчики событий файлов
    if (onFileTracked) {
      newSocket.on('file_tracked', (data) => {
        console.log('📝 [WebSocket] File tracked:', data);
        onFileTracked(data);
      });
    }

    if (onSaveSuccess) {
      newSocket.on('save_success', (data) => {
        console.log('💾 [WebSocket] Save success:', data);
        onSaveSuccess(data);
      });
    }

    if (onAgentConnected) {
      newSocket.on('agent_connected', (data) => {
        console.log('🟢 [WebSocket] Agent connected:', data);
        onAgentConnected(data);
      });
    }

    if (onAgentDisconnected) {
      newSocket.on('agent_disconnected', (data) => {
        console.log('🔴 [WebSocket] Agent disconnected:', data);
        onAgentDisconnected(data);
      });
    }

    if (onDeployStatusUpdate) {
      newSocket.on('deploy_status_update', (data) => {
        console.log('🚀 [WebSocket] Deploy status update:', data);
        onDeployStatusUpdate(data);
      });
    }

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
      onError?.(error);
    });

    setSocket(newSocket);

    // Cleanup при размонтировании
    return () => {
      console.log('🛑 [WebSocket] Disconnecting...');
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [projectId]); // Только projectId в зависимостях

  // Методы для отправки событий
  const saveAllChanges = (commitMessage?: string) => {
    if (socket && isConnected) {
      socket.emit('save_all_changes', { 
        projectId, 
        commitMessage 
      });
    } else {
      onError?.({ message: 'Not connected to server' });
    }
  };

  return {
    socket,
    isConnected,
    connectionError,
    saveAllChanges,
    disconnect,
  };
} 