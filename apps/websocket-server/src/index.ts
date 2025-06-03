import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import express from 'express';
import { uploadFileVersion, downloadFile } from '@shipvibes/storage';
import { getSupabaseServerClient, FileHistoryQueries, ProjectQueries, PendingChangesQueries } from '@shipvibes/database';
import { NetlifyService } from './services/netlify.js';
// @ts-ignore
import { diffLines } from 'diff';

const PORT = process.env.WS_PORT || 8080;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001'
];

// Создаем Express app
const app = express();

// Middleware
app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json());

// Создаем HTTP сервер с Express
const httpServer = createServer(app);

// Создаем Socket.IO сервер
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Создаем экземпляр NetlifyService
const netlifyService = new NetlifyService();

// HTTP API endpoints
app.post('/api/deploy', async (req, res) => {
  try {
    const { projectId, commitId, action } = req.body;
    
    if (!projectId || action !== 'deploy') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request. ProjectId and action=deploy required.' 
      });
    }

    console.log(`🚀 HTTP Deploy request received for project: ${projectId}, commit: ${commitId || 'latest'}`);
    
    // Запускаем деплой асинхронно с commitId
    if (commitId) {
      triggerDeploy(projectId, commitId).catch(error => {
        console.error(`❌ Deploy failed for project ${projectId}:`, error);
      });
    } else {
      // Для backward compatibility - создаем снапшот и потом деплоим
      saveFullProjectSnapshot(projectId, 'Manual deploy via HTTP API')
        .then(newCommitId => {
          return triggerDeploy(projectId, newCommitId);
        })
        .catch(error => {
          console.error(`❌ Deploy failed for project ${projectId}:`, error);
        });
    }

    res.json({ 
      success: true, 
      message: 'Deploy triggered successfully',
      projectId,
      commitId: commitId || 'will_be_generated'
    });
    
  } catch (error) {
    console.error('❌ Error in /api/deploy:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'websocket-server' });
});

console.log('🚀 Starting Shipvibes WebSocket Server...');
console.log(`📡 Port: ${PORT}`);
console.log(`🌐 Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);

/**
 * Создать Netlify сайт для проекта если его еще нет
 */
async function ensureNetlifySite(projectId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    
    // Получаем проект из базы данных
    const project = await projectQueries.getProjectById(projectId);
    if (!project) {
      console.error(`❌ Project not found: ${projectId}`);
      return null;
    }

    // Если у проекта уже есть Netlify сайт, возвращаем его ID
    if (project.netlify_site_id) {
      return project.netlify_site_id;
    }

    // Создаем новый Netlify сайт
    console.log(`🌐 Creating Netlify site for project ${projectId}...`);
    const netlifyResponse = await netlifyService.createSite(projectId, project.name);
    
    // Обновляем проект в базе данных
    await projectQueries.updateProject(projectId, {
      netlify_site_id: netlifyResponse.id,
      netlify_url: netlifyResponse.ssl_url || netlifyResponse.url,
      deploy_status: 'ready'
    });

    console.log(`✅ Netlify site created: ${netlifyResponse.url}`);
    return netlifyResponse.id;
  } catch (error) {
    console.error(`❌ Error creating Netlify site for project ${projectId}:`, error);
    return null;
  }
}

/**
 * Запустить деплой проекта на Netlify
 */
/**
 * Сохранить полный снапшот всех файлов проекта КАК ОДИН КОММИТ
 */
async function saveFullProjectSnapshot(
  projectId: string, 
  commitMessage?: string
): Promise<string> {
  console.log(`📸 Creating full project snapshot for ${projectId}...`);
  
  const supabase = getSupabaseServerClient();
  const pendingQueries = new PendingChangesQueries(supabase);
  const historyQueries = new FileHistoryQueries(supabase);
  
  // Получаем все pending changes (изменения пользователя)
  const pendingChanges = await pendingQueries.getAllPendingChanges(projectId);
  
  if (pendingChanges.length === 0) {
    console.log(`No pending changes for project ${projectId}`);
    throw new Error('No changes to save');
  }
  
  // Получаем последние версии всех файлов из истории для полного снапшота
  const latestFiles = await historyQueries.getProjectFileHistory(projectId, 1000);
  
  // Создаем карту последних файлов
  const latestFileMap = new Map();
  for (const file of latestFiles) {
    const existing = latestFileMap.get(file.file_path);
    if (!existing || new Date(file.created_at) > new Date(existing.created_at)) {
      latestFileMap.set(file.file_path, file);
    }
  }
  
  // Создаем полный снапшот: начинаем с существующих файлов + применяем изменения
  const fullSnapshot = new Map<string, any>();
  
  // 1. Добавляем все существующие файлы
  for (const [filePath, fileRecord] of latestFileMap) {
    try {
      const content = await downloadFile(fileRecord.r2_object_key);
      const fileContent = Buffer.isBuffer(content.content) 
        ? content.content.toString() 
        : content.content;
      
      fullSnapshot.set(filePath, {
        content: fileContent,
        hash: fileRecord.content_hash,
        size: fileRecord.file_size,
        action: 'unchanged'
      });
    } catch (error) {
      console.warn(`⚠️ Could not load existing file ${filePath}:`, error);
    }
  }
  
  // 2. Применяем pending changes
  const changedFiles: string[] = [];
  for (const change of pendingChanges) {
    changedFiles.push(`${change.action}: ${change.file_path}`);
    
    if (change.action === 'deleted') {
      fullSnapshot.delete(change.file_path);
    } else {
      fullSnapshot.set(change.file_path, {
        content: change.content,
        hash: change.content_hash,
        size: change.file_size,
        action: change.action
      });
    }
  }
  
  const finalCommitMessage = commitMessage || `Updated ${pendingChanges.length} files: ${changedFiles.join(', ')}`;
  console.log(`📄 Saving commit: ${finalCommitMessage}`);
  console.log(`📄 Full snapshot contains ${fullSnapshot.size} files`);
  
  // 3. Сохраняем ВСЕ файлы как один коммит
  const commitId = crypto.randomUUID();
  
  // Bulk upload всех файлов в R2
  const uploadPromises = [];
  for (const [filePath, fileData] of fullSnapshot) {
    uploadPromises.push(
      uploadFileVersion(projectId, commitId, filePath, fileData.content)
    );
  }
  await Promise.all(uploadPromises);
  
  // Bulk создание записей в file_history
  const historyRecords = [];
  for (const [filePath, fileData] of fullSnapshot) {
    historyRecords.push({
      project_id: projectId,
      file_path: filePath,
      r2_object_key: `projects/${projectId}/versions/${commitId}/${filePath}`,
      content_hash: fileData.hash,
      file_size: fileData.size,
      commit_id: commitId,
      commit_message: finalCommitMessage
    });
  }
  
  // Создаем все записи одним запросом
  for (const record of historyRecords) {
    await historyQueries.createFileHistory(record);
  }
  
  // 4. Очищаем pending changes
  await pendingQueries.clearAllPendingChanges(projectId);
  
  console.log(`✅ Full project snapshot saved as commit ${commitId}: ${finalCommitMessage}`);
  return commitId;
}

async function triggerDeploy(projectId: string, commitId: string): Promise<void> {
  try {
    // Убеждаемся что у проекта есть Netlify сайт
    const siteId = await ensureNetlifySite(projectId);
    if (!siteId) {
      console.error(`❌ Cannot deploy project ${projectId}: no Netlify site`);
      return;
    }

    console.log(`🚀 Triggering deploy for project ${projectId} (site: ${siteId})...`);
    
    // Обновляем статус деплоя
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    await projectQueries.updateProject(projectId, {
      deploy_status: 'building'
    });

    // Создаем NetlifyService с передачей io для real-time обновлений
    const netlifyServiceWithIo = new NetlifyService(io);
    
    // Запускаем деплой
    const deployResponse = await netlifyServiceWithIo.deployProject(siteId, projectId, commitId);
    
    // Обновляем статус деплоя (автоматическая проверка статуса запустится в NetlifyService)
    await projectQueries.updateProject(projectId, {
      deploy_status: 'building',
      netlify_url: deployResponse.deploy_url,
      netlify_deploy_id: deployResponse.id
    });

    console.log(`✅ Deploy initiated for project ${projectId}: ${deployResponse.deploy_url}`);
  } catch (error) {
    console.error(`❌ Error deploying project ${projectId}:`, error);
    
    // Обновляем статус деплоя как failed
    try {
      const supabase = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabase);
      await projectQueries.updateProject(projectId, {
        deploy_status: 'failed'
      });
    } catch (updateError) {
      console.error('❌ Error updating deploy status:', updateError);
    }
  }
}

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
    
    // Уведомляем всех клиентов о подключении агента (для онбординга)
    io.emit('agent_connected', {
      projectId,
      clientId: socket.id,
      timestamp: new Date().toISOString()
    });
    
    console.log(`📡 Emitted agent_connected event for project ${projectId}`);
  });

  // Обработка изменений файлов (TRACKING ТОЛЬКО)
  socket.on('file_change', async (data) => {
    try {
      const { projectId, filePath, content, hash, timestamp } = data;
      
      if (!projectId || !filePath || content === undefined) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      console.log(`📝 File change tracked: ${filePath} in project ${projectId}`);
      
      // НОВАЯ ЛОГИКА: сохраняем в pending_changes (НЕ в file_history)
      const supabase = getSupabaseServerClient();
      const pendingQueries = new PendingChangesQueries(supabase);
      const historyQueries = new FileHistoryQueries(supabase);

      // Определяем действие (modified/added)
      const existingChange = await pendingQueries.getPendingChange(projectId, filePath);
      const lastVersion = await historyQueries.getLatestFileVersion(projectId, filePath);
      
      let action: 'modified' | 'added' = 'added';
      if (existingChange || lastVersion) {
        action = 'modified';
      }

      // Сохраняем pending change
      await pendingQueries.upsertPendingChange({
        project_id: projectId,
        file_path: filePath,
        content: content,
        action: action,
        content_hash: hash,
        file_size: Buffer.byteLength(content, 'utf-8'),
      });

      // Уведомляем клиента о tracking (БЕЗ деплоя)
      socket.emit('file_tracked', {
        filePath,
        action,
        timestamp: Date.now(),
        status: 'tracked'
      });

      // Уведомляем других клиентов
      socket.to(`project:${projectId}`).emit('file_updated', {
        filePath,
        action,
        timestamp: Date.now(),
        updatedBy: socket.id,
        isPending: true
      });

    } catch (error) {
      console.error('❌ Error tracking file change:', error);
      socket.emit('error', { message: 'Failed to track file change' });
    }
  });

  // Обработка удаления файлов (TRACKING ТОЛЬКО)
  socket.on('file_delete', async (data) => {
    try {
      const { projectId, filePath, timestamp } = data;
      
      if (!projectId || !filePath) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      console.log(`🗑️ File delete tracked: ${filePath} in project ${projectId}`);
      
      // НОВАЯ ЛОГИКА: сохраняем в pending_changes как deleted
      const supabase = getSupabaseServerClient();
      const pendingQueries = new PendingChangesQueries(supabase);

      // Сохраняем pending change с action: deleted
      await pendingQueries.upsertPendingChange({
        project_id: projectId,
        file_path: filePath,
        content: '', // Пустой content для deleted файлов
        action: 'deleted',
        file_size: 0,
      });
      
      // Уведомляем клиента о tracking удаления
      socket.emit('file_tracked', {
        filePath,
        action: 'deleted',
        timestamp: Date.now(),
        status: 'tracked'
      });

      // Уведомляем других клиентов
      socket.to(`project:${projectId}`).emit('file_updated', {
        filePath,
        action: 'deleted',
        timestamp: Date.now(),
        updatedBy: socket.id,
        isPending: true
      });

    } catch (error) {
      console.error('❌ Error tracking file delete:', error);
      socket.emit('error', { message: 'Failed to track file delete' });
    }
  });

  // НОВЫЙ HANDLER: Сохранение полного снапшота проекта
  socket.on('save_all_changes', async (data) => {
    try {
      const { projectId, commitMessage } = data;
      
      if (!projectId) {
        socket.emit('error', { message: 'Missing projectId' });
        return;
      }

      console.log(`💾 Saving all changes for project ${projectId}`);
      
      const commitId = await saveFullProjectSnapshot(projectId, commitMessage);

      // Уведомляем о successful save
      socket.emit('save_success', {
        commitId,
        timestamp: Date.now()
      });

      // Триггерим деплой ТОЛЬКО после сохранения
      console.log(`🚀 Triggering deploy after save for project ${projectId}`);
      triggerDeploy(projectId, commitId).catch(error => {
        console.error(`❌ Deploy failed for project ${projectId}:`, error);
      });

    } catch (error) {
      console.error('❌ Error saving changes:', error);
      socket.emit('error', { message: 'Failed to save changes' });
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
  
  // Проверяем статус всех активных деплоев при старте сервера
  setTimeout(() => {
    netlifyService.checkAllActiveDeployments().catch(error => {
      console.error('❌ Error checking active deployments on startup:', error);
    });
  }, 2000); // Ждем 2 секунды после старта
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