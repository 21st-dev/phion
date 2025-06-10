import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import crypto from "crypto";
import AdmZip from "adm-zip";

// Imports для работы с базой данных и файлами
import {
  getSupabaseServerClient,
  ProjectQueries,
  PendingChangesQueries,
  FileHistoryQueries,
} from "@shipvibes/database";
import { uploadFileVersion, downloadFile, downloadProjectTemplate } from "@shipvibes/storage";
import { NetlifyService } from "./services/netlify.js";
import { projectLogger } from '@shipvibes/shared/dist/project-logger-server';

const app = express();
const httpServer = createServer(app);

// Настройка CORS для Express
app.use(
  cors({
    origin: "http://localhost:3004",
    credentials: true,
  })
);

app.use(express.json());

// Настройка Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3004",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.WEBSOCKET_PORT || 8080;

// Создаем Netlify сервис
const netlifyService = new NetlifyService(io);

// Каждые 30 секунд проверяем статусы всех активных деплоев
setInterval(() => {
  netlifyService.checkAllActiveDeployments().catch((error) => {
    console.error("❌ Error checking active deployments:", error);
  });
}, 30000);

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
      // НОВАЯ ЛОГИКА: проверяем, есть ли что деплоить перед созданием коммита
      const supabase = getSupabaseServerClient();
      const pendingQueries = new PendingChangesQueries(supabase);
      const historyQueries = new FileHistoryQueries(supabase);
      
      // Проверяем есть ли pending changes или это первый деплой
      const pendingChanges = await pendingQueries.getAllPendingChanges(projectId);
      const existingFiles = await historyQueries.getProjectFileHistory(projectId, 1);
      
      if (pendingChanges.length === 0 && existingFiles.length > 0) {
        // Нет изменений для деплоя, используем последний коммит
        const lastCommitId = existingFiles[0]?.commit_id;
        if (lastCommitId) {
          console.log(`📄 No changes to deploy, using existing commit: ${lastCommitId}`);
          triggerDeploy(projectId, lastCommitId).catch(error => {
            console.error(`❌ Deploy failed for project ${projectId}:`, error);
          });
        } else {
          console.log(`❌ No changes and no existing commits for project ${projectId}`);
          res.status(400).json({ 
            success: false, 
            error: 'No changes to deploy and no existing commits' 
          });
          return;
        }
      } else {
        // Есть изменения или это первый деплой - создаем снапшот
        saveFullProjectSnapshot(projectId, 'Manual deploy via HTTP API')
          .then(newCommitId => {
            return triggerDeploy(projectId, newCommitId);
          })
          .catch(error => {
            console.error(`❌ Deploy failed for project ${projectId}:`, error);
          });
      }
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

/**
 * Извлечь файлы из шаблона проекта и сохранить их как первый коммит
 */
async function extractAndSaveTemplateFiles(projectId: string): Promise<string> {
  console.log(`📦 Extracting template files for project ${projectId}...`);
  
  // Логируем начало извлечения шаблона
  await projectLogger.log({
    project_id: projectId,
    event_type: 'template_extracted',
    details: { action: 'starting', trigger: 'initial_deploy' },
    trigger: 'initial_deploy'
  });
  
  try {
    // Скачиваем шаблон из R2
    const templateZip = await downloadProjectTemplate(projectId);
    console.log(`✅ Downloaded template ZIP (${templateZip.length} bytes)`);
    
    // Извлекаем файлы из ZIP
    const zip = new AdmZip(templateZip);
    const zipEntries = zip.getEntries();
    
    const templateFiles: Record<string, string> = {};
    
    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        const content = entry.getData().toString('utf8');
        templateFiles[entry.entryName] = content;
        console.log(`📄 Extracted file: ${entry.entryName} (${content.length} chars)`);
      }
    }
    
    console.log(`✅ Extracted ${Object.keys(templateFiles).length} files from template`);
    
    // Создаем коммит с файлами шаблона
    const commitId = crypto.randomUUID();
    const commitMessage = 'Initial commit'; // Изменили на стандартное сообщение
    
    const supabase = getSupabaseServerClient();
    const historyQueries = new FileHistoryQueries(supabase);
    
    // Загружаем файлы в R2 и создаем записи в file_history
    for (const [filePath, content] of Object.entries(templateFiles)) {
      // Загружаем файл в R2
      await uploadFileVersion(projectId, commitId, filePath, content);
      
      // Создаем запись в file_history С commit_id и commit_message
      await historyQueries.createFileHistory({
        project_id: projectId,
        file_path: filePath,
        r2_object_key: `projects/${projectId}/versions/${commitId}/${filePath}`,
        content_hash: crypto.createHash('sha256').update(content).digest('hex'),
        file_size: Buffer.byteLength(content, 'utf-8'),
        commit_id: commitId,
        commit_message: commitMessage
      });
    }
    
    // Логируем успешное создание коммита
    await projectLogger.logCommitCreated(
      projectId,
      commitId,
      commitMessage,
      Object.keys(templateFiles).length,
      'template_extraction'
    );
    
    console.log(`✅ Template files saved as commit ${commitId} for project ${projectId}`);
    return commitId;
    
      } catch (error) {
      console.error(`❌ Error extracting template files for project ${projectId}:`, error);
      
      // Логируем ошибку
      await projectLogger.log({
        project_id: projectId,
        event_type: 'error',
        details: { 
          action: 'template_extraction_failed', 
          error: error instanceof Error ? error.message : String(error),
          original_trigger: 'initial_deploy'
        },
        trigger: 'initial_deploy'
      });
      
      throw error;
    }
}

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
  
  // Получаем последние версии всех файлов из истории для полного снапшота
  const latestFiles = await historyQueries.getProjectFileHistory(projectId, 1000);
  
  // НОВАЯ ПРОВЕРКА: Если нет pending changes И есть файлы в истории, 
  // возвращаем ID последнего коммита (НЕ создаем новый)
  if (pendingChanges.length === 0 && latestFiles.length > 0) {
    const lastCommitId = latestFiles[0]?.commit_id;
    if (lastCommitId) {
      console.log(`📄 No pending changes for project ${projectId}, reusing existing commit ${lastCommitId}`);
      return lastCommitId;
    }
  }
  
  // Если нет ни pending changes ни file history, создаем пустой снапшот для первого деплоя
  if (pendingChanges.length === 0 && latestFiles.length === 0) {
    console.log(`📄 No changes or history for project ${projectId}, creating initial empty snapshot`);
    const commitId = crypto.randomUUID();
    const finalCommitMessage = commitMessage || 'Initial empty deployment';
    
    // Создаем минимальную запись в file_history для отслеживания первого деплоя
    await historyQueries.createFileHistory({
      project_id: projectId,
      file_path: '.shipvibes-initial',
      r2_object_key: `projects/${projectId}/versions/${commitId}/.shipvibes-initial`,
      content_hash: 'initial',
      file_size: 0,
      commit_id: commitId,
      commit_message: finalCommitMessage
    });
    
    console.log(`✅ Initial snapshot created for project ${projectId} as commit ${commitId}`);
    return commitId;
  }
  
  // Создаем карту последних файлов
  const latestFileMap = new Map();
  for (const file of latestFiles) {
    const existing = latestFileMap.get(file.file_path);
    if (!existing || 
        (file.created_at && existing.created_at && new Date(file.created_at) > new Date(existing.created_at)) ||
        (file.created_at && !existing.created_at)) {
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
  
  // 2. Применяем pending changes (если есть)
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
  
  // Определяем сообщение коммита
  let finalCommitMessage = commitMessage;
  if (!finalCommitMessage) {
    if (pendingChanges.length > 0) {
      finalCommitMessage = `Updated ${pendingChanges.length} files: ${changedFiles.join(', ')}`;
    } else {
      finalCommitMessage = `Snapshot of ${fullSnapshot.size} existing files`;
    }
  }
  
  console.log(`📄 Saving commit: ${finalCommitMessage}`);
  console.log(`📄 Full snapshot contains ${fullSnapshot.size} files`);
  
  // 3. Сохраняем ВСЕ файлы как один коммит
  const commitId = crypto.randomUUID();
  
  // Если есть файлы для сохранения
  if (fullSnapshot.size > 0) {
    // Bulk upload всех файлов в R2
    const uploadPromises: Promise<any>[] = [];
    for (const [filePath, fileData] of fullSnapshot) {
      uploadPromises.push(
        uploadFileVersion(projectId, commitId, filePath, fileData.content)
      );
    }
    await Promise.all(uploadPromises);
    
    // Bulk создание записей в file_history
    const historyRecords: any[] = [];
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
  } else {
    // Если нет файлов, создаем пустую запись
    await historyQueries.createFileHistory({
      project_id: projectId,
      file_path: '.shipvibes-empty',
      r2_object_key: `projects/${projectId}/versions/${commitId}/.shipvibes-empty`,
      content_hash: 'empty',
      file_size: 0,
      commit_id: commitId,
      commit_message: finalCommitMessage
    });
  }
  
  // 4. Очищаем pending changes (если были)
  if (pendingChanges.length > 0) {
    await pendingQueries.clearAllPendingChanges(projectId);
    
    // Логируем очистку pending changes
    await projectLogger.log({
      project_id: projectId,
      event_type: 'pending_changes_cleared',
      details: { 
        clearedChangesCount: pendingChanges.length,
        action: 'bulk_clear'
      },
      trigger: 'commit_save'
    });
  }
  
  // Логируем создание коммита
  await projectLogger.logCommitCreated(
    projectId,
    commitId,
    finalCommitMessage,
    fullSnapshot.size,
    'manual_save'
  );
  
  console.log(`✅ Full project snapshot saved as commit ${commitId}: ${finalCommitMessage}`);
  return commitId;
}

async function triggerDeploy(projectId: string, commitId: string): Promise<void> {
  try {
    // Проверяем, есть ли файлы для деплоя
    const hasFiles = await netlifyService.hasProjectFiles(projectId);
    if (!hasFiles) {
      console.log(`⏰ Project ${projectId} has no deployable files, skipping deploy`);
      
      // Обновляем статус как ready но без URL
      const supabase = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabase);
      await projectQueries.updateProject(projectId, {
        deploy_status: 'ready'
      });
      
      // Логируем изменение статуса
      await projectLogger.logDeployStatusChange(
        projectId,
        'pending',
        'ready',
        undefined,
        'auto_deploy'
      );
      
      return;
    }
    
    // Убеждаемся что у проекта есть Netlify сайт
    const siteId = await ensureNetlifySite(projectId);
    if (!siteId) {
      console.error(`❌ Cannot deploy project ${projectId}: no Netlify site`);
      
      // Логируем ошибку
      await projectLogger.log({
        project_id: projectId,
        event_type: 'error',
        details: { 
          message: 'Cannot deploy project: no Netlify site',
          context: 'triggerDeploy'
        },
        trigger: 'deploy_process'
      });
      
      return;
    }

    console.log(`🚀 Triggering deploy for project ${projectId} (site: ${siteId})...`);
    
    // Логируем начало деплоя
    await projectLogger.logDeployStatusChange(
      projectId,
      'pending',
      'building',
      undefined,
      'deploy_process'
    );
    
    // Обновляем статус деплоя
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    await projectQueries.updateProject(projectId, {
      deploy_status: 'building'
    });
    
    // Запускаем деплой
    const deployResponse = await netlifyService.deployProject(siteId, projectId, commitId);
    
    // Обновляем статус деплоя (автоматическая проверка статуса запустится в NetlifyService)
    await projectQueries.updateProject(projectId, {
      deploy_status: 'building',
      netlify_url: deployResponse.deploy_url,
      netlify_deploy_id: deployResponse.id
    });

    console.log(`✅ Deploy initiated for project ${projectId}: ${deployResponse.deploy_url}`);
  } catch (error) {
    console.error(`❌ Error deploying project ${projectId}:`, error);
    
    // Логируем ошибку деплоя
    await projectLogger.logDeployStatusChange(
      projectId,
      'building',
      'failed',
      undefined,
      'deploy_error'
    );
    
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

/**
 * Проверить нужен ли автоматический первый деплой и запустить его
 */
async function checkAndTriggerInitialDeploy(projectId: string): Promise<void> {
  try {
    console.log(`🔍 Checking if initial deploy needed for project ${projectId}...`);
    
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    const historyQueries = new FileHistoryQueries(supabase);
    
    // Получаем проект
    const project = await projectQueries.getProjectById(projectId);
    if (!project) {
      console.log(`❌ Project ${projectId} not found`);
      return;
    }

    // СТРОГАЯ ПРОВЕРКА 1: Если у проекта уже есть netlify_url, то деплой уже был
    if (project.netlify_url) {
      console.log(`✅ Project ${projectId} already has deployment: ${project.netlify_url}`);
      return;
    }

    // СТРОГАЯ ПРОВЕРКА 2: Если статус уже 'ready' - деплой завершен
    if (project.deploy_status === 'ready') {
      console.log(`✅ Project ${projectId} deploy status is 'ready', skipping auto-deploy`);
      return;
    }

    // СТРОГАЯ ПРОВЕРКА 3: Если статус 'building' - деплой уже в процессе
    if (project.deploy_status === 'building') {
      console.log(`⏳ Project ${projectId} is already building, skipping auto-deploy`);
      return;
    }

    // СТРОГАЯ ПРОВЕРКА 4: Проверяем есть ли уже коммиты (любые коммиты означают что инициализация уже была)
    const existingCommits = await historyQueries.getProjectFileHistory(projectId, 1);
    if (existingCommits.length > 0) {
      console.log(`📄 Project ${projectId} already has commits, skipping auto-deploy`);
      return;
    }

    // СТРОГАЯ ПРОВЕРКА 5: Проверяем возраст проекта (только новые проекты)
    const projectAge = Date.now() - (project.created_at ? new Date(project.created_at).getTime() : Date.now());
    const fiveMinutes = 5 * 60 * 1000;
    
    if (projectAge >= fiveMinutes) {
      console.log(`⏰ Project ${projectId} is too old (${Math.round(projectAge / 1000)}s), skipping auto-deploy`);
      return;
    }

    // ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ - проект новый и пустой, нужен автодеплой
    console.log(`🚀 Project ${projectId} is new and empty (${Math.round(projectAge / 1000)}s old), starting initial deploy...`);
    
    try {
      // НОВАЯ ЛОГИКА: Сначала проверяем, есть ли уже файлы шаблона в истории
      // (они могли быть сохранены при создании проекта)
      const templateFiles = await historyQueries.getProjectFileHistory(projectId, 50);
      
      let commitId: string;
      
      if (templateFiles.length > 0) {
        // Файлы шаблона уже есть в истории - используем последний коммит
        commitId = templateFiles[0].commit_id || crypto.randomUUID();
        console.log(`📦 Template files already exist in history, using commit ${commitId}`);
      } else {
        // Файлы шаблона отсутствуют - извлекаем из ZIP
        console.log(`📦 No template files in history, extracting from template ZIP...`);
        commitId = await extractAndSaveTemplateFiles(projectId);
        console.log(`📦 Template files extracted and saved as commit ${commitId}`);
      }
      
      // Деплоим коммит с файлами шаблона
      await triggerDeploy(projectId, commitId);
      console.log(`✅ Initial template deploy triggered for project ${projectId}`);
      
    } catch (templateError) {
      console.error(`❌ Error in initial deploy for project ${projectId}:`, templateError);
      
      // Если что-то пошло не так, создаем пустой первый снапшот
      console.log(`🔄 Falling back to empty initial deploy for project ${projectId}`);
      const commitId = await saveFullProjectSnapshot(projectId, 'Initial deployment (fallback)');
      await triggerDeploy(projectId, commitId);
    }
    
  } catch (error) {
    console.error(`❌ Error in checkAndTriggerInitialDeploy for project ${projectId}:`, error);
  }
}

// Обработка подключений
// Храним состояние подключенных агентов по проектам
const connectedAgents = new Map<string, Set<string>>(); // projectId -> Set<socketId>

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Обработка аутентификации проекта
  socket.on('authenticate', (data) => {
    const { projectId, token, clientType } = data;
    
    if (!projectId) {
      socket.emit('error', { message: 'Project ID is required' });
      return;
    }

    // Присоединяем к комнате проекта
    socket.join(`project:${projectId}`);
    socket.data.projectId = projectId;
    socket.data.clientType = clientType || 'web'; // По умолчанию web-клиент
    
    console.log(`🔐 Client ${socket.id} authenticated for project ${projectId} (type: ${socket.data.clientType})`);
    socket.emit('authenticated', { projectId });
    
    // Если это агент - добавляем в список подключенных агентов
    if (clientType === 'agent') {
      if (!connectedAgents.has(projectId)) {
        connectedAgents.set(projectId, new Set());
      }
      connectedAgents.get(projectId)!.add(socket.id);
      
      // Уведомляем всех клиентов В КОМНАТЕ ПРОЕКТА о подключении агента
      io.to(`project:${projectId}`).emit('agent_connected', {
        projectId,
        clientId: socket.id,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📡 Emitted agent_connected event for project ${projectId} to project room`);
      
      // Логируем подключение агента
      projectLogger.logAgentConnection(
        projectId,
        true,
        socket.id,
        'websocket_connection'
      ).catch(console.error);
      
      // Проверяем нужен ли автоматический первый деплой
      checkAndTriggerInitialDeploy(projectId).catch(error => {
        console.error(`❌ Error checking initial deploy for project ${projectId}:`, error);
      });
    }
    
    // Если это веб-клиент - проверяем есть ли уже подключенные агенты
    if (clientType === 'web' || !clientType) {
      const projectAgents = connectedAgents.get(projectId);
      if (projectAgents && projectAgents.size > 0) {
        // Отправляем уведомление о том что агент уже подключен
        socket.emit('agent_connected', {
          projectId,
          clientId: Array.from(projectAgents)[0], // Берем первого агента
          timestamp: new Date().toISOString()
        });
        
        console.log(`📡 Sent existing agent status to new web client ${socket.id} for project ${projectId}`);
      }
    }
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

      // Логируем изменение файла
      await projectLogger.logFileChange(
        projectId,
        filePath,
        action,
        'file_watcher'
      );

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
      // Если это был агент - убираем из списка подключенных агентов
      if (socket.data.clientType === 'agent') {
        const projectAgents = connectedAgents.get(socket.data.projectId);
        if (projectAgents) {
          projectAgents.delete(socket.id);
          
          // Если это был последний агент - удаляем запись для проекта
          if (projectAgents.size === 0) {
            connectedAgents.delete(socket.data.projectId);
          }
        }
        
        // Уведомляем клиентов В КОМНАТЕ ПРОЕКТА об отключении агента
        io.to(`project:${socket.data.projectId}`).emit('agent_disconnected', {
          projectId: socket.data.projectId,
          clientId: socket.id,
          timestamp: new Date().toISOString()
        });
        
        console.log(`📡 Emitted agent_disconnected event for project ${socket.data.projectId} to project room`);
        
        // Логируем отключение агента
        projectLogger.logAgentConnection(
          socket.data.projectId,
          false,
          socket.id,
          'websocket_disconnection'
        ).catch(console.error);
      }
      
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