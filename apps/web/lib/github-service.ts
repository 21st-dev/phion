import jwt from "jsonwebtoken"
import fetch from "node-fetch"
import type { Response as NodeFetchResponse } from "node-fetch"

// Интерфейсы для GitHub API
interface GitHubInstallationToken {
  token: string
  expires_at: string
  permissions: Record<string, string>
}

interface GitHubRepository {
  id: number
  name: string
  full_name: string
  private: boolean
  html_url: string
  clone_url: string
  ssh_url: string
  default_branch: string
  created_at: string
  owner: {
    login: string
    id: number
    type: string
  }
}

interface GitHubFileContent {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string
  type: string
  content: string
  encoding: string
}

interface GitHubCommit {
  sha: string
  node_id: string
  url: string
  html_url: string
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    }
    committer: {
      name: string
      email: string
      date: string
    }
  }
}

interface CreateFileRequest {
  message: string
  content: string // Base64 encoded
  branch?: string
  committer?: {
    name: string
    email: string
  }
  author?: {
    name: string
    email: string
  }
}

interface UpdateFileRequest extends CreateFileRequest {
  sha: string // Required for updates
}

interface CreateRepositoryRequest {
  name: string
  description?: string
  private: boolean
  auto_init?: boolean
  gitignore_template?: string
  license_template?: string
}

export class GitHubAppService {
  private readonly appId: string
  private readonly installationId: string
  private readonly privateKey: string
  private readonly baseUrl = "https://api.github.com"
  private readonly organization = "phion-dev"

  // Кэш для installation токенов
  private tokenCache: {
    token: string
    expiresAt: Date
  } | null = null

  constructor() {
    this.appId = process.env.GITHUB_APP_ID!
    this.installationId = process.env.GITHUB_APP_INSTALLATION_ID!
    this.privateKey = process.env.GITHUB_APP_PRIVATE_KEY!

    if (!this.appId || !this.installationId || !this.privateKey) {
      throw new Error("GitHub App configuration is missing. Please check environment variables.")
    }

    console.log("✅ GitHubAppService initialized", {
      appId: this.appId,
      installationId: this.installationId,
      organization: this.organization,
    })
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async withRetry<T>(
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
          console.log(`✅ ${context} succeeded on attempt ${attempt}`)
        }
        return result
      } catch (error) {
        lastError = error as Error

        if (attempt === maxAttempts) {
          console.error(`❌ ${context} failed after ${maxAttempts} attempts:`, lastError.message)
          break
        }

        // Check if error is retryable
        if (!this.shouldRetryError(error)) {
          console.error(`❌ ${context} failed with non-retryable error:`, lastError.message)
          break
        }

        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
        console.log(
          `⚠️ ${context} attempt ${attempt} failed, retrying in ${Math.round(delay)}ms:`,
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
  private shouldRetryError(error: any): boolean {
    if (error?.status) {
      // Retry on temporary server errors
      if (error.status >= 500) return true
      // Retry on rate limiting
      if (error.status === 429) return true
      // Don't retry on client errors (400-499, except 429)
      if (error.status >= 400 && error.status < 500) return false
    }

    // Retry on network errors
    if (
      error?.code === "ENOTFOUND" ||
      error?.code === "ECONNRESET" ||
      error?.code === "ETIMEDOUT" ||
      error?.message?.includes("fetch failed") ||
      error?.message?.includes("network")
    ) {
      return true
    }

    return false
  }

  /**
   * Генерирует JWT токен для GitHub App
   */
  private generateJWT(): string {
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iat: now - 60, // Issued 60 seconds ago
      exp: now + 600, // Expires in 10 minutes
      iss: this.appId, // Issuer: GitHub App ID
    }

    return jwt.sign(payload, this.privateKey, { algorithm: "RS256" })
  }

  /**
   * Получает installation token для GitHub App
   * Токен кэшируется и автоматически обновляется при истечении
   */
  async getInstallationToken(): Promise<string> {
    // Проверяем кэш (оставляем больше буфера - 10 минут до истечения)
    if (this.tokenCache && this.tokenCache.expiresAt > new Date(Date.now() + 10 * 60 * 1000)) {
      console.log("🔄 Using cached installation token")
      return this.tokenCache.token
    }

    return this.withRetry(
      async () => {
        console.log("🔑 Generating new installation token...")
        const jwtToken = this.generateJWT()

        const response = await fetch(
          `${this.baseUrl}/app/installations/${this.installationId}/access_tokens`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${jwtToken}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "Phion-Bot/1.0",
            },
            // Add timeout for token generation
            signal: AbortSignal.timeout(15000), // 15 second timeout
          },
        )

        if (!response.ok) {
          const error = await response.text()
          const errorObj = new Error(
            `Failed to get installation token: ${response.status} ${error}`,
          ) as any
          errorObj.status = response.status
          throw errorObj
        }

        const data = (await response.json()) as GitHubInstallationToken

        // Кэшируем токен (он действует 60 минут, кэшируем на 50 минут для безопасности)
        this.tokenCache = {
          token: data.token,
          expiresAt: new Date(Date.now() + 50 * 60 * 1000),
        }

        console.log("✅ Generated new installation token", {
          expiresAt: data.expires_at,
          permissions: Object.keys(data.permissions || {}).length,
        })

        return data.token
      },
      "getInstallationToken",
      5, // Increased attempts for critical token generation
      3000, // Longer initial delay
    )
  }

  /**
   * Выполняет авторизованный запрос к GitHub API
   */
  private async makeAuthenticatedRequest(
    endpoint: string,
    options: any = {},
  ): Promise<NodeFetchResponse> {
    const token = await this.getInstallationToken()

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Phion-Bot/1.0",
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    return response
  }

  /**
   * Создает новый приватный репозиторий в организации phion-dev
   */
  async createRepository(projectId: string, description?: string): Promise<GitHubRepository> {
    const repoName = `phion-project-${projectId}`

    return this.withRetry(
      async () => {
        // Проверяем существование репозитория перед созданием
        const existingRepo = await this.checkRepositoryExists(repoName)
        if (existingRepo) {
          console.log(`⚠️ Repository ${repoName} already exists. Checking if it's orphaned...`)

          // Попытаемся удалить существующий репозиторий
          try {
            await this.deleteRepository(repoName)
            console.log(`🧹 Deleted orphaned repository: ${repoName}`)

            // Небольшая задержка после удаления
            await new Promise((resolve) => setTimeout(resolve, 1000))
          } catch (deleteError) {
            console.error(`❌ Failed to delete existing repository ${repoName}:`, deleteError)
            throw new Error(
              `Repository ${repoName} already exists and could not be deleted. Please delete it manually on GitHub or contact support.`,
            )
          }
        }

        const requestBody: CreateRepositoryRequest = {
          name: repoName,
          description: description || `Phion project ${projectId}`,
          private: true,
          auto_init: true, // Создаем с initial commit чтобы Git Tree API работал
        }

        const response = await this.makeAuthenticatedRequest(`/orgs/${this.organization}/repos`, {
          method: "POST",
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const error = await response.text()
          const errorObj = new Error(
            `Failed to create repository: ${response.status} ${error}`,
          ) as any
          errorObj.status = response.status
          throw errorObj
        }

        const repository = (await response.json()) as GitHubRepository

        console.log("🎉 Created GitHub repository", {
          projectId,
          repoName: repository.name,
          repoUrl: repository.html_url,
          isPrivate: repository.private,
        })

        return repository
      },
      `createRepository(${projectId})`,
      5, // Increased max attempts for critical operation
      2000, // Longer initial delay
    )
  }

  /**
   * Проверяет существование репозитория
   */
  async checkRepositoryExists(repoName: string): Promise<GitHubRepository | null> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}`,
      )

      if (response.ok) {
        const repository = (await response.json()) as GitHubRepository
        console.log("🔍 Repository exists", {
          repoName: repository.name,
          repoUrl: repository.html_url,
          isPrivate: repository.private,
        })
        return repository
      }

      if (response.status === 404) {
        console.log("🔍 Repository does not exist", { repoName })
        return null
      }

      // Для других ошибок выбрасываем исключение
      const error = await response.text()
      throw new Error(`Failed to check repository existence: ${response.status} ${error}`)
    } catch (error) {
      console.error("❌ Failed to check repository existence", {
        repoName,
        error,
      })
      throw error
    }
  }

  /**
   * Получает список всех репозиториев организации
   */
  async listOrganizationRepositories(page = 1, perPage = 100): Promise<GitHubRepository[]> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/orgs/${this.organization}/repos?type=all&page=${page}&per_page=${perPage}&sort=created&direction=desc`,
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to list organization repositories: ${response.status} ${error}`)
      }

      const repositories = (await response.json()) as GitHubRepository[]

      console.log("📋 Retrieved organization repositories", {
        organization: this.organization,
        count: repositories.length,
        page,
        perPage,
      })

      return repositories
    } catch (error) {
      console.error("❌ Failed to list organization repositories", { error })
      throw error
    }
  }

  /**
   * Находит "осиротевшие" репозитории (существуют в GitHub, но нет в БД)
   */
  async findOrphanedRepositories(): Promise<GitHubRepository[]> {
    try {
      console.log("🔍 Searching for orphaned repositories...")

      // Получаем все репозитории phion-project-* из GitHub
      const allRepos = await this.listOrganizationRepositories()
      const phionRepos = allRepos.filter(
        (repo) => repo.name.startsWith("phion-project-") && repo.owner?.login === this.organization,
      )

      console.log(`🔍 Found ${phionRepos.length} phion repositories in GitHub`)

      // TODO: Здесь нужно будет добавить проверку с базой данных
      // Для начала возвращаем все найденные репозитории для ручной проверки
      return phionRepos
    } catch (error) {
      console.error("❌ Failed to find orphaned repositories", { error })
      throw error
    }
  }

  /**
   * Создает или обновляет файл в репозитории
   */
  async createOrUpdateFile(
    repoName: string,
    filePath: string,
    content: string,
    message: string,
    sha?: string,
  ): Promise<{ sha: string; commit: GitHubCommit }> {
    try {
      const base64Content = Buffer.from(content, "utf8").toString("base64")

      const requestBody: CreateFileRequest | UpdateFileRequest = {
        message,
        content: base64Content,
        branch: "main",
        committer: {
          name: "Phion Bot",
          email: "bot@phion.com",
        },
        author: {
          name: "Phion Bot",
          email: "bot@phion.com",
        },
        ...(sha ? { sha } : {}),
      }

      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/contents/${filePath}`,
        {
          method: "PUT",
          body: JSON.stringify(requestBody),
        },
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to create/update file: ${response.status} ${error}`)
      }

      const result = (await response.json()) as any

      console.log("📝 Created/updated file in GitHub", {
        repoName,
        filePath,
        sha: result.content.sha,
        commitSha: result.commit.sha,
      })

      return {
        sha: result.content.sha,
        commit: result.commit,
      }
    } catch (error) {
      console.error("❌ Failed to create/update file in GitHub", {
        repoName,
        filePath,
        error,
      })
      throw error
    }
  }

  /**
   * Скачивает ZIP архив репозитория
   */
  async downloadRepositoryZip(repoName: string, ref = "main"): Promise<Buffer> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/zipball/${ref}`,
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to download repository ZIP: ${response.status} ${error}`)
      }

      const buffer = await response.buffer()

      console.log("🔄 Downloaded repository ZIP", {
        repoName,
        ref,
        sizeBytes: buffer.length,
      })

      return buffer
    } catch (error) {
      console.error("❌ Failed to download repository ZIP", {
        repoName,
        ref,
        error,
      })
      throw error
    }
  }

  /**
   * Удаляет репозиторий из организации
   * ВНИМАНИЕ: Это необратимая операция!
   */
  async deleteRepository(repoName: string): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}`,
        {
          method: "DELETE",
        },
      )

      if (!response.ok) {
        const error = await response.text()

        // Если репозиторий уже не существует, считаем это успехом
        if (response.status === 404) {
          console.log("⚠️ Repository already deleted or not found", {
            repoName,
          })
          return
        }

        throw new Error(`Failed to delete repository: ${response.status} ${error}`)
      }

      console.log("🗑️ Deleted GitHub repository", {
        repoName,
        fullName: `${this.organization}/${repoName}`,
      })
    } catch (error) {
      console.error("❌ Failed to delete GitHub repository", {
        repoName,
        error,
      })
      throw error
    }
  }

  /**
   * Получает содержимое файла из репозитория
   */
  async getFileContent(
    repoName: string,
    filePath: string,
    ref = "main",
  ): Promise<GitHubFileContent> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/contents/${filePath}?ref=${ref}`,
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to get file content: ${response.status} ${error}`)
      }

      const fileContent = (await response.json()) as GitHubFileContent

      console.log("📖 Retrieved file content from GitHub", {
        repoName,
        filePath,
        ref,
        encoding: fileContent.encoding,
        size: fileContent.size,
      })

      return fileContent
    } catch (error) {
      console.error("❌ Failed to get file content from GitHub", {
        repoName,
        filePath,
        ref,
        error,
      })
      throw error
    }
  }

  /**
   * Удаляет файл из репозитория
   */
  async deleteFile(
    repoName: string,
    filePath: string,
    message: string,
    sha: string,
  ): Promise<{ commit: GitHubCommit }> {
    try {
      const requestBody = {
        message,
        sha,
        branch: "main",
        committer: {
          name: "Phion Bot",
          email: "bot@phion.com",
        },
        author: {
          name: "Phion Bot",
          email: "bot@phion.com",
        },
      }

      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/contents/${filePath}`,
        {
          method: "DELETE",
          body: JSON.stringify(requestBody),
        },
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to delete file: ${response.status} ${error}`)
      }

      const result = (await response.json()) as any

      console.log("🗑️ Deleted file from GitHub", {
        repoName,
        filePath,
        commitSha: result.commit.sha,
      })

      return {
        commit: result.commit,
      }
    } catch (error) {
      console.error("❌ Failed to delete file from GitHub", {
        repoName,
        filePath,
        error,
      })
      throw error
    }
  }

  /**
   * Получает историю коммитов репозитория
   */
  async getCommits(repoName: string, ref = "main", perPage = 50): Promise<GitHubCommit[]> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/commits?sha=${ref}&per_page=${perPage}`,
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to get commits: ${response.status} ${error}`)
      }

      const commits = (await response.json()) as GitHubCommit[]

      console.log("📋 Retrieved commits from GitHub", {
        repoName,
        ref,
        count: commits.length,
      })

      return commits
    } catch (error) {
      console.error("❌ Failed to get commits from GitHub", {
        repoName,
        ref,
        error,
      })
      throw error
    }
  }

  /**
   * Создает временный токен доступа для git операций
   * Используется для git pull в локальном агенте
   */
  async createTemporaryToken(): Promise<{ token: string; expiresAt: string }> {
    try {
      const installationToken = await this.getInstallationToken()

      // Installation token сам по себе временный (60 минут)
      // Возвращаем его как временный токен для git операций
      const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString()

      console.log("🔑 Created temporary git token", { expiresAt })

      return {
        token: installationToken,
        expiresAt,
      }
    } catch (error) {
      console.error("❌ Failed to create temporary git token", error)
      throw error
    }
  }

  /**
   * Проверяет статус и доступность GitHub App
   */
  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy"
    appId: string
    installationId: string
    organization: string
    tokenValid: boolean
    error?: string
  }> {
    try {
      const token = await this.getInstallationToken()

      // Проверяем доступ к организации
      const response = await this.makeAuthenticatedRequest(`/orgs/${this.organization}`)

      const result = {
        status: response.ok ? ("healthy" as const) : ("unhealthy" as const),
        appId: this.appId,
        installationId: this.installationId,
        organization: this.organization,
        tokenValid: !!token,
        ...(response.ok ? {} : { error: `Org access failed: ${response.status}` }),
      }

      console.log("🏥 GitHub App health check", result)
      return result
    } catch (error) {
      const result = {
        status: "unhealthy" as const,
        appId: this.appId,
        installationId: this.installationId,
        organization: this.organization,
        tokenValid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }

      console.error("❌ GitHub App health check failed", result)
      return result
    }
  }

  /**
   * Создает множественные файлы одним коммитом через Git Tree API
   * Избегает конфликтов при параллельной загрузке файлов
   */
  async createMultipleFiles(
    repoName: string,
    files: Record<string, string>,
    message: string,
  ): Promise<{ commitSha: string; treeSha: string }> {
    try {
      console.log(`🌳 Creating ${Object.keys(files).length} files in one commit via Git Tree API`)

      // 1. Получаем последний commit SHA для parent
      const refsResponse = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/git/refs/heads/main`,
      )

      if (!refsResponse.ok) {
        const error = await refsResponse.text()
        throw new Error(`Failed to get main branch ref: ${refsResponse.status} ${error}`)
      }

      const mainRef = (await refsResponse.json()) as {
        object: { sha: string }
      }
      const parentCommitSha = mainRef.object.sha
      console.log(`📍 Parent commit SHA: ${parentCommitSha}`)

      // 2. Создаем blobs для всех файлов с ограниченным concurrency
      const fileEntries = Object.entries(files)
      const CHUNK_SIZE = 5 // Обрабатываем по 5 файлов за раз
      const treeItems: Array<{
        path: string
        mode: string
        type: "blob"
        sha: string
      }> = []

      // Разбиваем на чанки для избежания перегрузки API
      for (let i = 0; i < fileEntries.length; i += CHUNK_SIZE) {
        const chunk = fileEntries.slice(i, i + CHUNK_SIZE)
        console.log(
          `📦 Processing blob chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(
            fileEntries.length / CHUNK_SIZE,
          )} (${chunk.length} files)`,
        )

        const blobPromises = chunk.map(async ([filePath, content]) => {
          const base64Content = Buffer.from(content, "utf8").toString("base64")

          const response = await this.makeAuthenticatedRequest(
            `/repos/${this.organization}/${repoName}/git/blobs`,
            {
              method: "POST",
              body: JSON.stringify({
                content: base64Content,
                encoding: "base64",
              }),
            },
          )

          if (!response.ok) {
            const error = await response.text()
            throw new Error(`Failed to create blob for ${filePath}: ${response.status} ${error}`)
          }

          const blob = (await response.json()) as { sha: string }
          return {
            path: filePath,
            mode: "100644", // Regular file
            type: "blob" as const,
            sha: blob.sha,
          }
        })

        const chunkResults = await Promise.all(blobPromises)
        treeItems.push(...chunkResults)

        // Небольшая задержка между чанками для снижения нагрузки
        if (i + CHUNK_SIZE < fileEntries.length) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
      console.log(`✅ Created ${treeItems.length} blobs`)

      // 3. Создаем tree со всеми файлами
      const treeResponse = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/git/trees`,
        {
          method: "POST",
          body: JSON.stringify({
            tree: treeItems,
          }),
        },
      )

      if (!treeResponse.ok) {
        const error = await treeResponse.text()
        throw new Error(`Failed to create tree: ${treeResponse.status} ${error}`)
      }

      const tree = (await treeResponse.json()) as { sha: string }
      console.log(`🌳 Created tree with SHA: ${tree.sha}`)

      // 4. Создаем commit с этим tree и parent commit
      const commitResponse = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/git/commits`,
        {
          method: "POST",
          body: JSON.stringify({
            message,
            tree: tree.sha,
            parents: [parentCommitSha], // Указываем parent commit
            author: {
              name: "Phion Bot",
              email: "bot@phion.com",
            },
            committer: {
              name: "Phion Bot",
              email: "bot@phion.com",
            },
          }),
        },
      )

      if (!commitResponse.ok) {
        const error = await commitResponse.text()
        throw new Error(`Failed to create commit: ${commitResponse.status} ${error}`)
      }

      const commit = (await commitResponse.json()) as { sha: string }
      console.log(`📝 Created commit with SHA: ${commit.sha}`)

      // 5. Обновляем main branch reference
      const refResponse = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/git/refs/heads/main`,
        {
          method: "PATCH",
          body: JSON.stringify({
            sha: commit.sha,
          }),
        },
      )

      if (!refResponse.ok) {
        const error = await refResponse.text()
        throw new Error(`Failed to update main branch: ${refResponse.status} ${error}`)
      }

      console.log(`🎉 Successfully created ${Object.keys(files).length} files in one commit`)

      return {
        commitSha: commit.sha,
        treeSha: tree.sha,
      }
    } catch (error) {
      console.error("❌ Failed to create multiple files via Git Tree API", {
        repoName,
        error,
      })
      throw error
    }
  }
}

// Экспортируем singleton instance
export const githubAppService = new GitHubAppService()
