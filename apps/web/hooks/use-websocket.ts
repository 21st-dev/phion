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
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
      
      // Аутентификация при подключении
      newSocket.emit('authenticate', { 
        projectId,
        clientType: 'web'
      });
    });

    newSocket.on('authenticated', (data) => {
      // Молча обрабатываем аутентификацию
    });

    newSocket.on('disconnect', (reason) => {
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

    newSocket.on('connect_error', () => {
      setConnectionError('Failed to connect to server');
      setIsConnected(false);
    });

    // Обработчики событий файлов
    if (onFileTracked) {
      newSocket.on('file_tracked', onFileTracked);
    }

    if (onSaveSuccess) {
      newSocket.on('save_success', onSaveSuccess);
    }

    if (onAgentConnected) {
      newSocket.on('agent_connected', onAgentConnected);
    }

    if (onAgentDisconnected) {
      newSocket.on('agent_disconnected', onAgentDisconnected);
    }

    if (onDeployStatusUpdate) {
      newSocket.on('deploy_status_update', onDeployStatusUpdate);
    }

    newSocket.on('file_updated', (data) => {
      // Файл обновлен другим пользователем
    });

    newSocket.on('files_saved', (data) => {
      // Файлы сохранены другим пользователем
    });

    newSocket.on('error', (error) => {
      onError?.(error);
    });

    setSocket(newSocket);

    // Cleanup при размонтировании
    return () => {
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