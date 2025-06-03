import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  onAgentConnected?: (data: { projectId: string; clientId: string; timestamp: string }) => void;
  onDeployStatusUpdate?: (data: { 
    projectId: string; 
    deployStatusId: string; 
    status: string; 
    message: string; 
    timestamp: string 
  }) => void;
  onFileTracked?: (data: { filePath: string; action: string; timestamp: number; status: string }) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const { onAgentConnected, onDeployStatusUpdate, onFileTracked } = options;

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return socketRef.current;
    }

    console.log('🔗 Connecting to WebSocket server...');
    
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080', {
      transports: ['websocket'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
    });

    socket.on('disconnect', (reason) => {
      console.log(`❌ Disconnected from WebSocket: ${reason}`);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    // Event listeners
    if (onAgentConnected) {
      socket.on('agent_connected', onAgentConnected);
    }

    if (onDeployStatusUpdate) {
      socket.on('deploy_status_update', onDeployStatusUpdate);
    }

    if (onFileTracked) {
      socket.on('file_tracked', onFileTracked);
    }

    socketRef.current = socket;
    return socket;
  }, [onAgentConnected, onDeployStatusUpdate, onFileTracked]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Disconnecting from WebSocket server...');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false
  };
} 