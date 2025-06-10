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
  CommitHistoryQueries,
} from "@shipvibes/database";
// R2 импорты удалены - теперь используем GitHub API
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

// УДАЛЕНО: extractAndSaveTemplateFiles больше не нужна
// Файлы шаблона теперь создаются при создании проекта через GitHub API

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
  console.log(`📸 Creating GitHub commit for project ${projectId}...`);
  
  const supabase = getSupabaseServerClient();
  const pendingQueries = new PendingChangesQueries(supabase);
  const projectQueries = new ProjectQueries(supabase);
  const commitHistoryQueries = new CommitHistoryQueries(supabase);
  
  // Получаем все pending changes (изменения пользователя)
  const pendingChanges = await pendingQueries.getAllPendingChanges(projectId);
  
  // Получаем данные проекта для GitHub операций
  const project = await projectQueries.getProjectById(projectId);
  if (!project || !project.github_repo_name) {
    throw new Error(`Project ${projectId} not found or missing GitHub repo data`);
  }
  
  // НОВАЯ ПРОВЕРКА: Если нет pending changes, возвращаем последний коммит SHA
  if (pendingChanges.length === 0) {
    const lastCommit = await commitHistoryQueries.getLatestCommit(projectId);
    if (lastCommit?.github_commit_sha) {
      console.log(`📄 No pending changes for project ${projectId}, reusing existing commit ${lastCommit.github_commit_sha}`);
      return lastCommit.github_commit_sha;
    }
  }
  
  // Если нет pending changes, но нужно создать первый коммит
  if (pendingChanges.length === 0) {
    throw new Error(`No pending changes to commit for project ${projectId}`);
  }

  // Определяем сообщение коммита
  const finalCommitMessage = commitMessage || `Save project changes (${pendingChanges.length} files)`;
  console.log(`📄 Creating GitHub commit: ${finalCommitMessage}`);
  
  // Импортируем GitHub сервис
  const { githubAppService } = await import('./services/github.js');
  
  // Создаем коммит в GitHub для каждого измененного файла
  const commits: string[] = [];
  for (const change of pendingChanges) {
    try {
      if (change.action === 'deleted') {
        // TODO: Implement file deletion in GitHub
        console.log(`⚠️ File deletion not yet implemented: ${change.file_path}`);
        continue;
      }
      
      const result = await githubAppService.createOrUpdateFile(
        project.github_repo_name!,
        change.file_path,
        change.content,
        `Update ${change.file_path}`
      );
      
      commits.push(result.commit.sha);
      console.log(`✅ Updated file in GitHub: ${change.file_path} (${result.commit.sha})`);
    } catch (error) {
      console.error(`❌ Failed to update file ${change.file_path} in GitHub:`, error);
      throw error;
    }
  }
  
  // Сохраняем информацию о коммите в базу данных
  const mainCommitSha = commits[commits.length - 1]; // Последний коммит
     await commitHistoryQueries.createCommitHistory({
     project_id: projectId,
     commit_message: finalCommitMessage,
     github_commit_sha: mainCommitSha,
     github_commit_url: `https://github.com/${project.github_owner}/${project.github_repo_name}/commit/${mainCommitSha}`,
     files_count: pendingChanges.length
   });
  
  // Очищаем pending changes после успешного коммита
  await pendingQueries.clearAllPendingChanges(projectId);
  
  // Логируем очистку pending changes
  await projectLogger.log({
    project_id: projectId,
    event_type: 'pending_changes_cleared',
    details: { 
      clearedChangesCount: pendingChanges.length,
      action: 'github_commit'
    },
    trigger: 'commit_save'
  });
  
  // Логируем создание коммита
  await projectLogger.logCommitCreated(
    projectId,
    mainCommitSha,
    finalCommitMessage,
    pendingChanges.length,
    'github_api'
  );
  
  console.log(`✅ GitHub commit created: ${mainCommitSha} with ${pendingChanges.length} files`);
  return mainCommitSha;
}

async function triggerDeploy(projectId: string, commitSha: string): Promise<void> {
  try {
    console.log(`🚀 GitHub commit ${commitSha} created for project ${projectId}`);
    console.log(`🌐 Netlify will automatically deploy from GitHub webhook...`);
    
    // НОВАЯ ЛОГИКА: Netlify автоматически деплоит при GitHub коммите
    // Просто обновляем статус на "building" и ждем webhook от Netlify
    
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    
    // Логируем начало автоматического деплоя
    await projectLogger.logDeployStatusChange(
      projectId,
      'pending',
      'building',
      undefined,
      'github_commit'
    );
    
    // Обновляем статус - Netlify начнет деплой автоматически
    await projectQueries.updateProject(projectId, {
      deploy_status: 'building'
    });
    
    console.log(`✅ GitHub commit created, Netlify auto-deploy initiated for project ${projectId}`);
    
  } catch (error) {
    console.error(`❌ Error in deploy trigger for project ${projectId}:`, error);
    
    // Логируем ошибку
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
      // НОВАЯ ЛОГИКА GitHub: Файлы шаблона создаются при создании проекта
      // Проверяем, есть ли коммиты в GitHub через commit_history
      const supabaseMain = getSupabaseServerClient();
      const commitHistoryQueries = new CommitHistoryQueries(supabaseMain);
      const existingCommits = await commitHistoryQueries.getProjectCommitHistory(projectId);
      
      let commitSha: string;
      
      if (existingCommits.length > 0) {
        // Есть коммиты в GitHub - используем последний
        commitSha = existingCommits[0].github_commit_sha;
        console.log(`📦 Using existing GitHub commit: ${commitSha}`);
      } else if (project.github_repo_name) {
        // Проверяем есть ли коммиты в GitHub репозитории
        console.log(`📦 No commit history found, checking GitHub directly...`);
        const { githubAppService } = await import('./services/github.js');
        
        try {
          const commits = await githubAppService.getCommits(project.github_repo_name);
          if (commits.length > 0) {
            commitSha = commits[0].sha;
            console.log(`📦 Found GitHub commit: ${commitSha}`);
            
            // Сохраняем коммит в нашей истории для синхронизации
            await commitHistoryQueries.createCommitHistory({
              project_id: projectId,
              commit_message: commits[0].commit.message,
              github_commit_sha: commitSha,
              github_commit_url: commits[0].html_url,
              files_count: 1
            });
          } else {
            console.log(`📦 No commits found in GitHub, skipping initial deploy`);
            return; // Нет коммитов для деплоя
          }
        } catch (githubError) {
          console.log(`📦 Error checking GitHub commits: ${githubError}, skipping initial deploy`);
          return;
        }
      } else {
        console.log(`📦 No GitHub repo configured, skipping initial deploy`);
        return;
      }
      
      // Деплоим найденный коммит
      await triggerDeploy(projectId, commitSha);
      console.log(`✅ Initial deploy triggered for project ${projectId} with commit ${commitSha}`);
      
    } catch (error) {
      console.error(`❌ Error in initial deploy for project ${projectId}:`, error);
      // Не создаем fallback - просто логируем ошибку
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
      
      const commitSha = await saveFullProjectSnapshot(projectId, commitMessage);

      // Уведомляем о successful save
      socket.emit('save_success', {
        commitId: commitSha,
        timestamp: Date.now()
      });

      // Триггерим деплой ТОЛЬКО после сохранения
      console.log(`🚀 Triggering deploy after save for project ${projectId}`);
      triggerDeploy(projectId, commitSha).catch(error => {
        console.error(`❌ Deploy failed for project ${projectId}:`, error);
      });

    } catch (error) {
      console.error('❌ Error saving changes:', error);
      socket.emit('error', { message: 'Failed to save changes' });
    }
  });

  // НОВЫЙ HANDLER: Откат локальных изменений
  socket.on('discard_all_changes', async (data) => {
    try {
      const { projectId } = data;
      
      if (!projectId) {
        socket.emit('error', { message: 'Missing projectId' });
        return;
      }

      console.log(`🔄 Discarding all changes for project ${projectId}`);
      
      const supabase = getSupabaseServerClient();
      const pendingQueries = new PendingChangesQueries(supabase);
      
      // Очищаем pending changes в базе данных
      await pendingQueries.clearAllPendingChanges(projectId);
      
      // Отправляем команду на откат локальному агенту
      io.to(`project:${projectId}`).emit('discard_local_changes', {
        projectId
      });
      
      console.log(`✅ Discard command sent for project ${projectId}`);
      
      // Уведомляем клиента об успехе
      socket.emit('discard_success', {
        projectId,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error discarding changes:', error);
      socket.emit('error', { message: 'Failed to discard changes' });
    }
  });

  // НОВЫЙ HANDLER: Синхронизация с GitHub
  socket.on('sync_with_github', async (data) => {
    try {
      const { projectId } = data;
      
      if (!projectId) {
        socket.emit('error', { message: 'Missing projectId' });
        return;
      }

      console.log(`🔄 Syncing project ${projectId} with GitHub`);
      
      const supabase = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabase);
      
      // Получаем данные проекта
      const project = await projectQueries.getProjectById(projectId);
      if (!project || !project.github_repo_url) {
        socket.emit('error', { message: 'Project not found or missing GitHub repo' });
        return;
      }
      
      // Импортируем GitHub сервис для создания временного токена
      const { githubAppService } = await import('./services/github.js');
      
      // Создаем временный токен для git pull
      const temporaryToken = await githubAppService.createTemporaryToken();
      
      // Отправляем команду git pull с токеном локальному агенту
      io.to(`project:${projectId}`).emit('git_pull_with_token', {
        projectId,
        token: temporaryToken,
        repoUrl: project.github_repo_url
      });
      
      console.log(`✅ Git pull command sent for project ${projectId}`);
      
      // Уведомляем клиента об отправке команды
      socket.emit('sync_initiated', {
        projectId,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error syncing with GitHub:', error);
      socket.emit('error', { message: 'Failed to sync with GitHub' });
    }
  });

  // HANDLER: Результат выполнения git команд от локального агента
  socket.on('git_command_result', async (data) => {
    try {
      const { projectId, command, success, error } = data;
      
      console.log(`📊 Git command result for project ${projectId}: ${command} - ${success ? 'SUCCESS' : 'FAILED'}`);
      
      if (!success) {
        console.error(`❌ Git command failed: ${error}`);
      }
      
      // Логируем результат git команды
      await projectLogger.log({
        project_id: projectId,
        event_type: success ? 'git_command_success' : 'git_command_error',
        details: { 
          command,
          error: success ? undefined : error,
          source: 'local_agent'
        },
        trigger: 'git_command'
      });
      
      // Уведомляем веб-клиентов о результате
      io.to(`project:${projectId}`).emit('git_command_completed', {
        projectId,
        command,
        success,
        error,
        timestamp: Date.now()
      });

    } catch (logError) {
      console.error('❌ Error logging git command result:', logError);
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

// Netlify webhook endpoint для получения уведомлений о статусе деплоя
app.post('/webhooks/netlify', async (req, res) => {
  try {
    const { site_id, deploy_id, state, deploy_url, error_message, name } = req.body;
    
    console.log(`🔔 Netlify webhook received:`, {
      site_id,
      deploy_id,
      state,
      deploy_url,
      name
    });

    // Находим проект по netlify_site_id
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    
    // Получаем проект по netlify_site_id
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('netlify_site_id', site_id)
      .limit(1);

    if (fetchError) {
      console.error('❌ Error fetching project by netlify_site_id:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!projects || projects.length === 0) {
      console.log(`⚠️ No project found for netlify_site_id: ${site_id}`);
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projects[0];
    const projectId = project.id;

    // Определяем новый статус на основе состояния Netlify
    let newStatus: 'pending' | 'building' | 'ready' | 'failed' | 'cancelled';
    
    switch (state) {
      case 'ready':        // успешный деплой (неизвестное событие или polling)
        newStatus = 'ready';
        break;
      case 'failed':       // deploy_failed event
      case 'error':        // legacy/fallback
        newStatus = 'failed';
        break;
      case 'created':      // deploy_created event
      case 'building':     // deploy_building event + polling
      case 'started':      // legacy fallback
      case 'enqueued':
      case 'new':
        newStatus = 'building';
        break;
      default:
        console.log(`⚠️ Unknown Netlify state: ${state}, defaulting to building`);
        newStatus = 'building';
    }

    console.log(`📊 Updating project ${projectId} deploy status: ${project.deploy_status} → ${newStatus}`);

    // Обновляем проект в базе данных
    const updateData: any = {
      deploy_status: newStatus,
      netlify_deploy_id: deploy_id
    };

    // Обновляем URL только если деплой успешен и URL предоставлен
    if (newStatus === 'ready' && deploy_url) {
      updateData.netlify_url = deploy_url;
      console.log(`🌐 Updating netlify_url to: ${deploy_url}`);
    }

    await projectQueries.updateProject(projectId, updateData);

    // Логируем изменение статуса деплоя
    await projectLogger.logDeployStatusChange(
      projectId,
      project.deploy_status || 'building',
      newStatus,
      deploy_url,
      'netlify_webhook'
    );

    // Отправляем уведомление через WebSocket всем подключенным клиентам проекта
    io.to(projectId).emit('deploy_status_update', {
      projectId,
      status: newStatus,
      url: deploy_url,
      error: error_message,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Webhook processed successfully for project ${projectId}`);
    console.log(`📡 Emitted deploy status update: ${newStatus} - ${deploy_url || 'no URL'}`);

    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      projectId,
      newStatus
    });

  } catch (error) {
    console.error('❌ Error processing Netlify webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}); 