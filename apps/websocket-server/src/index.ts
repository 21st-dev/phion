import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import { uploadFileVersion, downloadFile } from '@shipvibes/storage';
import { getSupabaseServerClient, FileHistoryQueries } from '@shipvibes/database';
// @ts-ignore
import { diffLines } from 'diff';

const PORT = process.env.WS_PORT || 8080;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001'
];

// Создаем HTTP сервер
const httpServer = createServer();

// Создаем Socket.IO сервер
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

console.log('🚀 Starting Shipvibes WebSocket Server...');
console.log(`📡 Port: ${PORT}`);
console.log(`🌐 Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);

// Обработка подключений
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Обработка аутентификации проекта
  socket.on('authenticate', (data) => {
    const { projectId, token } = data;
    
    if (!projectId) {
      socket.emit('error', { message: 'Project ID is required' });
      return;
    }

    // Присоединяем к комнате проекта
    socket.join(`project:${projectId}`);
    socket.data.projectId = projectId;
    
    console.log(`🔐 Client ${socket.id} authenticated for project ${projectId}`);
    socket.emit('authenticated', { projectId });
  });

  // Обработка изменений файлов
  socket.on('file_change', async (data) => {
    try {
      const { projectId, filePath, content, hash, timestamp } = data;
      
      if (!projectId || !filePath || !content) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      console.log(`📝 File change: ${filePath} in project ${projectId}`);
      
      // --- Сохранение файла и истории ---
      const versionId = crypto.randomUUID();

      // Загружаем файл в R2
      await uploadFileVersion(projectId, versionId, filePath, content);

      // Получаем Supabase клиент и helper
      const supabase = getSupabaseServerClient();
      const historyQueries = new FileHistoryQueries(supabase);

      // Проверяем предыдущую версию
      const lastVersion = await historyQueries.getLatestFileVersion(projectId, filePath);

      let diffText: string | null = null;
      if (lastVersion) {
        try {
          const prevContentResult = await downloadFile(lastVersion.r2_object_key);
          const prevContent = Buffer.isBuffer(prevContentResult.content) ? prevContentResult.content.toString() : prevContentResult.content;
          diffText = diffLines(prevContent, content).map((part: any) => {
            const prefix = part.added ? '+' : part.removed ? '-' : ' ';
            return prefix + part.value;
          }).join('');
        } catch (e) {
          console.warn('Diff generation failed:', e);
        }
      } else {
        // Для первой версии файла создаем diff показывающий весь контент как добавленный
        diffText = content.split('\n').map(line => '+' + line).join('\n');
      }

      // Создаем запись в истории файлов
      await historyQueries.createFileHistory({
        project_id: projectId,
        file_path: filePath,
        r2_object_key: `projects/${projectId}/versions/${versionId}/${filePath}`,
        content_hash: hash,
        diff_text: diffText || undefined,
        file_size: Buffer.byteLength(content, 'utf-8'),
      });
       
      // Уведомляем клиента об успешном сохранении
      socket.emit('file_saved', {
        filePath,
        timestamp: Date.now(),
        status: 'saved'
      });

      // Уведомляем других клиентов в той же комнате
      socket.to(`project:${projectId}`).emit('file_updated', {
        filePath,
        timestamp: Date.now(),
        updatedBy: socket.id
      });

    } catch (error) {
      console.error('❌ Error handling file change:', error);
      socket.emit('error', { message: 'Failed to save file' });
    }
  });

  // Обработка удаления файлов
  socket.on('file_delete', async (data) => {
    try {
      const { projectId, filePath, timestamp } = data;
      
      if (!projectId || !filePath) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      console.log(`🗑️ File delete: ${filePath} in project ${projectId}`);
      
      // TODO: Отметить файл как удаленный в file_history
      
      // Уведомляем клиента об успешном удалении
      socket.emit('file_deleted', {
        filePath,
        timestamp: Date.now(),
        status: 'deleted'
      });

      // Уведомляем других клиентов в той же комнате
      socket.to(`project:${projectId}`).emit('file_removed', {
        filePath,
        timestamp: Date.now(),
        removedBy: socket.id
      });

    } catch (error) {
      console.error('❌ Error handling file delete:', error);
      socket.emit('error', { message: 'Failed to delete file' });
    }
  });

  // Обработка отключения
  socket.on('disconnect', (reason) => {
    console.log(`❌ Client disconnected: ${socket.id} (${reason})`);
    
    if (socket.data.projectId) {
      // Уведомляем других клиентов в комнате
      socket.to(`project:${socket.data.projectId}`).emit('client_disconnected', {
        clientId: socket.id,
        timestamp: Date.now()
      });
    }
  });

  // Обработка ошибок
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
});

// Запускаем сервер
httpServer.listen(PORT, () => {
  console.log(`✅ WebSocket server running on port ${PORT}`);
  console.log(`🔗 Connect to: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  io.close(() => {
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  io.close(() => {
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}); 