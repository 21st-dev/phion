import fetch from "node-fetch"
import { getSupabaseServerClient, ProjectQueries } from "@shipvibes/database"

// Vercel API Response Types
interface VercelProjectResponse {
  id: string
  name: string
  accountId: string
  framework: string
  devCommand?: string
  buildCommand?: string
  outputDirectory?: string
  publicSource?: boolean
  link?: {
    type: "github"
    repo: string
    repoId: number
    org?: string
    gitCredentialId?: string
  }
  targets?: {
    production: {
      id: string
      domain: string
      url: string
    }
  }
  createdAt: number
  updatedAt: number
}

interface VercelCreateProjectRequest {
  name: string
  framework: "nextjs"
  buildCommand?: string
  devCommand?: string
  installCommand?: string
  outputDirectory?: string
  publicSource?: boolean
  gitRepository?: {
    type: "github"
    repo: string
  }
}

interface VercelDeploymentResponse {
  uid: string
  name: string
  url: string
  state: "BUILDING" | "READY" | "ERROR" | "CANCELED"
  type: "LAMBDAS"
  creator: {
    uid: string
  }
  inspectorUrl?: string
  meta?: Record<string, any>
  target?: "production" | "staging"
  aliasAssigned?: boolean
  aliasError?: any
  createdAt: number
  buildingAt?: number
  readyAt?: number
}

interface VercelEnvVar {
  key: string
  value: string
  type: "encrypted" | "plain"
  target: ("production" | "preview" | "development")[]
  gitBranch?: string
  configurationId?: string
  updatedAt?: number
  createdAt?: number
}

export class VercelService {
  private apiToken: string
  private baseUrl = "https://api.vercel.com"
  private io?: any // Socket.io instance для real-time обновлений

  constructor(io?: any) {
    this.apiToken = process.env.VERCEL_API_TOKEN!
    this.io = io

    if (!this.apiToken) {
      throw new Error("VERCEL_API_TOKEN environment variable is required")
    }
  }

  /**
   * Создать новый проект на Vercel с привязкой к GitHub репозиторию
   */
  async createProject(
    projectId: string,
    projectName: string,
    githubRepoName: string,
    githubOwner: string,
  ): Promise<VercelProjectResponse> {
    try {
      const requestBody: VercelCreateProjectRequest = {
        name: `phion-${projectId.slice(0, 8)}`,
        framework: "nextjs",
        buildCommand: "pnpm build",
        devCommand: "pnpm dev",
        installCommand: "pnpm install",
        outputDirectory: ".next",
        publicSource: false,
        gitRepository: {
          type: "github",
          repo: `${githubOwner}/${githubRepoName}`,
        },
      }

      console.log("🚀 Creating Vercel project with GitHub integration:", {
        projectId,
        repoName: githubRepoName,
        owner: githubOwner,
        buildCmd: requestBody.buildCommand,
      })

      const response = await fetch(`${this.baseUrl}/v9/projects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ Vercel API error:", errorText)
        throw new Error(`Failed to create Vercel project: ${response.status} ${errorText}`)
      }

      const data = (await response.json()) as VercelProjectResponse

      console.log("✅ Created Vercel project with GitHub integration:", {
        projectId: data.id,
        name: data.name,
        framework: data.framework,
        repoLink: data.link?.repo,
      })

      return data
    } catch (error) {
      console.error("❌ Error creating Vercel project with GitHub:", error)
      throw error
    }
  }

  /**
   * Получить информацию о проекте
   */
  async getProject(projectId: string): Promise<VercelProjectResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v9/projects/${projectId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get Vercel project: ${response.status} ${errorText}`)
      }

      return (await response.json()) as VercelProjectResponse
    } catch (error) {
      console.error("❌ Error getting Vercel project:", error)
      throw error
    }
  }

  /**
   * Удалить проект из Vercel
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v9/projects/${projectId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to delete Vercel project: ${response.status} ${errorText}`)
      }

      console.log(`✅ Deleted Vercel project: ${projectId}`)
    } catch (error) {
      console.error("❌ Error deleting Vercel project:", error)
      throw error
    }
  }

  /**
   * Получить последний деплойment для проекта
   */
  async getLatestDeployment(projectId: string): Promise<VercelDeploymentResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v6/deployments?projectId=${projectId}&limit=1`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get latest deployment: ${response.status} ${errorText}`)
      }

      const data = (await response.json()) as { deployments: VercelDeploymentResponse[] }
      const deployments = data.deployments

      if (!deployments || deployments.length === 0) {
        throw new Error(`No deployments found for project ${projectId}`)
      }

      return deployments[0]
    } catch (error) {
      console.error("❌ Error getting latest deployment:", error)
      throw error
    }
  }

  /**
   * Получить статус конкретного деплойment
   */
  async getDeploymentStatus(deploymentId: string): Promise<VercelDeploymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get deployment status: ${response.status} ${errorText}`)
      }

      return (await response.json()) as VercelDeploymentResponse
    } catch (error) {
      console.error("❌ Error getting deployment status:", error)
      throw error
    }
  }

  /**
   * Проверить и обновить статус деплоя в базе данных
   */
  async checkAndUpdateDeployStatus(projectId: string): Promise<void> {
    try {
      // Получаем текущий проект
      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)
      const project = await projectQueries.getProjectById(projectId)

      if (!project || !project.vercel_project_id) {
        console.log(
          `⚠️ Cannot check status: project ${projectId} not found or missing vercel_project_id`,
        )
        return
      }

      // Получаем последний деплойment для проекта
      const deployInfo = await this.getLatestDeployment(project.vercel_project_id)

      console.log(`📊 Vercel deployment status for ${projectId}: ${deployInfo.state}`)

      // Проверяем, изменился ли статус
      const currentStatus = project.vercel_deploy_status
      let newStatus: "building" | "ready" | "failed" | undefined

      switch (deployInfo.state) {
        case "READY":
          newStatus = "ready"
          break
        case "ERROR":
        case "CANCELED":
          newStatus = "failed"
          break
        case "BUILDING":
          newStatus = "building"
          break
      }

      if (newStatus && newStatus !== currentStatus) {
        const updateData: any = {
          vercel_deploy_status: newStatus,
        }

        // Получаем правильный URL сайта при успешном деплое
        if (newStatus === "ready") {
          try {
            const projectInfo = await this.getProject(project.vercel_project_id)
            const finalUrl = projectInfo.targets?.production?.url || deployInfo.url
            updateData.vercel_url = finalUrl.startsWith("http") ? finalUrl : `https://${finalUrl}`
            console.log(`🌐 Final site URL: ${updateData.vercel_url}`)
          } catch (siteError) {
            console.error(`⚠️ Could not get project info for URL: ${siteError}`)
            // Fallback to deployment URL
            updateData.vercel_url = deployInfo.url.startsWith("http")
              ? deployInfo.url
              : `https://${deployInfo.url}`
          }
        }

        await projectQueries.updateProject(projectId, updateData)

        // Логируем изменение статуса деплоя
        console.log(
          `🚀 Deploy status changed for project ${projectId}: ${currentStatus || "building"} -> ${newStatus}`,
        )

        // Отправляем уведомление через WebSocket
        if (this.io) {
          this.io.to(`project_${projectId}`).emit("deploy_status_update", {
            projectId,
            status: newStatus,
            url: updateData.vercel_url,
            service: "vercel",
            timestamp: new Date().toISOString(),
          })

          console.log(
            `📡 Emitted deploy status update: ${newStatus} - ${updateData.vercel_url || "no URL"}`,
          )
        }
      }

      // Если статус все еще building, запланируем еще одну проверку
      if (deployInfo.state === "BUILDING") {
        setTimeout(() => {
          this.checkAndUpdateDeployStatus(projectId).catch((err) => {
            console.error(`❌ Error checking deploy status: ${err.message}`)
          })
        }, 10000) // Проверяем каждые 10 секунд
      }
    } catch (error) {
      console.error(`❌ Error checking deploy status:`, error)
      // Продолжим пытаться, пока не получим ответ
      setTimeout(() => {
        this.checkAndUpdateDeployStatus(projectId).catch(() => {
          // Игнорируем ошибки внутри обработчика таймаута
        })
      }, 15000) // Увеличенный интервал при ошибке
    }
  }

  /**
   * Синхронизировать переменные окружения с Vercel проектом
   */
  async syncEnvFile(
    projectId: string,
    envVars: Record<string, string>,
    options: {
      target?: ("production" | "preview" | "development")[]
      type?: "encrypted" | "plain"
    } = {},
  ): Promise<void> {
    try {
      const { target = ["production", "preview", "development"], type = "encrypted" } = options

      console.log(
        `🔧 Syncing ${Object.keys(envVars).length} environment variables to Vercel project ${projectId}`,
      )

      // Подготавливаем переменные для отправки
      const envArray: VercelEnvVar[] = Object.entries(envVars).map(([key, value]) => ({
        key,
        value,
        type,
        target,
      }))

      // Отправляем переменные пакетами (Vercel API может иметь ограничения)
      const batchSize = 10
      for (let i = 0; i < envArray.length; i += batchSize) {
        const batch = envArray.slice(i, i + batchSize)

        for (const envVar of batch) {
          await this.upsertEnvironmentVariable(projectId, envVar)
        }

        // Небольшая задержка между пакетами
        if (i + batchSize < envArray.length) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      console.log(`✅ Successfully synced ${envArray.length} environment variables to Vercel`)
    } catch (error) {
      console.error("❌ Error syncing environment variables to Vercel:", error)
      throw error
    }
  }

  /**
   * Создать или обновить переменную окружения
   */
  private async upsertEnvironmentVariable(projectId: string, envVar: VercelEnvVar): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v9/projects/${projectId}/env`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(envVar),
      })

      if (!response.ok) {
        const errorText = await response.text()

        // Если переменная уже существует, пробуем обновить
        if (response.status === 409 || errorText.includes("already exists")) {
          console.log(`🔄 Environment variable ${envVar.key} already exists, updating...`)
          await this.updateEnvironmentVariable(projectId, envVar)
        } else {
          throw new Error(`Failed to create env var ${envVar.key}: ${response.status} ${errorText}`)
        }
      } else {
        console.log(`✅ Created environment variable: ${envVar.key}`)
      }
    } catch (error) {
      console.error(`❌ Error upserting environment variable ${envVar.key}:`, error)
      throw error
    }
  }

  /**
   * Обновить существующую переменную окружения
   */
  private async updateEnvironmentVariable(projectId: string, envVar: VercelEnvVar): Promise<void> {
    try {
      // Сначала получаем ID существующей переменной
      const existingVars = await this.getEnvironmentVariables(projectId)
      const existingVar = existingVars.find((v) => v.key === envVar.key)

      if (!existingVar) {
        throw new Error(`Environment variable ${envVar.key} not found for update`)
      }

      // Удаляем старую переменную
      await this.deleteEnvironmentVariable(projectId, existingVar.key)

      // Создаем новую с обновленным значением
      await this.upsertEnvironmentVariable(projectId, envVar)

      console.log(`✅ Updated environment variable: ${envVar.key}`)
    } catch (error) {
      console.error(`❌ Error updating environment variable ${envVar.key}:`, error)
      throw error
    }
  }

  /**
   * Получить все переменные окружения проекта
   */
  async getEnvironmentVariables(projectId: string): Promise<VercelEnvVar[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v9/projects/${projectId}/env`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get environment variables: ${response.status} ${errorText}`)
      }

      const data = (await response.json()) as { envs: VercelEnvVar[] }
      return data.envs || []
    } catch (error) {
      console.error("❌ Error getting environment variables:", error)
      throw error
    }
  }

  /**
   * Удалить переменную окружения
   */
  private async deleteEnvironmentVariable(projectId: string, key: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v9/projects/${projectId}/env/${key}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to delete env var ${key}: ${response.status} ${errorText}`)
      }

      console.log(`✅ Deleted environment variable: ${key}`)
    } catch (error) {
      console.error(`❌ Error deleting environment variable ${key}:`, error)
      throw error
    }
  }

  /**
   * Парсинг содержимого .env файла
   */
  private parseEnvContent(content: string): Record<string, string> {
    const envVars: Record<string, string> = {}
    const lines = content.split("\n")

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Пропускаем комментарии и пустые строки
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue
      }

      // Ищем паттерн KEY=VALUE
      const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (match) {
        const [, key, value] = match
        // Убираем кавычки если есть
        const cleanValue = value.replace(/^["']|["']$/g, "")
        envVars[key] = cleanValue
      }
    }

    return envVars
  }
}
