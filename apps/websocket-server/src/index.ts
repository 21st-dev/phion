import cors from "cors"
import { config } from "dotenv"
import express from "express"

// Загружаем переменные окружения из .env.local
config({ path: ".env.local" })
import { createServer } from "http"
import { Server } from "socket.io"
import { githubAppService } from "./services/github.js"

// Imports для работы с базой данных и файлами
import {
  CommitHistoryQueries,
  FileHistoryQueries,
  getSupabaseServerClient,
  PendingChangesQueries,
  ProjectQueries,
} from "@shipvibes/database"
// R2 импорты удалены - теперь используем GitHub API
import { NetlifyService } from "./services/netlify.js"

const app = express()
const httpServer = createServer(app)

// Настройка CORS для Express
app.use(
  cors({
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3004",
    credentials: true,
  }),
)

app.use(express.json())

// Настройка Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3004",
    methods: ["GET", "POST"],
    credentials: true,
  },
  // 🚀 PRODUCTION CONFIGURATION
  pingTimeout: 60000, // 60 seconds - время ожидания ответа на ping
  pingInterval: 25000, // 25 seconds - интервал отправки ping
  upgradeTimeout: 30000, // 30 seconds - время на upgrade to websocket
  allowUpgrades: true,
  transports: ["websocket", "polling"], // Support both for reliability

  // Engine.IO configuration for production
  maxHttpBufferSize: 1e6, // 1MB max message size
  allowEIO3: false, // Disable legacy Engine.IO v3

  // Connection management
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },

  // Adapter configuration for scaling (if needed)
  cleanupEmptyChildNamespaces: true,
})

// 🔄 CONNECTION MONITORING & MANAGEMENT
const connectionMonitor = {
  // Track connection attempts per IP to prevent spam
  connectionAttempts: new Map<string, { count: number; lastAttempt: number }>(),

  // Track active connections per project to prevent storms
  activeConnections: new Map<string, Set<string>>(), // projectId -> socketIds

  // Connection rate limiting
  isRateLimited(ip: string): boolean {
    const now = Date.now()
    const attempts = this.connectionAttempts.get(ip)

    if (!attempts) {
      this.connectionAttempts.set(ip, { count: 1, lastAttempt: now })
      return false
    }

    // Reset counter if last attempt was more than 1 minute ago
    if (now - attempts.lastAttempt > 60000) {
      this.connectionAttempts.set(ip, { count: 1, lastAttempt: now })
      return false
    }

    // Allow max 10 connections per minute per IP
    if (attempts.count >= 10) {
      console.log(`⚠️ Rate limit exceeded for IP ${ip} (${attempts.count} attempts)`)
      return true
    }

    attempts.count++
    attempts.lastAttempt = now
    return false
  },

  // Add connection to project monitoring
  addConnection(projectId: string, socketId: string): void {
    if (!this.activeConnections.has(projectId)) {
      this.activeConnections.set(projectId, new Set())
    }
    this.activeConnections.get(projectId)!.add(socketId)

    const connectionCount = this.activeConnections.get(projectId)!.size
    if (connectionCount > 5) {
      console.log(`⚠️ High connection count for project ${projectId}: ${connectionCount} clients`)
    }
  },

  // Remove connection from monitoring
  removeConnection(projectId: string, socketId: string): void {
    const connections = this.activeConnections.get(projectId)
    if (connections) {
      connections.delete(socketId)
      if (connections.size === 0) {
        this.activeConnections.delete(projectId)
      }
    }
  },

  // Get connection statistics
  getStats(): {
    totalProjects: number
    totalConnections: number
    connectionsPerProject: Record<string, number>
  } {
    const stats = {
      totalProjects: this.activeConnections.size,
      totalConnections: 0,
      connectionsPerProject: {} as Record<string, number>,
    }

    for (const [projectId, connections] of this.activeConnections) {
      const count = connections.size
      stats.totalConnections += count
      stats.connectionsPerProject[projectId] = count
    }

    return stats
  },
}

// 🩺 HEALTH CHECK: Log connection statistics every 2 minutes
setInterval(() => {
  const stats = connectionMonitor.getStats()
  console.log(
    `📊 [HEALTH] Active connections: ${stats.totalConnections} across ${stats.totalProjects} projects`,
  )

  // Log projects with high connection counts
  for (const [projectId, count] of Object.entries(stats.connectionsPerProject)) {
    if (count > 3) {
      console.log(`⚠️ [HEALTH] Project ${projectId} has ${count} connections`)
    }
  }
}, 120000) // Every 2 minutes

// 🧹 CLEANUP: Remove old connection attempt records every 5 minutes
setInterval(() => {
  const now = Date.now()
  const cutoff = 5 * 60 * 1000 // 5 minutes

  for (const [ip, attempts] of connectionMonitor.connectionAttempts) {
    if (now - attempts.lastAttempt > cutoff) {
      connectionMonitor.connectionAttempts.delete(ip)
    }
  }
}, 300000) // Every 5 minutes

const PORT = process.env.WEBSOCKET_PORT || 8080

// Создаем Netlify сервис
const netlifyService = new NetlifyService(io)

// Каждые 30 секунд проверяем статусы всех активных деплоев
setInterval(() => {
  netlifyService.checkAllActiveDeployments().catch((error) => {
    console.error("❌ Error checking active deployments:", error)
  })
}, 30000)

// HTTP API endpoints
app.post("/api/deploy", async (req, res) => {
  try {
    const { projectId, commitId, action } = req.body

    if (!projectId || action !== "deploy") {
      return res.status(400).json({
        success: false,
        error: "Invalid request. ProjectId and action=deploy required.",
      })
    }

    console.log(
      `🚀 HTTP Deploy request received for project: ${projectId}, commit: ${commitId || "latest"}`,
    )

    // Запускаем деплой асинхронно с commitId
    if (commitId) {
      triggerDeploy(projectId, commitId).catch((error) => {
        console.error(`❌ Deploy failed for project ${projectId}:`, error)
      })
    } else {
      // НОВАЯ ЛОГИКА: проверяем, есть ли что деплоить перед созданием коммита
      const supabase = getSupabaseServerClient()
      const pendingQueries = new PendingChangesQueries(supabase)
      const historyQueries = new FileHistoryQueries(supabase)

      // Проверяем есть ли pending changes или это первый деплой
      const pendingChanges = await pendingQueries.getAllPendingChanges(projectId)
      const existingFiles = await historyQueries.getProjectFileHistory(projectId, 1)

      if (pendingChanges.length === 0 && existingFiles.length > 0) {
        // Нет изменений для деплоя, используем последний коммит
        const lastCommitId = existingFiles[0]?.commit_id
        if (lastCommitId) {
          console.log(`📄 No changes to deploy, using existing commit: ${lastCommitId}`)
          triggerDeploy(projectId, lastCommitId).catch((error) => {
            console.error(`❌ Deploy failed for project ${projectId}:`, error)
          })
        } else {
          console.log(`❌ No changes and no existing commits for project ${projectId}`)
          res.status(400).json({
            success: false,
            error: "No changes to deploy and no existing commits",
          })
          return
        }
      } else {
        // Есть изменения или это первый деплой - создаем снапшот
        saveFullProjectSnapshot(projectId, "Manual deploy via HTTP API")
          .then((newCommitId) => {
            return triggerDeploy(projectId, newCommitId)
          })
          .catch((error) => {
            console.error(`❌ Deploy failed for project ${projectId}:`, error)
          })
      }
    }

    res.json({
      success: true,
      message: "Deploy triggered successfully",
      projectId,
      commitId: commitId || "will_be_generated",
    })
  } catch (error) {
    console.error("❌ Error in /api/deploy:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
    })
  }
})

app.get("/health", (req, res) => {
  const stats = connectionMonitor.getStats()
  res.json({
    status: "ok",
    service: "websocket-server",
    uptime: process.uptime(),
    connections: {
      total: stats.totalConnections,
      projects: stats.totalProjects,
      perProject: stats.connectionsPerProject,
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  })
})

// ========= TOOLBAR UPDATE API ENDPOINTS =========

// Push toolbar update to specific project
app.post("/api/toolbar/push-update", async (req, res) => {
  try {
    const { projectId, version, forceUpdate, releaseNotes, channel } = req.body

    if (!projectId || !version) {
      return res.status(400).json({
        error: "Missing required fields: projectId, version",
      })
    }

    console.log(
      `🚀 [PUSH_UPDATE] Pushing toolbar update to project ${projectId}: v${version} (force: ${forceUpdate})`,
    )

    // Отправляем обновление в конкретную комнату проекта
    io.to(`project:${projectId}`).emit("toolbar_update_available", {
      version,
      forceUpdate: forceUpdate || false,
      releaseNotes: releaseNotes || `New version ${version} is available`,
      channel: channel || "stable",
    })

    res.json({
      success: true,
      message: `Update pushed to project ${projectId}`,
      version,
      forceUpdate,
    })
  } catch (error) {
    console.error("❌ [PUSH_UPDATE] Error pushing toolbar update:", error)
    res.status(500).json({
      error: "Failed to push update",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

// Broadcast toolbar update to all projects
app.post("/api/toolbar/broadcast-update", async (req, res) => {
  try {
    const { version, forceUpdate, releaseNotes, channel } = req.body

    if (!version) {
      return res.status(400).json({
        error: "Missing required field: version",
      })
    }

    console.log(
      `📢 [BROADCAST_UPDATE] Broadcasting toolbar update to all projects: v${version} (force: ${forceUpdate})`,
    )

    // Отправляем обновление всем подключенным клиентам
    io.emit("toolbar_update_available", {
      version,
      forceUpdate: forceUpdate || false,
      releaseNotes: releaseNotes || `New version ${version} is available`,
      channel: channel || "stable",
    })

    res.json({
      success: true,
      message: `Update broadcasted to all projects`,
      version,
      forceUpdate,
    })
  } catch (error) {
    console.error("❌ [BROADCAST_UPDATE] Error broadcasting toolbar update:", error)
    res.status(500).json({
      error: "Failed to broadcast update",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

// Force toolbar reload for specific project
app.post("/api/toolbar/force-reload", async (req, res) => {
  try {
    const { projectId, reason } = req.body

    if (!projectId) {
      return res.status(400).json({
        error: "Missing required field: projectId",
      })
    }

    console.log(
      `🔄 [FORCE_RELOAD] Forcing toolbar reload for project ${projectId}: ${reason || "no reason"}`,
    )

    // Отправляем команду перезагрузки
    io.to(`project:${projectId}`).emit("toolbar_reload", {
      reason: reason || "Admin requested reload",
    })

    res.json({
      success: true,
      message: `Reload command sent to project ${projectId}`,
      reason,
    })
  } catch (error) {
    console.error("❌ [FORCE_RELOAD] Error forcing toolbar reload:", error)
    res.status(500).json({
      error: "Failed to force reload",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

// API endpoint для получения последней версии агента
app.get("/api/version", (req, res) => {
  try {
    // Здесь можно реализовать проверку последней версии
    // Пока возвращаем статическую версию
    res.json({
      latestAgentVersion: "1.0.0",
      serverVersion: "1.0.0",
      updateAvailable: false,
    })
  } catch (error) {
    console.error("❌ Error in /api/version:", error)
    res.status(500).json({
      error: "Failed to get version info",
    })
  }
})

console.log("🚀 Starting Phion WebSocket Server...")
console.log(`📡 Port: ${PORT}`)

// УДАЛЕНО: extractAndSaveTemplateFiles больше не нужна
// Файлы шаблона теперь создаются при создании проекта через GitHub API

/**
 * Сохранить полный снапшот всех файлов проекта КАК ОДИН КОММИТ
 */
async function saveFullProjectSnapshot(projectId: string, commitMessage?: string): Promise<string> {
  try {
    console.log(`💾 Starting full project snapshot for ${projectId}...`)

    // Получаем pending changes
    const supabase = getSupabaseServerClient()
    const pendingQueries = new PendingChangesQueries(supabase)
    const projectQueries = new ProjectQueries(supabase)
    const commitHistoryQueries = new CommitHistoryQueries(supabase)

    const pendingChanges = await pendingQueries.getAllPendingChanges(projectId)
    console.log(`📋 Found ${pendingChanges.length} pending changes for project ${projectId}`)

    if (pendingChanges.length === 0) {
      console.log(`⚠️ No pending changes found for project ${projectId}, nothing to save`)
      throw new Error("No pending changes to save")
    }

    // Получаем данные проекта
    const project = await projectQueries.getProjectById(projectId)
    if (!project || !project.github_repo_name) {
      throw new Error(`Project ${projectId} not found or missing GitHub repository`)
    }

    // Определяем сообщение коммита
    const finalCommitMessage =
      commitMessage || `Save project changes (${pendingChanges.length} files)`
    console.log(`📄 Creating GitHub commit: ${finalCommitMessage}`)

    // Создаем коммит в GitHub для каждого измененного файла
    const commits: string[] = []
    for (const change of pendingChanges) {
      try {
        if (change.action === "deleted") {
          // TODO: Implement file deletion in GitHub
          console.log(`⚠️ File deletion not yet implemented: ${change.file_path}`)
          continue
        }

        const result = await githubAppService.createOrUpdateFile(
          project.github_repo_name!,
          change.file_path,
          change.content,
          `Update ${change.file_path}`,
        )

        commits.push(result.commit.sha)
        console.log(`✅ Updated file in GitHub: ${change.file_path} (${result.commit.sha})`)
      } catch (error) {
        console.error(`❌ Failed to update file ${change.file_path} in GitHub:`, error)
        throw error
      }
    }

    // Сохраняем информацию о коммите в базу данных
    const mainCommitSha = commits[commits.length - 1] // Последний коммит
    await commitHistoryQueries.createCommitHistory({
      project_id: projectId,
      commit_message: finalCommitMessage,
      github_commit_sha: mainCommitSha,
      github_commit_url: `https://github.com/${project.github_owner}/${project.github_repo_name}/commit/${mainCommitSha}`,
      files_count: pendingChanges.length,
    })

    // 🎯 ТОЛЬКО ПОСЛЕ создания коммита проверяем нужно ли создать Netlify сайт
    const isFirstUserCommit = !project.netlify_site_id
    if (isFirstUserCommit) {
      console.log(
        `🌐 [FIRST_COMMIT] Creating Netlify site for project ${projectId} AFTER user commit...`,
      )

      try {
        // Импортируем Netlify сервис
        const { NetlifyService } = await import("./services/netlify.js")
        const netlifyService = new NetlifyService()

        // 🎯 Теперь создаем Netlify сайт - он сразу будет деплоить актуальный коммит с изменениями
        const netlifySite = await netlifyService.createSiteWithGitHub(
          projectId,
          project.name,
          project.github_repo_name,
          "phion-dev",
        )

        // Сохраняем netlify_site_id в базу данных
        await projectQueries.updateProject(projectId, {
          netlify_site_id: netlifySite.id,
          deploy_status: "building", // Будет автоматически деплоиться актуальный коммит
        })

        // Настраиваем webhooks для уведомлений о деплое
        await netlifyService.setupWebhookForSite(netlifySite.id, projectId)

        console.log(
          `✅ [FIRST_COMMIT] Netlify site created: ${netlifySite.id} for project ${projectId} - will deploy latest commit ${mainCommitSha}`,
        )
      } catch (error) {
        console.error(
          `❌ [FIRST_COMMIT] Failed to create Netlify site for project ${projectId}:`,
          error,
        )
        // Продолжаем выполнение - коммит уже создан, Netlify не критичен
      }
    }

    // Очищаем pending changes после успешного коммита
    await pendingQueries.clearAllPendingChanges(projectId)

    // Логируем очистку pending changes
    console.log(`🧹 Cleared ${pendingChanges.length} pending changes for project ${projectId}`)

    // Логируем создание коммита
    console.log(
      `📝 Commit created: ${mainCommitSha} for project ${projectId} (${pendingChanges.length} files)`,
    )

    // ДОБАВЛЯЕМ СИНХРОНИЗАЦИЮ С ЛОКАЛЬНЫМ АГЕНТОМ
    // Согласно sequenceDiagram.ini строки 313-328
    try {
      console.log(
        `🔄 Syncing local agent with new commit ${mainCommitSha} for project ${projectId}`,
      )

      // Создаем временный токен для git pull
      const temporaryToken = await githubAppService.createTemporaryToken()

      // Отправляем команду git pull с токеном локальному агенту
      io.to(`project:${projectId}`).emit("git_pull_with_token", {
        projectId,
        token: temporaryToken,
        repoUrl: project.github_repo_url,
      })

      console.log(`✅ Git pull command sent to local agent for project ${projectId}`)
    } catch (syncError) {
      console.error(`❌ Error syncing local agent for project ${projectId}:`, syncError)
      // Не прерываем выполнение - коммит уже создан, синхронизация не критична
    }

    console.log(
      `✅ GitHub commit created: ${mainCommitSha} with ${pendingChanges.length} files${
        isFirstUserCommit ? " (first user commit + Netlify site created)" : ""
      }`,
    )
    return mainCommitSha
  } catch (error) {
    console.error(`❌ Error in saveFullProjectSnapshot for project ${projectId}:`, error)
    throw error
  }
}

async function triggerDeploy(projectId: string, commitSha: string): Promise<void> {
  try {
    console.log(`🚀 GitHub commit ${commitSha} created for project ${projectId}`)
    console.log(`🌐 Netlify will automatically deploy from GitHub webhook...`)

    // НОВАЯ ЛОГИКА: Netlify автоматически деплоит при GitHub коммите
    // Просто обновляем статус на "building" и ждем webhook от Netlify

    const supabase = getSupabaseServerClient()
    const projectQueries = new ProjectQueries(supabase)

    // Логируем начало автоматического деплоя
    console.log(`🚀 Deploy status changed: pending -> building for project ${projectId}`)

    // Обновляем статус - Netlify начнет деплой автоматически
    await projectQueries.updateProject(projectId, {
      deploy_status: "building",
    })

    // ВАЖНО: Отправляем WebSocket событие о начале деплоя
    io.to(`project:${projectId}`).emit("deploy_status_update", {
      projectId,
      status: "building",
      timestamp: new Date().toISOString(),
    })

    console.log(`✅ GitHub commit created, Netlify auto-deploy initiated for project ${projectId}`)
    console.log(`📡 Emitted deploy_status_update: building`)
  } catch (error) {
    console.error(`❌ Error in deploy trigger for project ${projectId}:`, error)

    // Логируем ошибку
    console.log(`❌ Deploy status changed: building -> failed for project ${projectId}`)

    // Обновляем статус деплоя как failed
    try {
      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)
      await projectQueries.updateProject(projectId, {
        deploy_status: "failed",
      })

      // Отправляем WebSocket событие об ошибке деплоя
      io.to(`project:${projectId}`).emit("deploy_status_update", {
        projectId,
        status: "failed",
        error: error instanceof Error ? error.message : "Deploy failed",
        timestamp: new Date().toISOString(),
      })
    } catch (updateError) {
      console.error("❌ Error updating deploy status:", updateError)
    }
  }
}

/**
 * Проверить нужен ли автоматический первый деплой и запустить его
 */
async function checkAndTriggerInitialDeploy(projectId: string): Promise<void> {
  try {
    console.log(`🔍 Checking if initial deploy needed for project ${projectId}...`)

    const supabase = getSupabaseServerClient()
    const projectQueries = new ProjectQueries(supabase)
    const historyQueries = new FileHistoryQueries(supabase)

    // Получаем проект
    const project = await projectQueries.getProjectById(projectId)
    if (!project) {
      console.log(`❌ Project ${projectId} not found`)
      return
    }

    // СТРОГАЯ ПРОВЕРКА 1: Если у проекта уже есть netlify_url, то деплой уже был
    if (project.netlify_url) {
      console.log(`✅ Project ${projectId} already has deployment: ${project.netlify_url}`)
      return
    }

    // СТРОГАЯ ПРОВЕРКА 2: Если статус уже 'ready' - деплой завершен
    if (project.deploy_status === "ready") {
      console.log(`✅ Project ${projectId} deploy status is 'ready', skipping auto-deploy`)
      return
    }

    // СТРОГАЯ ПРОВЕРКА 3: Если статус 'building' - деплой уже в процессе
    if (project.deploy_status === "building") {
      console.log(`⏳ Project ${projectId} is already building, skipping auto-deploy`)
      return
    }

    // СТРОГАЯ ПРОВЕРКА 4: Проверяем есть ли уже коммиты (любые коммиты означают что инициализация уже была)
    const existingCommits = await historyQueries.getProjectFileHistory(projectId, 1)
    if (existingCommits.length > 0) {
      console.log(`📄 Project ${projectId} already has commits, skipping auto-deploy`)
      return
    }

    // СТРОГАЯ ПРОВЕРКА 5: Проверяем возраст проекта (только новые проекты)
    const projectAge =
      Date.now() - (project.created_at ? new Date(project.created_at).getTime() : Date.now())
    const fiveMinutes = 5 * 60 * 1000

    if (projectAge >= fiveMinutes) {
      console.log(
        `⏰ Project ${projectId} is too old (${Math.round(
          projectAge / 1000,
        )}s), skipping auto-deploy`,
      )
      return
    }

    // ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ - проект новый и пустой, нужен автодеплой
    console.log(
      `🚀 Project ${projectId} is new and empty (${Math.round(
        projectAge / 1000,
      )}s old), starting initial deploy...`,
    )

    try {
      // НОВАЯ ЛОГИКА GitHub: Файлы шаблона создаются при создании проекта
      // Проверяем, есть ли коммиты в GitHub через commit_history
      const supabaseMain = getSupabaseServerClient()
      const commitHistoryQueries = new CommitHistoryQueries(supabaseMain)
      const existingCommits = await commitHistoryQueries.getProjectCommitHistory(projectId)

      let commitSha: string

      if (existingCommits.length > 0) {
        // Есть коммиты в GitHub - используем последний
        commitSha = existingCommits[0].github_commit_sha
        console.log(`📦 Using existing GitHub commit: ${commitSha}`)
      } else if (project.github_repo_name) {
        // Проверяем есть ли коммиты в GitHub репозитории
        console.log(`📦 No commit history found, checking GitHub directly...`)

        try {
          const commits = await githubAppService.getCommits(project.github_repo_name)
          if (commits.length > 0) {
            commitSha = commits[0].sha
            console.log(`📦 Found GitHub commit: ${commitSha}`)

            // Сохраняем коммит в нашей истории для синхронизации
            await commitHistoryQueries.createCommitHistory({
              project_id: projectId,
              commit_message: commits[0].commit.message,
              github_commit_sha: commitSha,
              github_commit_url: commits[0].html_url,
              files_count: 1,
            })
          } else {
            console.log(`📦 No commits found in GitHub, skipping initial deploy`)
            return // Нет коммитов для деплоя
          }
        } catch (githubError) {
          console.log(`📦 Error checking GitHub commits: ${githubError}, skipping initial deploy`)
          return
        }
      } else {
        console.log(`📦 No GitHub repo configured, skipping initial deploy`)
        return
      }

      // Деплоим найденный коммит
      await triggerDeploy(projectId, commitSha)
      console.log(`✅ Initial deploy triggered for project ${projectId} with commit ${commitSha}`)
    } catch (error) {
      console.error(`❌ Error in initial deploy for project ${projectId}:`, error)
      // Не создаем fallback - просто логируем ошибку
    }
  } catch (error) {
    console.error(`❌ Error in checkAndTriggerInitialDeploy for project ${projectId}:`, error)
  }
}

// Обработка подключений
// Храним состояние подключенных агентов по проектам
const connectedAgents = new Map<string, Set<string>>() // projectId -> Set<socketId>

io.on("connection", (socket) => {
  // 🚨 RATE LIMITING: Check if this IP is being rate limited
  const clientIp = socket.handshake.address || socket.conn.remoteAddress || "unknown"

  if (connectionMonitor.isRateLimited(clientIp)) {
    console.log(`🚫 [RATE_LIMIT] Connection from ${clientIp} blocked (rate limited)`)
    socket.emit("error", {
      message: "Rate limit exceeded. Please try again later.",
    })
    socket.disconnect(true)
    return
  }

  console.log(`✅ Client connected: ${socket.id} from ${clientIp}`)

  // 🕐 CONNECTION TIMEOUT: Auto-disconnect if not authenticated within 30 seconds
  const authTimeout = setTimeout(() => {
    if (!socket.data.projectId) {
      console.log(`⏰ [TIMEOUT] Socket ${socket.id} not authenticated within 30s, disconnecting`)
      socket.emit("error", { message: "Authentication timeout" })
      socket.disconnect(true)
    }
  }, 30000)

  // Обработка аутентификации проекта
  socket.on("authenticate", (data) => {
    clearTimeout(authTimeout) // Clear the auth timeout

    const { projectId, token, clientType, connectionId } = data

    if (!projectId) {
      console.log(`❌ [AUTH] Missing projectId from socket ${socket.id}`)
      socket.emit("error", { message: "Project ID is required" })
      return
    }

    console.log(
      `🔐 [AUTH] Socket ${socket.id} authenticating for project ${projectId} as ${
        clientType || "web"
      } (connectionId: ${connectionId})`,
    )

    // 🚫 CHECK FOR DUPLICATE CONNECTIONS from same client
    const existingConnections = connectionMonitor.activeConnections.get(projectId)
    if (existingConnections && existingConnections.size >= 3) {
      console.log(
        `⚠️ [AUTH] High connection count (${existingConnections.size}) for project ${projectId}, checking for duplicates`,
      )
      // Log existing connection IDs for debugging
      const roomClients = io.sockets.adapter.rooms.get(`project:${projectId}`)
      if (roomClients) {
        console.log(`📊 [AUTH] Existing connections: ${Array.from(roomClients).join(", ")}`)
      }
    }

    // 📊 ADD TO CONNECTION MONITORING
    connectionMonitor.addConnection(projectId, socket.id)

    // Присоединяем к комнате проекта
    socket.join(`project:${projectId}`)
    socket.data.projectId = projectId
    socket.data.clientType = clientType || "web" // По умолчанию web-клиент

    console.log(
      `🔐 Client ${socket.id} authenticated for project ${projectId} (type: ${socket.data.clientType})`,
    )

    // Проверяем текущее состояние комнаты
    const roomClients = io.sockets.adapter.rooms.get(`project:${projectId}`)
    const clientCount = roomClients ? roomClients.size : 0
    const clientIds = roomClients ? Array.from(roomClients) : []

    console.log(
      `📊 [AUTH] Project ${projectId} room now has ${clientCount} clients: ${clientIds.join(", ")}`,
    )

    socket.emit("authenticated", { success: true, projectId })

    // Если это агент - добавляем в список подключенных агентов
    if (clientType === "agent") {
      if (!connectedAgents.has(projectId)) {
        connectedAgents.set(projectId, new Set())
      }
      connectedAgents.get(projectId)!.add(socket.id)

      console.log(`🤖 [AUTH] Agent ${socket.id} added to project ${projectId} agents list`)

      // Уведомляем всех клиентов В КОМНАТЕ ПРОЕКТА о подключении агента
      io.to(`project:${projectId}`).emit("agent_connected", {
        projectId,
        clientId: socket.id,
        timestamp: new Date().toISOString(),
      })

      console.log(`📡 Emitted agent_connected event for project ${projectId} to project room`)

      // Логируем подключение агента
      console.log(`🔌 Agent connected: ${socket.id} to project ${projectId}`)

      // Проверяем нужен ли автоматический первый деплой
      checkAndTriggerInitialDeploy(projectId).catch((error) => {
        console.error(`❌ Error checking initial deploy for project ${projectId}:`, error)
      })
    }

    // Если это веб-клиент - проверяем есть ли уже подключенные агенты
    if (clientType === "web" || !clientType) {
      const projectAgents = connectedAgents.get(projectId)
      if (projectAgents && projectAgents.size > 0) {
        // Отправляем уведомление о том что агент уже подключен
        socket.emit("agent_connected", {
          projectId,
          clientId: Array.from(projectAgents)[0], // Берем первого агента
          timestamp: new Date().toISOString(),
        })

        console.log(
          `📡 Sent existing agent status to new web client ${socket.id} for project ${projectId}`,
        )
      }
    }
  })

  // Обработка изменений файлов (TRACKING ТОЛЬКО)
  socket.on("file_change", async (data) => {
    try {
      const { projectId, filePath, content, hash, timestamp } = data

      if (!projectId || !filePath || content === undefined) {
        socket.emit("error", { message: "Missing required fields" })
        return
      }

      console.log(`📝 File change tracked: ${filePath} in project ${projectId}`)

      // НОВАЯ ЛОГИКА: сохраняем в pending_changes (НЕ в file_history)
      const supabase = getSupabaseServerClient()
      const pendingQueries = new PendingChangesQueries(supabase)
      const historyQueries = new FileHistoryQueries(supabase)

      // Определяем действие (modified/added)
      const existingChange = await pendingQueries.getPendingChange(projectId, filePath)
      const lastVersion = await historyQueries.getLatestFileVersion(projectId, filePath)

      let action: "modified" | "added" = "added"
      if (existingChange || lastVersion) {
        action = "modified"
      }

      // Сохраняем pending change
      await pendingQueries.upsertPendingChange({
        project_id: projectId,
        file_path: filePath,
        content: content,
        action: action,
        content_hash: hash,
        file_size: Buffer.byteLength(content, "utf-8"),
      })

      // Логируем изменение файла
      console.log(`📝 File ${action}: ${filePath} in project ${projectId}`)

      // Уведомляем ВСЕХ клиентов в проекте о staged изменении
      const eventData = {
        projectId,
        filePath,
        content,
        action,
        timestamp: Date.now(),
        status: "staged",
      }

      // Проверяем количество клиентов в комнате
      const roomClients = io.sockets.adapter.rooms.get(`project:${projectId}`)
      const clientCount = roomClients ? roomClients.size : 0

      console.log(`📡 [WebSocket] Sending file_change_staged event to project:${projectId}`, {
        filePath,
        action,
        contentLength: content?.length || 0,
        clientsInRoom: clientCount,
      })

      io.to(`project:${projectId}`).emit("file_change_staged", eventData)

      // Отправляем подтверждение отправителю
      socket.emit("file_tracked", {
        filePath,
        action,
        timestamp: Date.now(),
        status: "tracked",
      })
    } catch (error) {
      console.error("❌ Error tracking file change:", error)
      socket.emit("error", { message: "Failed to track file change" })
    }
  })

  // Обработка удаления файлов (TRACKING ТОЛЬКО)
  socket.on("file_delete", async (data) => {
    try {
      const { projectId, filePath, timestamp } = data

      if (!projectId || !filePath) {
        socket.emit("error", { message: "Missing required fields" })
        return
      }

      console.log(`🗑️ File delete tracked: ${filePath} in project ${projectId}`)

      // НОВАЯ ЛОГИКА: сохраняем в pending_changes как deleted
      const supabase = getSupabaseServerClient()
      const pendingQueries = new PendingChangesQueries(supabase)

      // Сохраняем pending change с action: deleted
      await pendingQueries.upsertPendingChange({
        project_id: projectId,
        file_path: filePath,
        content: "", // Пустой content для deleted файлов
        action: "deleted",
        file_size: 0,
      })

      // Уведомляем ВСЕХ клиентов в проекте о staged удалении
      io.to(`project:${projectId}`).emit("file_change_staged", {
        projectId,
        filePath,
        content: "", // Пустой content для удаленных файлов
        action: "deleted",
        timestamp: Date.now(),
        status: "staged",
      })

      // Отправляем подтверждение отправителю
      socket.emit("file_tracked", {
        filePath,
        action: "deleted",
        timestamp: Date.now(),
        status: "tracked",
      })
    } catch (error) {
      console.error("❌ Error tracking file delete:", error)
      socket.emit("error", { message: "Failed to track file delete" })
    }
  })

  // НОВЫЙ HANDLER: Сохранение полного снапшота проекта
  socket.on("save_all_changes", async (data) => {
    try {
      // Используем projectId из data или из socket.data
      const projectId = data?.projectId || socket.data.projectId
      const commitMessage = data?.commitMessage

      if (!projectId) {
        console.log(`❌ [SAVE] Missing projectId from socket ${socket.id}`)
        socket.emit("error", { message: "Missing projectId" })
        return
      }

      console.log(
        `💾 [SAVE] Received save_all_changes for project ${projectId} from socket ${socket.id}`,
      )

      // Проверяем сколько клиентов в комнате проекта
      const roomClients = io.sockets.adapter.rooms.get(`project:${projectId}`)
      const clientCount = roomClients ? roomClients.size : 0
      const clientIds = roomClients ? Array.from(roomClients) : []

      console.log(
        `📡 [SAVE] Project room project:${projectId} has ${clientCount} clients: ${clientIds.join(
          ", ",
        )}`,
      )

      const commitSha = await saveFullProjectSnapshot(projectId, commitMessage)

      // Получаем данные коммита для уведомления
      const supabase = getSupabaseServerClient()
      const commitQueries = new CommitHistoryQueries(supabase)
      const latestCommit = await commitQueries.getLatestCommit(projectId)

      console.log(`📡 [SAVE] Sending save_success to project:${projectId} room`)

      // Уведомляем ВСЕХ клиентов в проекте о successful save
      io.to(`project:${projectId}`).emit("save_success", {
        projectId,
        commitId: commitSha,
        timestamp: Date.now(),
      })

      console.log(`📡 [SAVE] Sending commit_created to project:${projectId} room`)

      // Уведомляем всех клиентов о новом коммите
      io.to(`project:${projectId}`).emit("commit_created", {
        projectId,
        commit: latestCommit,
        timestamp: Date.now(),
      })

      // Триггерим деплой ТОЛЬКО после сохранения
      console.log(`🚀 [SAVE] Triggering deploy after save for project ${projectId}`)
      triggerDeploy(projectId, commitSha).catch((error) => {
        console.error(`❌ Deploy failed for project ${projectId}:`, error)
      })
    } catch (error) {
      console.error("❌ [SAVE] Error saving changes:", error)
      socket.emit("error", { message: "Failed to save changes" })
    }
  })

  // НОВЫЙ HANDLER: Откат локальных изменений
  socket.on("discard_all_changes", async (data) => {
    try {
      // Используем projectId из data или из socket.data
      const projectId = data?.projectId || socket.data.projectId

      if (!projectId) {
        console.log(`❌ [DISCARD] Missing projectId from socket ${socket.id}`)
        socket.emit("error", { message: "Missing projectId" })
        return
      }

      console.log(
        `🔄 [DISCARD] Received discard_all_changes for project ${projectId} from socket ${socket.id}`,
      )

      const supabase = getSupabaseServerClient()
      const pendingQueries = new PendingChangesQueries(supabase)

      // Очищаем pending changes в базе данных
      console.log(`🗃️ [DISCARD] Clearing pending changes for project ${projectId}`)
      await pendingQueries.clearAllPendingChanges(projectId)

      // Проверяем сколько клиентов в комнате проекта
      const roomClients = io.sockets.adapter.rooms.get(`project:${projectId}`)
      const clientCount = roomClients ? roomClients.size : 0
      const clientIds = roomClients ? Array.from(roomClients) : []

      console.log(
        `📡 [DISCARD] Sending discard_local_changes to project:${projectId} room (${clientCount} clients: ${clientIds.join(
          ", ",
        )})`,
      )

      // Отправляем команду на откат локальному агенту
      io.to(`project:${projectId}`).emit("discard_local_changes", {
        projectId,
        timestamp: Date.now(),
      })

      console.log(`✅ [DISCARD] Discard command sent for project ${projectId}`)

      // Уведомляем ВСЕХ клиентов в проекте об очистке pending changes
      io.to(`project:${projectId}`).emit("discard_success", {
        projectId,
        timestamp: Date.now(),
      })

      console.log(`✅ [DISCARD] Discard success event sent to all clients in project ${projectId}`)
    } catch (error) {
      console.error("❌ [DISCARD] Error discarding changes:", error)
      socket.emit("error", { message: "Failed to discard changes" })
    }
  })

  // НОВЫЙ HANDLER: Синхронизация с GitHub
  socket.on("sync_with_github", async (data) => {
    try {
      const { projectId } = data

      if (!projectId) {
        socket.emit("error", { message: "Missing projectId" })
        return
      }

      console.log(`🔄 Syncing project ${projectId} with GitHub`)

      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)

      // Получаем данные проекта
      const project = await projectQueries.getProjectById(projectId)
      if (!project || !project.github_repo_url) {
        socket.emit("error", {
          message: "Project not found or missing GitHub repo",
        })
        return
      }

      // Импортируем GitHub сервис для создания временного токена

      // Создаем временный токен для git pull
      const temporaryToken = await githubAppService.createTemporaryToken()

      // Отправляем команду git pull с токеном локальному агенту
      io.to(`project:${projectId}`).emit("git_pull_with_token", {
        projectId,
        token: temporaryToken,
        repoUrl: project.github_repo_url,
      })

      console.log(`✅ Git pull command sent for project ${projectId}`)

      // Уведомляем клиента об отправке команды
      socket.emit("sync_initiated", {
        projectId,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error("❌ Error syncing with GitHub:", error)
      socket.emit("error", { message: "Failed to sync with GitHub" })
    }
  })

  // HANDLER: Результат выполнения git команд от локального агента
  socket.on("git_command_result", async (data) => {
    try {
      const { projectId, command, success, error } = data

      console.log(
        `📊 Git command result for project ${projectId}: ${command} - ${
          success ? "SUCCESS" : "FAILED"
        }`,
      )

      if (!success) {
        console.error(`❌ Git command failed: ${error}`)
      }

      // Логируем результат git команды
      console.log(
        `📊 Git command ${success ? "SUCCESS" : "FAILED"} for project ${projectId}: ${command}`,
      )

      // Уведомляем веб-клиентов о результате
      io.to(`project:${projectId}`).emit("git_command_completed", {
        projectId,
        command,
        success,
        error,
        timestamp: Date.now(),
      })
    } catch (logError) {
      console.error("❌ Error logging git command result:", logError)
    }
  })

  // Обработка отключения
  socket.on("disconnect", (reason) => {
    const disconnectTime = new Date().toISOString()
    console.log(`❌ Client disconnected: ${socket.id} (${reason}) at ${disconnectTime}`)

    // 🗑️ REMOVE FROM CONNECTION MONITORING
    if (socket.data.projectId) {
      connectionMonitor.removeConnection(socket.data.projectId, socket.id)
    }

    // 📊 LOG DISCONNECT PATTERNS for debugging
    const disconnectReasons = {
      "transport close": "Network issue or server restart",
      "client namespace disconnect": "Client-initiated disconnect",
      "server namespace disconnect": "Server-initiated disconnect",
      "ping timeout": "Connection became unresponsive",
      "transport error": "Transport-level error",
    }

    const reasonDescription =
      disconnectReasons[reason as keyof typeof disconnectReasons] || "Unknown reason"
    if (reason === "ping timeout" || reason === "transport error") {
      console.log(
        `⚠️ [DISCONNECT_ANALYSIS] ${socket.id}: ${reasonDescription} - potential connection quality issue`,
      )
    }

    if (socket.data.projectId) {
      // Если это был агент - убираем из списка подключенных агентов
      if (socket.data.clientType === "agent") {
        const projectAgents = connectedAgents.get(socket.data.projectId)
        if (projectAgents) {
          projectAgents.delete(socket.id)

          // Если это был последний агент - удаляем запись для проекта
          if (projectAgents.size === 0) {
            connectedAgents.delete(socket.data.projectId)
          }
        }

        // Уведомляем клиентов В КОМНАТЕ ПРОЕКТА об отключении агента
        io.to(`project:${socket.data.projectId}`).emit("agent_disconnected", {
          projectId: socket.data.projectId,
          clientId: socket.id,
          timestamp: disconnectTime,
          reason: reason,
        })

        console.log(
          `📡 Emitted agent_disconnected event for project ${socket.data.projectId} to project room`,
        )

        // Логируем отключение агента
        console.log(
          `🔌 Agent disconnected: ${socket.id} from project ${socket.data.projectId} (${reasonDescription})`,
        )
      }

      // Уведомляем других клиентов в комнате
      socket.to(`project:${socket.data.projectId}`).emit("client_disconnected", {
        clientId: socket.id,
        timestamp: Date.now(),
        reason: reason,
      })
    }
  })

  // ✅ НОВЫЕ ОБРАБОТЧИКИ ДЛЯ TOOLBAR

  // Получить текущий статус проекта для toolbar
  socket.on("toolbar_get_status", async (data) => {
    const projectId = socket.data.projectId
    if (!projectId) {
      socket.emit("error", { message: "Not authenticated" })
      return
    }

    try {
      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)
      const pendingQueries = new PendingChangesQueries(supabase)

      // Получаем данные проекта
      const project = await projectQueries.getProjectById(projectId)
      if (!project) {
        socket.emit("error", { message: "Project not found" })
        return
      }

      // Получаем количество pending changes
      const pendingChanges = await pendingQueries.getAllPendingChanges(projectId)

      // Проверяем подключенных агентов
      const projectAgents = connectedAgents.get(projectId) || new Set()
      const agentConnected = projectAgents.size > 0

      // Определяем реальный статус деплоя
      let deployStatus = project.deploy_status || "ready"

      // Если нет netlify_url, то деплой точно не готов
      if (!project.netlify_url && deployStatus === "ready") {
        deployStatus = "pending"
      }

      // Если есть pending changes, то статус не может быть ready
      if (pendingChanges.length > 0 && deployStatus === "ready") {
        deployStatus = "pending"
      }

      // Отправляем статус
      socket.emit("toolbar_status", {
        pendingChanges: pendingChanges.length,
        deployStatus,
        agentConnected,
        netlifyUrl: project.netlify_url,
      })

      if (socket.data.clientType === "toolbar") {
        console.log(
          `📊 Toolbar status sent for project ${projectId}: ${
            pendingChanges.length
          } pending, ${deployStatus}, agent: ${agentConnected}, url: ${
            project.netlify_url || "none"
          }`,
        )
      }
    } catch (error) {
      console.error(`❌ Error getting toolbar status for project ${projectId}:`, error)
      socket.emit("error", { message: "Failed to get project status" })
    }
  })

  // Алиас для save_all_changes (для toolbar)
  socket.on("toolbar_save_all", async (data) => {
    // Вызываем обработчик напрямую
    const projectId = data?.projectId || socket.data.projectId
    const commitMessage = data?.commitMessage

    if (!projectId) {
      socket.emit("error", { message: "Missing projectId" })
      return
    }

    try {
      console.log(`💾 [TOOLBAR] Saving all changes for project ${projectId}`)

      const commitSha = await saveFullProjectSnapshot(projectId, commitMessage)

      // Получаем данные коммита для уведомления
      const supabase = getSupabaseServerClient()
      const commitQueries = new CommitHistoryQueries(supabase)
      const latestCommit = await commitQueries.getLatestCommit(projectId)

      // Уведомляем ВСЕХ клиентов в проекте о successful save
      io.to(`project:${projectId}`).emit("save_success", {
        projectId,
        commitId: commitSha,
        timestamp: Date.now(),
      })

      // Уведомляем всех клиентов о новом коммите
      io.to(`project:${projectId}`).emit("commit_created", {
        projectId,
        commit: latestCommit,
        timestamp: Date.now(),
      })

      // Триггерим деплой ТОЛЬКО после сохранения
      console.log(`🚀 [TOOLBAR] Triggering deploy after save for project ${projectId}`)
      triggerDeploy(projectId, commitSha).catch((error) => {
        console.error(`❌ Deploy failed for project ${projectId}:`, error)
      })
    } catch (error) {
      console.error("❌ [TOOLBAR] Error saving changes:", error)
      socket.emit("error", { message: "Failed to save changes" })
    }
  })

  // Алиас для discard_all_changes (для toolbar)
  socket.on("toolbar_discard_all", async (data) => {
    // Вызываем обработчик напрямую
    const projectId = data?.projectId || socket.data.projectId

    if (!projectId) {
      socket.emit("error", { message: "Missing projectId" })
      return
    }

    try {
      console.log(`🔄 [TOOLBAR] Discarding all changes for project ${projectId}`)

      const supabase = getSupabaseServerClient()
      const pendingQueries = new PendingChangesQueries(supabase)

      // Очищаем pending changes в базе данных
      await pendingQueries.clearAllPendingChanges(projectId)

      // Отправляем команду на откат локальному агенту
      io.to(`project:${projectId}`).emit("discard_local_changes", {
        projectId,
      })

      console.log(`✅ [TOOLBAR] Discard command sent for project ${projectId}`)

      // Уведомляем ВСЕХ клиентов в проекте об очистке pending changes
      io.to(`project:${projectId}`).emit("discard_success", {
        projectId,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error("❌ [TOOLBAR] Error discarding changes:", error)
      socket.emit("error", { message: "Failed to discard changes" })
    }
  })

  // ✅ NEW: Get commit history for toolbar
  socket.on("toolbar_get_commit_history", async (data) => {
    const projectId = data?.projectId || socket.data.projectId
    const limit = data?.limit || 10
    const offset = data?.offset || 0

    if (!projectId) {
      socket.emit("error", { message: "Missing projectId" })
      return
    }

    try {
      console.log(`📜 [TOOLBAR] Getting commit history for project ${projectId}`)

      const supabase = getSupabaseServerClient()
      const commitQueries = new CommitHistoryQueries(supabase)

      // Получаем историю коммитов
      const commits = await commitQueries.getProjectCommitHistory(projectId, limit, offset)
      const stats = await commitQueries.getCommitStats(projectId)

      const formattedCommits = commits.map((commit) => ({
        id: commit.id,
        sha: commit.github_commit_sha,
        message: commit.commit_message,
        url: commit.github_commit_url,
        filesCount: commit.files_count || 0,
        createdAt: commit.created_at,
        committedBy: commit.committed_by || "System",
      }))

      socket.emit("commit_history_response", {
        commits: formattedCommits,
        stats: {
          totalCommits: stats.total_commits,
          totalFilesChanged: stats.total_files_changed,
          firstCommit: stats.first_commit,
          lastCommit: stats.last_commit,
        },
        pagination: {
          limit,
          offset,
          hasMore: commits.length === limit,
        },
      })

      console.log(`✅ [TOOLBAR] Sent ${commits.length} commits to toolbar`)
    } catch (error) {
      console.error("❌ [TOOLBAR] Error getting commit history:", error)
      socket.emit("error", { message: "Failed to get commit history" })
    }
  })

  // ✅ NEW: Save with AI-generated commit message
  socket.on("toolbar_save_with_ai_message", async (data) => {
    const projectId = data?.projectId || socket.data.projectId

    if (!projectId) {
      socket.emit("error", { message: "Missing projectId" })
      return
    }

    try {
      console.log(`🤖 [TOOLBAR] Generating AI commit message for project ${projectId}`)

      // Генерируем AI сообщение через web API
      const webAppUrl = process.env.WEB_APP_URL || "http://localhost:3004"
      const aiResponse = await fetch(
        `${webAppUrl}/api/projects/${projectId}/generate-commit-message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      if (!aiResponse.ok) {
        throw new Error("Failed to generate AI commit message")
      }

      const aiData = await aiResponse.json()

      // Отправляем AI сообщение клиенту
      socket.emit("ai_commit_message_generated", {
        projectId,
        commitMessage: aiData.commitMessage,
        changesCount: aiData.changesCount,
        files: aiData.files,
      })

      // Теперь сохраняем изменения с AI сообщением
      const commitSha = await saveFullProjectSnapshot(projectId, aiData.commitMessage)

      // Получаем данные коммита для уведомления
      const supabase = getSupabaseServerClient()
      const commitQueries = new CommitHistoryQueries(supabase)
      const latestCommit = await commitQueries.getLatestCommit(projectId)

      // Уведомляем ВСЕХ клиентов в проекте о successful save
      io.to(`project:${projectId}`).emit("save_success", {
        projectId,
        commitId: commitSha,
        timestamp: Date.now(),
      })

      // Уведомляем всех клиентов о новом коммите
      io.to(`project:${projectId}`).emit("commit_created", {
        projectId,
        commit: latestCommit
          ? {
              id: latestCommit.id,
              sha: latestCommit.github_commit_sha,
              message: latestCommit.commit_message,
              url: latestCommit.github_commit_url,
              filesCount: latestCommit.files_count || 0,
              createdAt: latestCommit.created_at,
              committedBy: latestCommit.committed_by || "AI Assistant",
            }
          : null,
        timestamp: Date.now(),
      })

      // Триггерим деплой ТОЛЬКО после сохранения
      console.log(`🚀 [TOOLBAR] Triggering deploy after AI save for project ${projectId}`)
      triggerDeploy(projectId, commitSha).catch((error) => {
        console.error(`❌ Deploy failed for project ${projectId}:`, error)
      })

      console.log(`✅ [TOOLBAR] AI commit saved successfully: "${aiData.commitMessage}"`)
    } catch (error) {
      console.error("❌ [TOOLBAR] Error saving with AI message:", error)
      socket.emit("error", { message: "Failed to save with AI message" })
    }
  })

  // ✅ NEW: Revert to specific commit from toolbar
  socket.on("toolbar_revert_to_commit", async (data) => {
    const projectId = data?.projectId || socket.data.projectId
    const targetCommitSha = data?.targetCommitSha
    const commitMessage = data?.commitMessage

    if (!projectId || !targetCommitSha) {
      socket.emit("error", { message: "Missing projectId or targetCommitSha" })
      return
    }

    try {
      console.log(
        `🔄 [TOOLBAR] Reverting project ${projectId} to commit ${targetCommitSha.substring(0, 7)}`,
      )

      // Получаем данные проекта
      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)
      const project = await projectQueries.getProjectById(projectId)

      if (!project) {
        throw new Error("Project not found")
      }

      // Вызываем наш revert endpoint
      const revertResponse = await fetch(
        `http://localhost:${process.env.PORT || 8080}/api/projects/revert-to-commit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            targetCommitSha,
            commitMessage: commitMessage || `Revert to ${targetCommitSha.substring(0, 7)}`,
            githubRepoName: project.github_repo_name,
            githubOwner: project.github_owner || "phion",
          }),
        },
      )

      if (!revertResponse.ok) {
        const errorData = await revertResponse.json()
        throw new Error(errorData.error || "Failed to revert commit")
      }

      const revertData = await revertResponse.json()
      console.log(`✅ [TOOLBAR] Revert completed successfully: ${revertData.newCommitSha}`)
    } catch (error) {
      console.error("❌ [TOOLBAR] Error reverting to commit:", error)
      socket.emit("error", { message: "Failed to revert to commit" })

      // Отправляем ошибку прогресса
      io.to(`project:${projectId}`).emit("revert_progress", {
        projectId,
        stage: "failed",
        progress: 0,
        message: "Revert operation failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  })

  // Обработка ошибок
  socket.on("error", (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error)
  })
})

// Запускаем сервер
httpServer.listen(PORT, () => {
  console.log(`✅ WebSocket server running on port ${PORT}`)
  console.log(`🔗 Connect to: ws://localhost:${PORT}`)
})

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down WebSocket server...")
  io.close(() => {
    httpServer.close(() => {
      console.log("✅ Server closed")
      process.exit(0)
    })
  })
})

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down...")
  io.close(() => {
    httpServer.close(() => {
      console.log("✅ Server closed")
      process.exit(0)
    })
  })
})

// API endpoint для уведомления о смене статуса проекта
app.post("/api/notify-status-change", async (req, res) => {
  try {
    const { projectId, status, message } = req.body

    if (!projectId || !status) {
      return res.status(400).json({
        error: "Missing required fields: projectId, status",
      })
    }

    console.log(`📡 [STATUS_NOTIFY] Sending status update for project ${projectId}: ${status}`)

    // Отправляем WebSocket событие всем клиентам проекта
    io.to(`project:${projectId}`).emit("deploy_status_update", {
      projectId,
      status,
      message,
      timestamp: new Date().toISOString(),
    })

    console.log(`✅ [STATUS_NOTIFY] WebSocket event sent to project:${projectId} room`)

    res.status(200).json({
      success: true,
      message: "Status notification sent successfully",
      projectId,
      status,
    })
  } catch (error) {
    console.error("❌ [STATUS_NOTIFY] Error sending status notification:", error)
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

// Netlify webhook endpoint
app.post("/webhooks/netlify", async (req, res) => {
  try {
    const { site_id, deploy_id, state, deploy_url, error_message, name } = req.body

    console.log(`🔔 Netlify webhook received:`, {
      site_id,
      deploy_id,
      state,
      deploy_url,
      name,
    })

    // Находим проект по netlify_site_id
    const supabase = getSupabaseServerClient()
    const projectQueries = new ProjectQueries(supabase)

    // Получаем проект по netlify_site_id
    const { data: projects, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("netlify_site_id", site_id)
      .limit(1)

    if (fetchError) {
      console.error("❌ Error fetching project by netlify_site_id:", fetchError)
      return res.status(500).json({ error: "Database error" })
    }

    if (!projects || projects.length === 0) {
      console.log(`⚠️ No project found for netlify_site_id: ${site_id}`)
      return res.status(404).json({ error: "Project not found" })
    }

    const project = projects[0]
    const projectId = project.id
    const currentStatus = project.deploy_status

    // Определяем новый статус на основе состояния Netlify
    let newStatus: "pending" | "building" | "ready" | "failed" | "cancelled"

    switch (state) {
      case "ready": // успешный деплой
        newStatus = "ready"
        break
      case "failed": // deploy_failed event
      case "error": // legacy/fallback
        newStatus = "failed"
        break
      case "created": // deploy_created event
        newStatus = "building"
        break
      case "building": // deploy в процессе
        newStatus = "building"
        break
      default:
        console.log(`⚠️ Unknown netlify state: ${state}`)
        return res.status(200).json({
          message: "Unknown state, no action taken",
          state,
        })
    }

    console.log(`🔄 Updating project ${projectId} status: ${currentStatus} → ${newStatus}`)

    // Обновляем статус в базе данных
    const updateData: any = {
      deploy_status: newStatus,
      updated_at: new Date().toISOString(),
    }

    // Если есть URL деплоя и статус "ready" - обновляем netlify_url
    if (deploy_url && newStatus === "ready") {
      updateData.netlify_url = deploy_url
    }

    // Если есть ошибка - сохраняем её
    if (error_message && newStatus === "failed") {
      updateData.deploy_error = error_message
    }

    const { error: updateError } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", projectId)

    if (updateError) {
      console.error("❌ Error updating project status:", updateError)
      return res.status(500).json({ error: "Database update error" })
    }

    // Отправляем WebSocket уведомление всем клиентам проекта
    io.to(`project:${projectId}`).emit("deploy_status_update", {
      projectId,
      status: newStatus,
      message: `Deploy ${state}${error_message ? `: ${error_message}` : ""}`,
      netlifyUrl: deploy_url,
      timestamp: new Date().toISOString(),
    })

    console.log(`✅ Project ${projectId} status updated and WebSocket event sent`)

    res.status(200).json({
      success: true,
      projectId,
      oldStatus: currentStatus,
      newStatus,
      deployUrl: deploy_url,
    })
  } catch (error) {
    console.error("❌ Error handling Netlify webhook:", error)
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
})
