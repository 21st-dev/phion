import cors from "cors"
import "dotenv/config"
import express from "express"
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

  // 🔐 Обработка изменений в .env файлах
  socket.on("env_file_change", async (data) => {
    try {
      const { projectId, filePath, content, timestamp } = data

      if (!projectId || !filePath || content === undefined) {
        socket.emit("error", { message: "Missing required fields for env file" })
        return
      }

      console.log(`🔐 Env file change detected: ${filePath} in project ${projectId}`)

      // Получаем проект и Netlify site ID
      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)
      const project = await projectQueries.getProjectById(projectId)

      if (!project || !project.netlify_site_id) {
        console.log(`⚠️ Project ${projectId} not found or Netlify site not configured`)
        socket.emit("env_sync_result", {
          success: false,
          error: "Project not configured with Netlify",
          filePath,
        })
        return
      }

      try {
        // Синхронизируем переменные окружения с Netlify
        await netlifyService.syncEnvFile(project.netlify_site_id, content, {
          context: "production", // Можно сделать конфигурируемым
          scopes: ["builds", "functions"],
          deleteUnused: false, // Безопасный режим - не удаляем существующие переменные
        })

        console.log(`✅ Environment variables synced to Netlify for project ${projectId}`)

        // Уведомляем всех клиентов проекта об успешной синхронизации
        io.to(`project:${projectId}`).emit("env_sync_success", {
          projectId,
          filePath,
          timestamp: Date.now(),
          message: "Environment variables synced with Netlify",
        })

        // Отправляем подтверждение отправителю
        socket.emit("env_sync_result", {
          success: true,
          filePath,
          message: "Environment variables synced with Netlify",
        })
      } catch (netlifyError) {
        console.error(`❌ Error syncing env variables to Netlify:`, netlifyError)

        // Уведомляем об ошибке синхронизации
        socket.emit("env_sync_result", {
          success: false,
          error: netlifyError instanceof Error ? netlifyError.message : "Sync failed",
          filePath,
        })

        // Уведомляем всех клиентов проекта об ошибке
        io.to(`project:${projectId}`).emit("env_sync_error", {
          projectId,
          filePath,
          error: netlifyError instanceof Error ? netlifyError.message : "Sync failed",
          timestamp: Date.now(),
        })
      }
    } catch (error) {
      console.error("❌ Error handling env file change:", error)
      socket.emit("error", { message: "Failed to process env file change" })
    }
  })

  // 🗑️ Обработка удаления .env файлов
  socket.on("env_file_delete", async (data) => {
    try {
      const { projectId, filePath, timestamp } = data

      if (!projectId || !filePath) {
        socket.emit("error", { message: "Missing required fields for env file deletion" })
        return
      }

      console.log(`🗑️ Env file deleted: ${filePath} in project ${projectId}`)

      // Получаем проект
      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)
      const project = await projectQueries.getProjectById(projectId)

      if (!project || !project.netlify_site_id) {
        console.log(`⚠️ Project ${projectId} not found or Netlify site not configured`)
        return
      }

      // Логируем удаление, но НЕ очищаем переменные в Netlify автоматически
      // Это может быть опасно - пользователь может случайно удалить файл
      console.log(
        `⚠️ Env file ${filePath} deleted for project ${projectId}. Netlify variables preserved for safety.`,
      )

      // Уведомляем всех клиентов проекта об удалении env файла
      io.to(`project:${projectId}`).emit("env_file_deleted", {
        projectId,
        filePath,
        timestamp: Date.now(),
        message: "Environment file deleted. Netlify variables preserved for safety.",
      })

      // Отправляем подтверждение отправителю
      socket.emit("env_sync_result", {
        success: true,
        filePath,
        message: "Environment file deletion noted. Netlify variables preserved.",
      })
    } catch (error) {
      console.error("❌ Error handling env file deletion:", error)
      socket.emit("error", { message: "Failed to process env file deletion" })
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

  // НОВЫЙ HANDLER: Открытие preview через WebSocket
  socket.on("toolbar_open_preview", async (data) => {
    const projectId = data?.projectId || socket.data.projectId

    if (!projectId) {
      socket.emit("error", { message: "Missing projectId" })
      return
    }

    try {
      console.log(`🌐 [TOOLBAR] Preview open request for project ${projectId}`)

      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)

      // Получаем данные проекта
      const project = await projectQueries.getProjectById(projectId)
      if (!project) {
        socket.emit("error", { message: "Project not found" })
        return
      }

      if (!project.netlify_url) {
        console.log(`❌ [TOOLBAR] No preview URL for project ${projectId}`)
        socket.emit("toolbar_preview_response", {
          success: false,
          error: "No preview URL available yet",
        })
        return
      }

      console.log(`✅ [TOOLBAR] Preview URL for project ${projectId}: ${project.netlify_url}`)

      // Отправляем URL обратно в toolbar для обработки
      socket.emit("toolbar_preview_response", {
        success: true,
        url: project.netlify_url,
        projectId,
      })
    } catch (error) {
      console.error(`❌ [TOOLBAR] Error getting preview URL for project ${projectId}:`, error)
      socket.emit("error", { message: "Failed to get preview URL" })
    }
  })

  // ========= TOOLBAR AUTO-UPDATE HANDLERS =========

  // Проверка обновлений toolbar
  socket.on("toolbar_check_updates", async (data) => {
    const projectId = socket.data.projectId
    if (!projectId) {
      socket.emit("error", { message: "Not authenticated" })
      return
    }

    try {
      console.log(`🔄 [TOOLBAR_UPDATE] Update check requested for project ${projectId}`)

      // Делаем запрос к нашему API endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3004"}/api/toolbar/check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentVersion: data?.currentVersion || "0.1.0",
            channel: data?.channel || "stable",
            projectId,
          }),
        },
      )

      if (response.ok) {
        const updateInfo = (await response.json()) as {
          hasUpdate: boolean
          latestVersion?: {
            version: string
            releaseNotes?: string
          }
          forceUpdate?: boolean
        }

        if (updateInfo.hasUpdate && updateInfo.latestVersion) {
          console.log(
            `🚀 [TOOLBAR_UPDATE] Update available for project ${projectId}: ${updateInfo.latestVersion.version}`,
          )

          // Отправляем уведомление об обновлении
          socket.emit("toolbar_update_available", {
            version: updateInfo.latestVersion.version,
            forceUpdate: updateInfo.forceUpdate || false,
            releaseNotes: updateInfo.latestVersion.releaseNotes,
          })
        } else {
          console.log(`✅ [TOOLBAR_UPDATE] No updates available for project ${projectId}`)
        }
      } else {
        console.log(`❌ [TOOLBAR_UPDATE] Failed to check updates: ${response.status}`)
      }
    } catch (error) {
      console.error(`❌ [TOOLBAR_UPDATE] Error checking updates for project ${projectId}:`, error)
    }
  })

  // Подтверждение получения обновления
  socket.on("toolbar_update_acknowledged", async (data) => {
    const projectId = socket.data.projectId
    const version = data?.version

    if (!projectId || !version) {
      return
    }

    console.log(
      `📝 [TOOLBAR_UPDATE] Update acknowledged for project ${projectId}, version ${version}`,
    )
  })

  // Уведомление об успешном обновлении
  socket.on("toolbar_update_success", async (data) => {
    const projectId = socket.data.projectId
    const version = data?.version

    if (!projectId || !version) {
      return
    }

    console.log(
      `✅ [TOOLBAR_UPDATE] Update successful for project ${projectId}, version ${version}`,
    )
  })

  // Уведомление об ошибке обновления
  socket.on("toolbar_update_error", async (data) => {
    const projectId = socket.data.projectId
    const version = data?.version
    const error = data?.error

    if (!projectId || !version) {
      return
    }

    console.log(
      `❌ [TOOLBAR_UPDATE] Update error for project ${projectId}, version ${version}: ${error}`,
    )
  })

  // Обработка ошибок
  socket.on("error", (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error)
  })

  // ========= INSERT PROMPT HANDLING =========

  // Обработка insert_prompt событий от toolbar - транслируем другим клиентам
  socket.on("insert_prompt", async (data) => {
    const projectId = data?.projectId || socket.data.projectId

    if (!projectId) {
      socket.emit("error", { message: "Missing projectId" })
      return
    }

    if (!data?.prompt) {
      socket.emit("error", { message: "Missing prompt" })
      return
    }

    console.log(`💬 [INSERT_PROMPT] Received prompt for project ${projectId} from ${socket.id}`)
    console.log(`💬 [INSERT_PROMPT] Prompt preview: ${data.prompt.substring(0, 100)}...`)

    // Проверяем сколько клиентов в комнате проекта
    const roomClients = io.sockets.adapter.rooms.get(`project:${projectId}`)
    const clientCount = roomClients ? roomClients.size : 0
    const clientIds = roomClients ? Array.from(roomClients) : []

    console.log(
      `📡 [INSERT_PROMPT] Broadcasting to project:${projectId} room (${clientCount} clients: ${clientIds.join(", ")})`,
    )

    // Транслируем событие всем клиентам в комнате проекта (включая VSCode extension)
    io.to(`project:${projectId}`).emit("insert_prompt", {
      projectId,
      prompt: data.prompt,
      timestamp: Date.now(),
      source: socket.data.clientType || "unknown",
    })

    console.log(`✅ [INSERT_PROMPT] Prompt broadcasted to all clients in project ${projectId}`)
  })

  // ========= RUNTIME ERROR HANDLING =========

  // Обработка runtime ошибок от toolbar - простое проксирование
  socket.on("toolbar_runtime_error", async (payload) => {
    const projectId = socket.data.projectId

    if (!projectId) {
      return
    }

    // Простое логирование для отладки
    console.log(
      `🐛 [RUNTIME_ERROR] Runtime error for project ${projectId}:`,
      payload?.error?.message || "unknown error",
    )

    // Проксируем событие всем клиентам проекта без дополнительной обработки
    io.to(`project:${projectId}`).emit("toolbar_runtime_error", payload)
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
      case "building": // deploy_building event + polling
      case "started": // legacy fallback
      case "enqueued":
      case "new":
        newStatus = "building"
        break
      default:
        console.log(`⚠️ Unknown Netlify state: ${state}, defaulting to building`)
        newStatus = "building"
    }

    // 🎯 ИСПРАВЛЕНИЕ: Предотвращаем деградацию статуса
    // Если проект уже ready, не позволяем webhook'ам building его откатить
    if (currentStatus === "ready" && newStatus === "building") {
      console.log(
        `⚠️ Ignoring building status webhook for project ${projectId} - already ready (webhook delay)`,
      )
      return res.status(200).json({
        success: true,
        message: "Webhook ignored - preventing status degradation",
        projectId,
        currentStatus,
        ignoredStatus: newStatus,
      })
    }

    // Если проект уже failed, не позволяем building его обновить (но ready может)
    if (currentStatus === "failed" && newStatus === "building") {
      console.log(`⚠️ Ignoring building status webhook for project ${projectId} - already failed`)
      return res.status(200).json({
        success: true,
        message: "Webhook ignored - project already failed",
        projectId,
        currentStatus,
        ignoredStatus: newStatus,
      })
    }

    // Если статус не изменился, тоже пропускаем
    if (currentStatus === newStatus) {
      console.log(
        `⚠️ Skipping webhook for project ${projectId} - status unchanged (${currentStatus})`,
      )
      return res.status(200).json({
        success: true,
        message: "Webhook ignored - status unchanged",
        projectId,
        status: currentStatus,
      })
    }

    console.log(`📊 Updating project ${projectId} deploy status: ${currentStatus} → ${newStatus}`)

    // Обновляем проект в базе данных
    const updateData: any = {
      deploy_status: newStatus,
      netlify_deploy_id: deploy_id,
    }

    // Обновляем URL только если деплой успешен и URL предоставлен
    if (newStatus === "ready" && deploy_url) {
      updateData.netlify_url = deploy_url
      console.log(`🌐 Updating netlify_url to: ${deploy_url}`)
    }

    await projectQueries.updateProject(projectId, updateData)

    // Логируем изменение статуса деплоя
    console.log(
      `🚀 Deploy status change for project ${projectId}: ${currentStatus} -> ${newStatus}`,
    )

    // Отправляем уведомление через WebSocket всем подключенным клиентам проекта
    io.to(`project:${projectId}`).emit("deploy_status_update", {
      projectId,
      status: newStatus,
      url: deploy_url,
      error: error_message,
      timestamp: new Date().toISOString(),
    })

    console.log(`✅ Webhook processed successfully for project ${projectId}`)
    console.log(`📡 Emitted deploy status update: ${newStatus} - ${deploy_url || "no URL"}`)

    res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
      projectId,
      statusChange: `${currentStatus} → ${newStatus}`,
    })
  } catch (error) {
    console.error("❌ Error processing Netlify webhook:", error)
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

// ✅ Добавляем новый endpoint для инициализации проекта из Next.js
app.post("/api/projects/initialize", async (req, res) => {
  try {
    const { projectId, templateType, projectName, repositoryName } = req.body

    if (!projectId || !templateType || !projectName || !repositoryName) {
      return res.status(400).json({
        error: "Missing required fields: projectId, templateType, projectName, repositoryName",
      })
    }

    console.log(`🚀 [INIT_PROJECT] Starting project initialization for ${projectId}...`)

    // Запускаем инициализацию в фоне (здесь это безопасно - Railway не засыпает)
    initializeProjectInBackground(projectId, templateType, projectName, repositoryName).catch(
      (error) => {
        console.error(`❌ [INIT_PROJECT] Background initialization failed for ${projectId}:`, error)
      },
    )

    // Немедленно отвечаем клиенту
    res.status(200).json({
      success: true,
      message: "Project initialization started",
      projectId,
    })
  } catch (error) {
    console.error("❌ [INIT_PROJECT] Error starting project initialization:", error)
    res.status(500).json({
      error: "Failed to start project initialization",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

/**
 * 🚀 Фоновая инициализация проекта - перенесено из Next.js
 * Здесь безопасно работать в фоне - Railway не засыпает
 */
async function initializeProjectInBackground(
  projectId: string,
  templateType: string,
  projectName: string,
  repositoryName: string,
): Promise<void> {
  console.log(`🔄 [INIT_BG] Starting template upload for ${projectId}...`)

  try {
    const supabase = getSupabaseServerClient()
    const projectQueries = new ProjectQueries(supabase)
    const commitHistoryQueries = new CommitHistoryQueries(supabase)

    // 1. Генерируем файлы шаблона
    console.log(`📡 [INIT_BG] Sending initialization_progress to project:${projectId}`)
    io.to(`project:${projectId}`).emit("initialization_progress", {
      projectId,
      stage: "generating_files",
      progress: 10,
      message: "Setting up your project...",
    })

    const templateFiles = await generateTemplateFiles(projectId, templateType, projectName)
    console.log(`📋 [INIT_BG] Generated ${Object.keys(templateFiles).length} template files`)

    io.to(`project:${projectId}`).emit("initialization_progress", {
      projectId,
      stage: "uploading_files",
      progress: 20,
      message: "Uploading project files...",
    })

    const fileEntries = Object.entries(templateFiles)
    const totalFiles = fileEntries.length
    const chunkSize = 5
    const totalChunks = Math.ceil(totalFiles / chunkSize)

    // Получаем parent commit для создания нового коммита (теперь всегда должен существовать, т.к. auto_init: true)
    console.log(`🔍 [INIT_BG] About to call getLatestCommit for repository: ${repositoryName}`)
    const parentCommit = await githubAppService.getLatestCommit(repositoryName)
    console.log(`🔍 [INIT_BG] getLatestCommit returned:`, parentCommit)

    if (!parentCommit) {
      throw new Error(
        "Repository should be initialized with auto_init: true, but no parent commit found",
      )
    }

    console.log(`🔍 [INIT_BG] Parent commit: ${parentCommit.sha}`)

    io.to(`project:${projectId}`).emit("initialization_progress", {
      projectId,
      stage: "creating_blobs",
      progress: 30,
      message: "Processing files...",
    })

    // Создаем blobs по чанкам с прогрессом
    const blobs: { path: string; sha: string }[] = []

    for (let i = 0; i < totalChunks; i++) {
      const startIdx = i * chunkSize
      const endIdx = Math.min(startIdx + chunkSize, totalFiles)
      const chunk = fileEntries.slice(startIdx, endIdx)

      // Создаем blobs для текущего чанка
      const chunkBlobs = await Promise.all(
        chunk.map(async ([path, content]) => {
          const blob = await githubAppService.createBlob(repositoryName, content)
          return { path, sha: blob.sha }
        }),
      )

      blobs.push(...chunkBlobs)

      // Отправляем прогресс
      const progressPercent = 30 + ((i + 1) / totalChunks) * 40 // 30% - 70%
      io.to(`project:${projectId}`).emit("initialization_progress", {
        projectId,
        stage: "creating_blobs",
        progress: Math.round(progressPercent),
        message: "Processing files...",
      })

      // Небольшая задержка между чанками
      if (i < totalChunks - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    io.to(`project:${projectId}`).emit("initialization_progress", {
      projectId,
      stage: "creating_commit",
      progress: 80,
      message: "Saving project...",
    })

    // Создаем tree и коммит (с базовым tree от parent commit)
    console.log(`🌳 [INIT_BG] Creating tree with base tree from parent commit...`)
    const tree = await githubAppService.createTree(repositoryName, blobs, parentCommit.sha)

    console.log(`📝 [INIT_BG] Creating commit with parent: ${parentCommit.sha}`)
    const commit = await githubAppService.createCommit(
      repositoryName,
      "Initial commit from template",
      tree.sha,
      [parentCommit.sha],
    )

    // Обновляем main ветку (теперь всегда существует благодаря auto_init: true)
    console.log(`🔄 [INIT_BG] Updating main branch with new commit: ${commit.sha}`)
    await githubAppService.updateRef(repositoryName, "heads/main", commit.sha)
    console.log(`✅ [INIT_BG] Successfully updated main branch`)

    console.log(`✅ [INIT_BG] Uploaded ${totalFiles} files in one commit`)
    const mainCommitSha = commit.sha

    // 3. Создаем запись в commit_history
    if (mainCommitSha) {
      const commitRecord = await commitHistoryQueries.createCommitHistory({
        project_id: projectId,
        commit_message: "Initial commit from template",
        github_commit_sha: mainCommitSha,
        github_commit_url: `https://github.com/phion-dev/${repositoryName}/commit/${mainCommitSha}`,
        files_count: Object.keys(templateFiles).length,
      })

      // Отправляем WebSocket событие о создании коммита
      console.log(`📡 [INIT_BG] Sending commit_created event to project:${projectId}`)
      io.to(`project:${projectId}`).emit("commit_created", {
        projectId,
        commit: {
          commit_id: commitRecord.id,
          commit_message: "Initial commit from template",
          created_at: commitRecord.created_at,
          files_count: Object.keys(templateFiles).length,
          github_commit_sha: mainCommitSha,
          github_commit_url: `https://github.com/phion-dev/${repositoryName}/commit/${mainCommitSha}`,
        },
      })
      console.log(`✅ [INIT_BG] commit_created event sent for initial commit`)
    }

    // 4. ✅ Обновляем статус проекта как готовый к скачиванию
    io.to(`project:${projectId}`).emit("initialization_progress", {
      projectId,
      stage: "finalizing",
      progress: 90,
      message: "Almost ready...",
    })

    await projectQueries.updateProject(projectId, {
      deploy_status: "ready", // Проект готов к скачиванию и разработке
    })

    // 5. 🚀 Отправляем WebSocket событие о завершении инициализации
    console.log(`📡 [INIT_BG] Sending final initialization_progress (100%) to project:${projectId}`)
    io.to(`project:${projectId}`).emit("initialization_progress", {
      projectId,
      stage: "completed",
      progress: 100,
      message: "Project ready for download!",
    })

    console.log(`📡 [INIT_BG] Sending deploy_status_update to project:${projectId}`)
    io.to(`project:${projectId}`).emit("deploy_status_update", {
      status: "ready",
      message: "Project initialization completed",
      projectId,
    })

    console.log(
      `🎉 [INIT_BG] Template upload completed for ${projectId}! Project ready for development.`,
    )
  } catch (error) {
    console.error(`❌ [INIT_BG] Template upload failed for ${projectId}:`, error)

    try {
      console.log(`🔄 [INIT_BG] Updating project status to failed for ${projectId}...`)

      // Обновляем статус на failed
      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)
      await projectQueries.updateProject(projectId, {
        deploy_status: "failed",
      })
      console.log(`✅ [INIT_BG] Project status updated to failed for ${projectId}`)

      // Отправляем WebSocket событие об ошибке
      console.log(`📡 [INIT_BG] Sending deploy_status_update (failed) to project:${projectId}`)
      io.to(`project:${projectId}`).emit("deploy_status_update", {
        status: "failed",
        message: "Project initialization failed",
        projectId,
        timestamp: new Date().toISOString(),
      })
      console.log(`✅ [INIT_BG] WebSocket event sent for failed initialization`)
    } catch (updateError) {
      console.error(`❌ [INIT_BG] Failed to update project status for ${projectId}:`, updateError)
    }

    throw error
  }
}

/**
 * Генерирует файлы шаблона с настройками проекта
 * Перенесено из Next.js для работы в WebSocket сервере
 */
async function generateTemplateFiles(
  projectId: string,
  templateType: string,
  projectName: string,
): Promise<Record<string, string>> {
  console.log(`🔄 [TEMPLATE] Generating template files for ${projectId} (${templateType})`)

  // Импортируем необходимые модули
  const fs = await import("fs")
  const path = await import("path")

  // Путь к шаблону (относительно корня workspace)
  const templatePath = path.join(process.cwd(), "..", "..", "templates", templateType)

  if (!fs.existsSync(templatePath)) {
    // Пробуем альтернативный путь
    const alternativeTemplatePath = path.join(process.cwd(), "templates", templateType)
    if (!fs.existsSync(alternativeTemplatePath)) {
      throw new Error(`Template ${templateType} not found`)
    }
    return await collectTemplateFiles(alternativeTemplatePath, projectName, projectId)
  }

  return await collectTemplateFiles(templatePath, projectName, projectId)
}

/**
 * Собирает все файлы из шаблона и применяет необходимые трансформации
 */
async function collectTemplateFiles(
  templatePath: string,
  projectName: string,
  projectId: string,
): Promise<Record<string, string>> {
  const fs = await import("fs")
  const path = await import("path")

  const templateFiles: Record<string, string> = {}

  function collectFiles(dirPath: string, relativePath: string = ""): void {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const item of items) {
      // Пропускаем служебные папки
      if (
        item.name === "node_modules" ||
        item.name === ".git" ||
        item.name === "dist" ||
        item.name === ".next"
      ) {
        continue
      }

      const fullPath = path.join(dirPath, item.name)
      const relativeFilePath = relativePath ? path.join(relativePath, item.name) : item.name

      if (item.isDirectory()) {
        collectFiles(fullPath, relativeFilePath)
      } else {
        let content = fs.readFileSync(fullPath, "utf-8")

        // Применяем трансформации для специальных файлов
        if (item.name === "package.json") {
          const packageJson = JSON.parse(content)
          packageJson.name = projectName.toLowerCase().replace(/\s+/g, "-")
          content = JSON.stringify(packageJson, null, 2)
        } else if (item.name === "phion.config.json") {
          // Заменяем PROJECT_ID в конфигурационном файле
          content = content.replace(/__PROJECT_ID__/g, projectId)

          // Заменяем WS_URL в зависимости от окружения
          const wsUrl =
            process.env.NODE_ENV === "production" ? "wss://api.phion.dev" : "ws://localhost:8080"
          content = content.replace(/__WS_URL__/g, wsUrl)

          // Заменяем DEBUG_MODE в зависимости от окружения
          const debugMode = process.env.NODE_ENV === "production" ? "false" : "true"
          content = content.replace(/"__DEBUG_MODE__"/g, debugMode)
        }

        // Нормализуем пути (заменяем \ на /)
        const normalizedPath = relativeFilePath.replace(/\\/g, "/")
        templateFiles[normalizedPath] = content
      }
    }
  }

  collectFiles(templatePath)

  console.log(`📋 [TEMPLATE] Collected ${Object.keys(templateFiles).length} files from template`)
  return templateFiles
}

// ✅ Добавляем endpoint для создания GitHub репозитория из Next.js
app.post("/api/projects/create-repository", async (req, res) => {
  try {
    const { projectId, projectName } = req.body

    if (!projectId || !projectName) {
      return res.status(400).json({
        error: "Missing required fields: projectId, projectName",
      })
    }

    console.log(`🚀 [CREATE_REPO] Creating GitHub repository for project ${projectId}...`)

    // Создаем GitHub репозиторий
    const repository = await githubAppService.createRepository(
      projectId,
      `Phion project: ${projectName}`,
    )

    console.log(`✅ [CREATE_REPO] GitHub repository created: ${repository.html_url}`)

    // Обновляем проект с GitHub данными
    const supabase = getSupabaseServerClient()
    const projectQueries = new ProjectQueries(supabase)

    await projectQueries.updateGitHubInfo(projectId, {
      github_repo_url: repository.html_url,
      github_repo_name: repository.name,
      github_owner: "phion-dev",
    })

    res.status(200).json({
      success: true,
      repository: {
        html_url: repository.html_url,
        name: repository.name,
        owner: "phion-dev",
      },
    })
  } catch (error) {
    console.error("❌ [CREATE_REPO] Error creating GitHub repository:", error)
    res.status(500).json({
      error: "Failed to create GitHub repository",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

// ✅ NEW: Complete project initialization endpoint - handles everything in one place
app.post("/api/projects/initialize-complete", async (req, res) => {
  try {
    const { projectId, projectName, templateType, userId } = req.body

    if (!projectId || !projectName || !templateType || !userId) {
      return res.status(400).json({
        error: "Missing required fields: projectId, projectName, templateType, userId",
      })
    }

    console.log(`🚀 [INIT_COMPLETE] Starting complete project initialization for ${projectId}...`)

    // Start the complete initialization process in the background
    // This is safe here - Railway doesn't sleep like Vercel serverless functions
    completeProjectInitialization(projectId, projectName, templateType, userId).catch((error) => {
      console.error(`❌ [INIT_COMPLETE] Complete initialization failed for ${projectId}:`, error)
    })

    // Immediately respond to the client
    res.status(200).json({
      success: true,
      message: "Complete project initialization started",
      projectId,
    })
  } catch (error) {
    console.error("❌ [INIT_COMPLETE] Error starting complete project initialization:", error)
    res.status(500).json({
      error: "Failed to start complete project initialization",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

/**
 * ✅ Complete project initialization - handles everything in the background
 * This replaces the logic that was in the Next.js API route
 */
async function completeProjectInitialization(
  projectId: string,
  projectName: string,
  templateType: string,
  userId: string,
): Promise<void> {
  try {
    console.log(`🚀 [COMPLETE_INIT] Starting complete initialization for ${projectId}...`)

    // 1. Create GitHub repository
    console.log(`🔄 [COMPLETE_INIT] Creating GitHub repository...`)
    const repository = await githubAppService.createRepository(
      projectId,
      `Phion project: ${projectName}`,
    )

    // Update project with GitHub info
    const supabase = getSupabaseServerClient()
    const projectQueries = new ProjectQueries(supabase)
    await projectQueries.updateGitHubInfo(projectId, {
      github_repo_url: repository.html_url,
      github_repo_name: repository.name,
      github_owner: "phion-dev",
    })

    console.log(`✅ [COMPLETE_INIT] GitHub repository created: ${repository.html_url}`)

    // 2. Initialize template
    console.log(`🔄 [COMPLETE_INIT] Starting template initialization...`)
    await initializeProjectInBackground(projectId, templateType, projectName, repository.name)

    console.log(`✅ [COMPLETE_INIT] Complete initialization finished for ${projectId}`)
  } catch (error) {
    console.error(`❌ [COMPLETE_INIT] Complete initialization failed for ${projectId}:`, error)

    // Update project status to failed
    try {
      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)
      await projectQueries.updateProject(projectId, {
        deploy_status: "failed",
      })
      console.log(`📊 Updated project ${projectId} status to failed`)

      // Send WebSocket event about failure
      io.to(`project:${projectId}`).emit("deploy_status_update", {
        status: "failed",
        message: "Project initialization failed",
        projectId,
        timestamp: new Date().toISOString(),
      })
    } catch (updateError) {
      console.error(`❌ Error updating project status for ${projectId}:`, updateError)
    }

    // Rethrow for logging
    throw error
  }
}

/**
 * Retry helper with exponential backoff - moved here to be reused
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  context: string,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation()
      if (attempt > 1) {
        console.log(`✅ [RETRY] ${context} succeeded on attempt ${attempt}`)
      }
      return result
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        console.error(
          `❌ [RETRY] ${context} failed after ${maxAttempts} attempts:`,
          lastError.message,
        )
        break
      }

      // Check if error is retryable
      const isRetryable = shouldRetryError(error)
      if (!isRetryable) {
        console.error(`❌ [RETRY] ${context} failed with non-retryable error:`, lastError.message)
        break
      }

      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
      console.log(
        `⚠️ [RETRY] ${context} attempt ${attempt} failed, retrying in ${Math.round(delay)}ms:`,
        lastError.message,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Determines if an error should trigger a retry
 */
function shouldRetryError(error: any): boolean {
  // Retry on server errors (5xx)
  if (error?.status >= 500) return true

  // Retry on rate limiting
  if (error?.status === 429) return true

  // Don't retry on client errors (4xx except 429)
  if (error?.status >= 400 && error?.status < 500) return false

  // Retry on network/timeout errors
  if (
    error?.code === "ENOTFOUND" ||
    error?.code === "ECONNRESET" ||
    error?.code === "ETIMEDOUT" ||
    error?.name === "AbortError" ||
    error?.message?.includes("fetch failed") ||
    error?.message?.includes("network") ||
    error?.message?.includes("timeout")
  ) {
    return true
  }

  return false
}
