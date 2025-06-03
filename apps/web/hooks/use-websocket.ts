"use client";

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  projectId: string;
  onFileTracked?: (data: any) => void;
  onSaveSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useWebSocket({ 
  projectId, 
  onFileTracked, 
  onSaveSuccess, 
  onError 
}: UseWebSocketOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const connectSocket = () => {
      const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080', {
        transports: ['websocket'],
        autoConnect: true,
        timeout: 5000,
      });

      newSocket.on('connect', () => {
        console.log('🔗 WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        
        // Аутентификация при подключении
        newSocket.emit('authenticate', { projectId });
      });

      newSocket.on('authenticated', (data) => {
        console.log('🔐 WebSocket authenticated for project:', data.projectId);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ WebSocket disconnected:', reason);
        setIsConnected(false);
        
        // Автоматическое переподключение
        if (reason === 'io server disconnect') {
          // Сервер отключил соединение, переподключаемся
          setTimeout(() => {
            if (reconnectAttempts.current < maxReconnectAttempts) {
              reconnectAttempts.current++;
              newSocket.connect();
            }
          }, 1000 * reconnectAttempts.current);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        setConnectionError('Failed to connect to server');
        setIsConnected(false);
      });

      // Обработчики событий файлов
      newSocket.on('file_tracked', (data) => {
        console.log('📝 File tracked:', data);
        onFileTracked?.(data);
      });

      newSocket.on('save_success', (data) => {
        console.log('💾 Save successful:', data);
        onSaveSuccess?.(data);
      });

      newSocket.on('file_updated', (data) => {
        console.log('🔄 File updated by another user:', data);
        // Можно использовать для показа уведомлений о изменениях от других пользователей
      });

      newSocket.on('files_saved', (data) => {
        console.log('💾 Files saved by another user:', data);
        // Можно использовать для обновления UI когда другой пользователь сохранил файлы
      });

      newSocket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        onError?.(error);
      });

      setSocket(newSocket);
    };

    connectSocket();

    // Cleanup при размонтировании
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [projectId]);

  // Методы для отправки событий
  const saveAllChanges = (commitMessage?: string) => {
    if (socket && isConnected) {
      socket.emit('save_all_changes', { 
        projectId, 
        commitMessage 
      });
    } else {
      console.error('❌ Cannot save: WebSocket not connected');
      onError?.({ message: 'Not connected to server' });
    }
  };

  return {
    socket,
    isConnected,
    connectionError,
    saveAllChanges,
  };
} 