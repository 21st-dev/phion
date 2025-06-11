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

// API endpoint для получения последней версии агента
app.get('/api/version', (req, res) => {
  try {
    // Здесь можно реализовать проверку последней версии
    // Пока возвращаем статическую версию
    res.json({ 
      latestAgentVersion: '1.0.0',
      serverVersion: '1.0.0',
      updateAvailable: false
    });
  } catch (error) {
    console.error('❌ Error in /api/version:', error);
    res.status(500).json({ 
      error: 'Failed to get version info' 
    });
  }
});

console.log('🚀 Starting Vybcel WebSocket Server...');
console.log(`📡 Port: ${PORT}`);

// УДАЛЕНО: extractAndSaveTemplateFiles больше не нужна
// Файлы шаблона теперь создаются при создании проекта через GitHub API

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

  // 🆕 ПРОВЕРЯЕМ ЕСТЬ ЛИ NETLIFY САЙТ - если нет, создаем при первом коммите
  const isFirstUserCommit = !project.netlify_site_id;
  if (isFirstUserCommit) {
    console.log(`🌐 [FIRST_COMMIT] Creating Netlify site for project ${projectId} (first user commit)...`);
    
    try {
      // Импортируем Netlify сервис
      const { NetlifyService } = await import('./services/netlify.js');
      const netlifyService = new NetlifyService();
      
      // Создаем Netlify сайт с GitHub интеграцией
      const netlifySite = await netlifyService.createSiteWithGitHub(
        projectId,
        project.name,
        project.github_repo_name,
        'vybcel'
      );

      // Сохраняем netlify_site_id в базу данных
      await projectQueries.updateProject(projectId, {
        netlify_site_id: netlifySite.id,
        deploy_status: "building" // Будет автоматически деплоиться после коммита
      });
      
      // Настраиваем webhooks для уведомлений о деплое
      await netlifyService.setupWebhookForSite(netlifySite.id, projectId);
      
      console.log(`✅ [FIRST_COMMIT] Netlify site created: ${netlifySite.id} for project ${projectId}`);
    } catch (error) {
      console.error(`❌ [FIRST_COMMIT] Failed to create Netlify site for project ${projectId}:`, error);
      // Продолжаем с коммитом даже если Netlify не удался
    }
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
  console.log(`🧹 Cleared ${pendingChanges.length} pending changes for project ${projectId}`);
  
  // Логируем создание коммита
  console.log(`📝 Commit created: ${mainCommitSha} for project ${projectId} (${pendingChanges.length} files)`);
  
  // ДОБАВЛЯЕМ СИНХРОНИЗАЦИЮ С ЛОКАЛЬНЫМ АГЕНТОМ
  // Согласно sequenceDiagram.ini строки 313-328
  try {
    console.log(`🔄 Syncing local agent with new commit ${mainCommitSha} for project ${projectId}`);
    
    // Создаем временный токен для git pull
    const temporaryToken = await githubAppService.createTemporaryToken();
    
    // Отправляем команду git pull с токеном локальному агенту
    io.to(`project:${projectId}`).emit('git_pull_with_token', {
      projectId,
      token: temporaryToken,
      repoUrl: project.github_repo_url
    });
    
    console.log(`✅ Git pull command sent to local agent for project ${projectId}`);
    
  } catch (syncError) {
    console.error(`❌ Error syncing local agent for project ${projectId}:`, syncError);
    // Не прерываем выполнение - коммит уже создан, синхронизация не критична
  }
  
  console.log(`✅ GitHub commit created: ${mainCommitSha} with ${pendingChanges.length} files${isFirstUserCommit ? ' (first user commit + Netlify site created)' : ''}`);
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
    console.log(`🚀 Deploy status changed: pending -> building for project ${projectId}`);
    
    // Обновляем статус - Netlify начнет деплой автоматически
    await projectQueries.updateProject(projectId, {
      deploy_status: 'building'
    });
    
    // ВАЖНО: Отправляем WebSocket событие о начале деплоя
    io.to(`project:${projectId}`).emit('deploy_status_update', {
      projectId,
      status: 'building',
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ GitHub commit created, Netlify auto-deploy initiated for project ${projectId}`);
    console.log(`📡 Emitted deploy_status_update: building`);
    
  } catch (error) {
    console.error(`❌ Error in deploy trigger for project ${projectId}:`, error);
    
    // Логируем ошибку
    console.log(`❌ Deploy status changed: building -> failed for project ${projectId}`);
    
    // Обновляем статус деплоя как failed
    try {
      const supabase = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabase);
      await projectQueries.updateProject(projectId, {
        deploy_status: 'failed'
      });
      
      // Отправляем WebSocket событие об ошибке деплоя
      io.to(`project:${projectId}`).emit('deploy_status_update', {
        projectId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Deploy failed',
        timestamp: new Date().toISOString()
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
      console.log(`🔌 Agent connected: ${socket.id} to project ${projectId}`);
      
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
      console.log(`📝 File ${action}: ${filePath} in project ${projectId}`);

      // Уведомляем ВСЕХ клиентов в проекте о staged изменении
      const eventData = {
        projectId,
        filePath,
        content,
        action,
        timestamp: Date.now(),
        status: 'staged'
      };
      
      // Проверяем количество клиентов в комнате
      const roomClients = io.sockets.adapter.rooms.get(`project:${projectId}`);
      const clientCount = roomClients ? roomClients.size : 0;
      
      console.log(`📡 [WebSocket] Sending file_change_staged event to project:${projectId}`, {
        filePath,
        action,
        contentLength: content?.length || 0,
        clientsInRoom: clientCount
      });
      
      io.to(`project:${projectId}`).emit('file_change_staged', eventData);

      // Отправляем подтверждение отправителю
      socket.emit('file_tracked', {
        filePath,
        action,
        timestamp: Date.now(),
        status: 'tracked'
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
      
      // Уведомляем ВСЕХ клиентов в проекте о staged удалении
      io.to(`project:${projectId}`).emit('file_change_staged', {
        projectId,
        filePath,
        content: '', // Пустой content для удаленных файлов
        action: 'deleted',
        timestamp: Date.now(),
        status: 'staged'
      });

      // Отправляем подтверждение отправителю
      socket.emit('file_tracked', {
        filePath,
        action: 'deleted',
        timestamp: Date.now(),
        status: 'tracked'
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

      // Получаем данные коммита для уведомления
      const supabase = getSupabaseServerClient();
      const commitQueries = new CommitHistoryQueries(supabase);
      const latestCommit = await commitQueries.getLatestCommit(projectId);

      // Уведомляем ВСЕХ клиентов в проекте о successful save
      io.to(`project:${projectId}`).emit('save_success', {
        projectId,
        commitId: commitSha,
        timestamp: Date.now()
      });

      // Уведомляем всех клиентов о новом коммите
      io.to(`project:${projectId}`).emit('commit_created', {
        projectId,
        commit: latestCommit,
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
      
      // Уведомляем ВСЕХ клиентов в проекте об очистке pending changes
      io.to(`project:${projectId}`).emit('discard_success', {
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
      console.log(`📊 Git command ${success ? 'SUCCESS' : 'FAILED'} for project ${projectId}: ${command}`);
      
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
        console.log(`🔌 Agent disconnected: ${socket.id} from project ${socket.data.projectId}`);
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

// API endpoint для уведомления о смене статуса проекта
app.post('/api/notify-status-change', async (req, res) => {
  try {
    const { projectId, status, message } = req.body;
    
    if (!projectId || !status) {
      return res.status(400).json({ 
        error: 'Missing required fields: projectId, status' 
      });
    }

    console.log(`📡 [STATUS_NOTIFY] Sending status update for project ${projectId}: ${status}`);

    // Отправляем WebSocket событие всем клиентам проекта
    io.to(`project:${projectId}`).emit('deploy_status_update', {
      projectId,
      status,
      message,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ [STATUS_NOTIFY] WebSocket event sent to project:${projectId} room`);

    res.status(200).json({ 
      success: true, 
      message: 'Status notification sent successfully',
      projectId,
      status
    });

  } catch (error) {
    console.error('❌ [STATUS_NOTIFY] Error sending status notification:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Netlify webhook endpoint
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
    console.log(`🚀 Deploy status change for project ${projectId}: ${project.deploy_status || 'building'} -> ${newStatus}`);

    // Отправляем уведомление через WebSocket всем подключенным клиентам проекта
    io.to(`project:${projectId}`).emit('deploy_status_update', {
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

// ✅ Добавляем новый endpoint для инициализации проекта из Next.js
app.post('/api/projects/initialize', async (req, res) => {
  try {
    const { projectId, templateType, projectName, repositoryName } = req.body;
    
    if (!projectId || !templateType || !projectName || !repositoryName) {
      return res.status(400).json({ 
        error: 'Missing required fields: projectId, templateType, projectName, repositoryName' 
      });
    }

    console.log(`🚀 [INIT_PROJECT] Starting project initialization for ${projectId}...`);

    // Запускаем инициализацию в фоне (здесь это безопасно - Railway не засыпает)
    initializeProjectInBackground(projectId, templateType, projectName, repositoryName)
      .catch(error => {
        console.error(`❌ [INIT_PROJECT] Background initialization failed for ${projectId}:`, error);
      });

    // Немедленно отвечаем клиенту
    res.status(200).json({
      success: true,
      message: 'Project initialization started',
      projectId
    });

  } catch (error) {
    console.error('❌ [INIT_PROJECT] Error starting project initialization:', error);
    res.status(500).json({ 
      error: 'Failed to start project initialization',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🚀 Фоновая инициализация проекта - перенесено из Next.js
 * Здесь безопасно работать в фоне - Railway не засыпает
 */
async function initializeProjectInBackground(
  projectId: string,
  templateType: string,
  projectName: string,
  repositoryName: string
): Promise<void> {
  console.log(`🔄 [INIT_BG] Starting template upload for ${projectId}...`);
  
  try {
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    const commitHistoryQueries = new CommitHistoryQueries(supabase);

    // 1. Генерируем файлы шаблона 
    console.log(`📡 [INIT_BG] Sending initialization_progress to project:${projectId}`);
    io.to(`project:${projectId}`).emit('initialization_progress', {
      projectId,
      stage: 'generating_files',
      progress: 10,
      message: 'Setting up your project...'
    });
    
    const templateFiles = await generateTemplateFiles(projectId, templateType, projectName);
    console.log(`📋 [INIT_BG] Generated ${Object.keys(templateFiles).length} template files`);
    
    io.to(`project:${projectId}`).emit('initialization_progress', {
      projectId,
      stage: 'uploading_files',
      progress: 20,
      message: 'Preparing files...'
    });

    // 2. 🚀 Загружаем все файлы ОДНИМ КОММИТОМ с прогрессом
    const { githubAppService } = await import('./services/github.js');
    
    const fileEntries = Object.entries(templateFiles);
    const totalFiles = fileEntries.length;
    const chunkSize = 5;
    const totalChunks = Math.ceil(totalFiles / chunkSize);
    
    // Получаем parent commit для создания нового коммита (теперь всегда должен существовать, т.к. auto_init: true)
    console.log(`🔍 [INIT_BG] About to call getLatestCommit for repository: ${repositoryName}`);
    const parentCommit = await githubAppService.getLatestCommit(repositoryName);
    console.log(`🔍 [INIT_BG] getLatestCommit returned:`, parentCommit);
    
    if (!parentCommit) {
      throw new Error('Repository should be initialized with auto_init: true, but no parent commit found');
    }
    
    console.log(`🔍 [INIT_BG] Parent commit: ${parentCommit.sha}`);
    
    io.to(`project:${projectId}`).emit('initialization_progress', {
      projectId,
      stage: 'creating_blobs',
      progress: 30,
      message: 'Processing files...'
    });

    // Создаем blobs по чанкам с прогрессом
    const blobs: { path: string; sha: string }[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const startIdx = i * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, totalFiles);
      const chunk = fileEntries.slice(startIdx, endIdx);
      
      // Создаем blobs для текущего чанка
      const chunkBlobs = await Promise.all(
        chunk.map(async ([path, content]) => {
          const blob = await githubAppService.createBlob(repositoryName, content);
          return { path, sha: blob.sha };
        })
      );
      
      blobs.push(...chunkBlobs);
      
      // Отправляем прогресс
      const progressPercent = 30 + (i + 1) / totalChunks * 40; // 30% - 70%
      io.to(`project:${projectId}`).emit('initialization_progress', {
        projectId,
        stage: 'creating_blobs',
        progress: Math.round(progressPercent),
        message: 'Processing files...'
      });
      
      // Небольшая задержка между чанками
      if (i < totalChunks - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    io.to(`project:${projectId}`).emit('initialization_progress', {
      projectId,
      stage: 'creating_commit',
      progress: 80,
      message: 'Saving project...'
    });

    // Создаем tree и коммит (с базовым tree от parent commit)
    console.log(`🌳 [INIT_BG] Creating tree with base tree from parent commit...`);
    const tree = await githubAppService.createTree(repositoryName, blobs, parentCommit.sha);
    
    console.log(`📝 [INIT_BG] Creating commit with parent: ${parentCommit.sha}`);
    const commit = await githubAppService.createCommit(
      repositoryName,
      'Initial commit from template',
      tree.sha,
      [parentCommit.sha]
    );
    
    // Обновляем main ветку (теперь всегда существует благодаря auto_init: true)
    console.log(`🔄 [INIT_BG] Updating main branch with new commit: ${commit.sha}`);
    await githubAppService.updateRef(repositoryName, 'heads/main', commit.sha);
    console.log(`✅ [INIT_BG] Successfully updated main branch`);
    
    console.log(`✅ [INIT_BG] Uploaded ${totalFiles} files in one commit`);
    const mainCommitSha = commit.sha;

    // 3. Создаем запись в commit_history
    if (mainCommitSha) {
      const commitRecord = await commitHistoryQueries.createCommitHistory({
        project_id: projectId,
        commit_message: 'Initial commit from template',
        github_commit_sha: mainCommitSha,
        github_commit_url: `https://github.com/vybcel/${repositoryName}/commit/${mainCommitSha}`,
        files_count: Object.keys(templateFiles).length
      });

      // Отправляем WebSocket событие о создании коммита
      console.log(`📡 [INIT_BG] Sending commit_created event to project:${projectId}`);
      io.to(`project:${projectId}`).emit('commit_created', {
        projectId,
        commit: {
          commit_id: commitRecord.id,
          commit_message: 'Initial commit from template',
          created_at: commitRecord.created_at,
          files_count: Object.keys(templateFiles).length,
          github_commit_sha: mainCommitSha,
          github_commit_url: `https://github.com/vybcel/${repositoryName}/commit/${mainCommitSha}`
        }
      });
      console.log(`✅ [INIT_BG] commit_created event sent for initial commit`);
    }

    // 4. ✅ Обновляем статус проекта как готовый к скачиванию
    io.to(`project:${projectId}`).emit('initialization_progress', {
      projectId,
      stage: 'finalizing',
      progress: 90,
      message: 'Almost ready...'
    });
    
    await projectQueries.updateProject(projectId, {
      deploy_status: "ready" // Проект готов к скачиванию и разработке
    });

    // 5. 🚀 Отправляем WebSocket событие о завершении инициализации
    console.log(`📡 [INIT_BG] Sending final initialization_progress (100%) to project:${projectId}`);
    io.to(`project:${projectId}`).emit('initialization_progress', {
      projectId,
      stage: 'completed',
      progress: 100,
      message: 'Ready!'
    });
    
    console.log(`📡 [INIT_BG] Sending deploy_status_update to project:${projectId}`);
    io.to(`project:${projectId}`).emit('deploy_status_update', {
      status: 'ready',
      message: 'Project initialization completed',
      projectId
    });

    console.log(`🎉 [INIT_BG] Template upload completed for ${projectId}! Project ready for development.`);

  } catch (error) {
    console.error(`❌ [INIT_BG] Template upload failed for ${projectId}:`, error);
    
    try {
      console.log(`🔄 [INIT_BG] Updating project status to failed for ${projectId}...`);
      
      // Обновляем статус на failed
      const supabase = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabase);
      await projectQueries.updateProject(projectId, {
        deploy_status: "failed"
      });
      console.log(`✅ [INIT_BG] Project status updated to failed for ${projectId}`);

      // Отправляем WebSocket событие об ошибке
      console.log(`📡 [INIT_BG] Sending deploy_status_update (failed) to project:${projectId}`);
      io.to(`project:${projectId}`).emit('deploy_status_update', {
        status: 'failed',
        message: 'Project initialization failed',
        projectId,
        timestamp: new Date().toISOString()
      });
      console.log(`✅ [INIT_BG] WebSocket event sent for failed initialization`);
      
    } catch (updateError) {
      console.error(`❌ [INIT_BG] Failed to update project status for ${projectId}:`, updateError);
    }
    
    throw error;
  }
}

/**
 * Генерирует файлы шаблона с настройками проекта
 * Перенесено из Next.js для работы в WebSocket сервере
 */
async function generateTemplateFiles(
  projectId: string,
  templateType: string,
  projectName: string
): Promise<Record<string, string>> {
  console.log(`🔄 [TEMPLATE] Generating template files for ${projectId} (${templateType})`);
  
  // Импортируем необходимые модули
  const fs = await import('fs');
  const path = await import('path');
  
  // Путь к шаблону (относительно корня workspace)
  const templatePath = path.join(process.cwd(), "..", "..", "templates", templateType);
  
  if (!fs.existsSync(templatePath)) {
    // Пробуем альтернативный путь
    const alternativeTemplatePath = path.join(process.cwd(), "templates", templateType);
    if (!fs.existsSync(alternativeTemplatePath)) {
      throw new Error(`Template ${templateType} not found`);
    }
    return await collectTemplateFiles(alternativeTemplatePath, projectName, projectId);
  }
  
  return await collectTemplateFiles(templatePath, projectName, projectId);
}

/**
 * Собирает все файлы из шаблона и применяет необходимые трансформации
 */
async function collectTemplateFiles(
  templatePath: string,
  projectName: string,
  projectId: string
): Promise<Record<string, string>> {
  const fs = await import('fs');
  const path = await import('path');
  
  const templateFiles: Record<string, string> = {};
  
  function collectFiles(dirPath: string, relativePath: string = ''): void {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      // Пропускаем служебные папки
      if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist' || item.name === '.next') {
        continue;
      }
      
      const fullPath = path.join(dirPath, item.name);
      const relativeFilePath = relativePath ? path.join(relativePath, item.name) : item.name;
      
      if (item.isDirectory()) {
        collectFiles(fullPath, relativeFilePath);
      } else {
        let content = fs.readFileSync(fullPath, 'utf-8');
        
        // Применяем трансформации для специальных файлов
        if (item.name === 'package.json') {
          const packageJson = JSON.parse(content);
          packageJson.name = projectName.toLowerCase().replace(/\s+/g, '-');
          content = JSON.stringify(packageJson, null, 2);
        } else if (item.name === 'vybcel.config.json') {
          // Заменяем PROJECT_ID в конфигурационном файле
          content = content.replace(/__PROJECT_ID__/g, projectId);
          
          // Заменяем WS_URL в зависимости от окружения
          const wsUrl = process.env.NODE_ENV === 'production' 
            ? 'wss://api.vybcel.com'
            : 'ws://localhost:8080';
          content = content.replace(/__WS_URL__/g, wsUrl);
        }
        
        // Нормализуем пути (заменяем \ на /)
        const normalizedPath = relativeFilePath.replace(/\\/g, '/');
        templateFiles[normalizedPath] = content;
      }
    }
  }
  
  collectFiles(templatePath);
  
  console.log(`📋 [TEMPLATE] Collected ${Object.keys(templateFiles).length} files from template`);
  return templateFiles;
}

// ✅ Добавляем endpoint для создания GitHub репозитория из Next.js
app.post('/api/projects/create-repository', async (req, res) => {
  try {
    const { projectId, projectName } = req.body;
    
    if (!projectId || !projectName) {
      return res.status(400).json({ 
        error: 'Missing required fields: projectId, projectName' 
      });
    }

    console.log(`🚀 [CREATE_REPO] Creating GitHub repository for project ${projectId}...`);

    // Импортируем GitHub сервис
    const { githubAppService } = await import('./services/github.js');
    
    // Создаем GitHub репозиторий
    const repository = await githubAppService.createRepository(
      projectId,
      `Vybcel project: ${projectName}`
    );
    
    console.log(`✅ [CREATE_REPO] GitHub repository created: ${repository.html_url}`);

    // Обновляем проект с GitHub данными
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    
    await projectQueries.updateGitHubInfo(projectId, {
      github_repo_url: repository.html_url,
      github_repo_name: repository.name,
      github_owner: 'vybcel'
    });

    res.status(200).json({
      success: true,
      repository: {
        html_url: repository.html_url,
        name: repository.name,
        owner: 'vybcel'
      }
    });

  } catch (error) {
    console.error('❌ [CREATE_REPO] Error creating GitHub repository:', error);
    res.status(500).json({ 
      error: 'Failed to create GitHub repository',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}); 