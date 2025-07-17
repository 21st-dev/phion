import jwt from "jsonwebtoken"
import fetch from "node-fetch"
import type { Response as NodeFetchResponse } from "node-fetch"

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

  private tokenCache: {
    token: string
    expiresAt: Date
  } | null = null

  constructor() {
    this.appId = process.env.GITHUB_APP_ID || ""
    this.installationId = process.env.GITHUB_APP_INSTALLATION_ID || ""
    this.privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n") || ""

    if (!this.appId || !this.installationId || !this.privateKey) {
      throw new Error(
        "Missing GitHub App configuration. Please set GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, and GITHUB_APP_PRIVATE_KEY environment variables.",
      )
    }

    console.log("✅ GitHubAppService initialized", {
      appId: this.appId,
      installationId: this.installationId,
      organization: this.organization,
    })
  }

  /**
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
        return await operation()
      } catch (error) {
        lastError = error as Error

        const shouldRetry = this.shouldRetryError(error)

        if (attempt === maxAttempts || !shouldRetry) {
          console.error(`❌ [RETRY] Final failure for ${context} after ${attempt} attempts:`, error)
          throw error
        }

        const delay = baseDelay * Math.pow(2, attempt - 1)
        console.warn(
          `⚠️ [RETRY] Attempt ${attempt}/${maxAttempts} failed for ${context}, retrying in ${delay}ms:`,
          error instanceof Error ? error.message : error,
        )

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  }

  /**
   */
  private shouldRetryError(error: any): boolean {
    if (!error) return false

    if (
      error.code === "ECONNRESET" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNREFUSED"
    ) {
      return true
    }

    // HTTP statuses, worth retrying
    if (error.status >= 500 || error.status === 429) {
      return true
    }

    return false
  }

  /**
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
   */
  async getInstallationToken(): Promise<string> {
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
   */
  async createRepository(projectId: string, description?: string): Promise<GitHubRepository> {
    const repoName = `phion-project-${projectId}`

    return this.withRetry(
      async () => {
        const existingRepo = await this.checkRepositoryExists(repoName)
        if (existingRepo) {
          console.log(`⚠️ Repository ${repoName} already exists. Checking if it's orphaned...`)

          try {
            await this.deleteRepository(repoName)
            console.log(`🧹 Deleted orphaned repository: ${repoName}`)

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
          auto_init: true, // GitHub automatically will create README and initial commit
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
   */
  async createOrUpdateFile(
    repoName: string,
    filePath: string,
    content: string,
    message: string,
    sha?: string,
  ): Promise<{ sha: string; commit: GitHubCommit }> {
    try {
      let fileSha = sha

      if (!fileSha) {
        try {
          const existingFile = await this.getFileContent(repoName, filePath)
          fileSha = existingFile.sha
          console.log("🔍 Found existing file, using SHA for update:", fileSha)
        } catch (error) {
          console.log("📄 File does not exist, creating new file")
        }
      }

      const base64Content = Buffer.from(content, "utf8").toString("base64")

      const requestBody: CreateFileRequest | UpdateFileRequest = {
        message,
        content: base64Content,
        branch: "main",
        committer: {
          name: "Phion Bot",
          email: "bot@phion.dev",
        },
        author: {
          name: "Phion Bot",
          email: "bot@phion.dev",
        },
        ...(fileSha ? { sha: fileSha } : {}),
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
        action: fileSha ? "updated" : "created",
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
        if (response.status === 404) {
          throw new Error(`File not found: ${filePath}`)
        }
        const error = await response.text()
        throw new Error(`Failed to get file content: ${response.status} ${error}`)
      }

      const fileContent = (await response.json()) as GitHubFileContent

      if (fileContent.encoding === "base64") {
        fileContent.content = Buffer.from(fileContent.content, "base64").toString("utf8")
      }

      return fileContent
    } catch (error) {
      console.error("❌ Failed to get file content from GitHub", {
        repoName,
        filePath,
        error,
      })
      throw error
    }
  }

  /**
   */
  async deleteFile(
    repoName: string,
    filePath: string,
    message: string,
    sha: string,
  ): Promise<GitHubCommit> {
    try {
      const requestBody = {
        message,
        sha,
        branch: "main",
        committer: {
          name: "Phion Bot",
          email: "bot@phion.dev",
        },
        author: {
          name: "Phion Bot",
          email: "bot@phion.dev",
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

      return result.commit
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
   */
  async getCommits(repoName: string, branch = "main", limit = 30): Promise<GitHubCommit[]> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/commits?sha=${branch}&per_page=${limit}`,
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to get commits: ${response.status} ${error}`)
      }

      const commits = (await response.json()) as GitHubCommit[]

      console.log("📊 Retrieved commits from GitHub", {
        repoName,
        branch,
        commitsCount: commits.length,
      })

      return commits
    } catch (error) {
      console.error("❌ Failed to get commits from GitHub", {
        repoName,
        branch,
        error,
      })
      throw error
    }
  }

  /**
   */
  async createTemporaryToken(): Promise<string> {
    return this.getInstallationToken()
  }

  /**
   */
  async createBlob(repoName: string, content: string): Promise<{ sha: string }> {
    return this.withRetry(
      async () => {
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
          const errorObj = new Error(`Failed to create blob: ${response.status} ${error}`) as any
          errorObj.status = response.status
          throw errorObj
        }

        const blob = (await response.json()) as { sha: string }
        return blob
      },
      `createBlob(${repoName})`,
      3,
      1000,
    )
  }

  /**
   */
  async createTree(
    repoName: string,
    blobs: { path: string; sha: string }[],
    baseTree?: string,
  ): Promise<{ sha: string }> {
    return this.withRetry(
      async () => {
        const tree = blobs.map((blob) => ({
          path: blob.path,
          mode: "100644", // Regular file
          type: "blob",
          sha: blob.sha,
        }))

        const requestBody: any = { tree }
        if (baseTree) {
          requestBody.base_tree = baseTree
        }

        const response = await this.makeAuthenticatedRequest(
          `/repos/${this.organization}/${repoName}/git/trees`,
          {
            method: "POST",
            body: JSON.stringify(requestBody),
          },
        )

        if (!response.ok) {
          const error = await response.text()
          const errorObj = new Error(`Failed to create tree: ${response.status} ${error}`) as any
          errorObj.status = response.status
          throw errorObj
        }

        const treeResult = (await response.json()) as { sha: string }
        return treeResult
      },
      `createTree(${repoName})`,
      3,
      1000,
    )
  }

  /**
   */
  async createCommit(
    repoName: string,
    message: string,
    treeSha: string,
    parents: string[] = [],
  ): Promise<{ sha: string }> {
    return this.withRetry(
      async () => {
        const response = await this.makeAuthenticatedRequest(
          `/repos/${this.organization}/${repoName}/git/commits`,
          {
            method: "POST",
            body: JSON.stringify({
              message,
              tree: treeSha,
              parents,
              author: {
                name: "Phion Bot",
                email: "bot@phion.dev",
              },
              committer: {
                name: "Phion Bot",
                email: "bot@phion.dev",
              },
            }),
          },
        )

        if (!response.ok) {
          const error = await response.text()
          const errorObj = new Error(`Failed to create commit: ${response.status} ${error}`) as any
          errorObj.status = response.status
          throw errorObj
        }

        const commit = (await response.json()) as { sha: string }
        return commit
      },
      `createCommit(${repoName})`,
      3,
      1000,
    )
  }

  /**
   */
  async updateRef(repoName: string, ref: string, sha: string): Promise<void> {
    return this.withRetry(
      async () => {
        const response = await this.makeAuthenticatedRequest(
          `/repos/${this.organization}/${repoName}/git/refs/${ref}`,
          {
            method: "PATCH",
            body: JSON.stringify({ sha }),
          },
        )

        if (!response.ok) {
          const error = await response.text()
          const errorObj = new Error(`Failed to update ref: ${response.status} ${error}`) as any
          errorObj.status = response.status
          throw errorObj
        }
      },
      `updateRef(${repoName}, ${ref})`,
      3,
      1000,
    )
  }

  /**
   */
  async createRef(repoName: string, ref: string, sha: string): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/git/refs`,
        {
          method: "POST",
          body: JSON.stringify({
            ref: ref.startsWith("refs/") ? ref : `refs/${ref}`,
            sha,
          }),
        },
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to create ref: ${response.status} ${error}`)
      }
    } catch (error) {
      console.error("❌ Failed to create ref", { repoName, ref, error })
      throw error
    }
  }

  /**
   */
  async getLatestCommit(repoName: string, ref = "main"): Promise<{ sha: string } | null> {
    console.log(`🔍 [getLatestCommit] Checking for latest commit in ${repoName}/${ref}`)

    try {
      const endpoint = `/repos/${this.organization}/${repoName}/git/refs/heads/${ref}`
      console.log(`🔍 [getLatestCommit] Making request to: ${endpoint}`)

      const response = await this.makeAuthenticatedRequest(endpoint)

      console.log(`🔍 [getLatestCommit] Response status: ${response.status}`)

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`✅ [getLatestCommit] Repository ${repoName} is empty (404), returning null`)
          return null
        }
        if (response.status === 409) {
          console.log(`✅ [getLatestCommit] Repository ${repoName} is empty (409), returning null`)
          return null
        }
        const error = await response.text()
        console.log(`❌ [getLatestCommit] Error response: ${error}`)
        throw new Error(`Failed to get latest commit: ${response.status} ${error}`)
      }

      const refData = (await response.json()) as { object: { sha: string } }
      console.log(`✅ [getLatestCommit] Found commit: ${refData.object.sha}`)
      return { sha: refData.object.sha }
    } catch (error) {
      console.error("❌ [getLatestCommit] Exception caught:", {
        repoName,
        ref,
        error,
      })
      if (error instanceof Error && error.message.includes("409")) {
        console.log(
          `✅ [getLatestCommit] Caught 409 error, repository ${repoName} is empty, returning null`,
        )
        return null
      }
      throw error
    }
  }

  /**
   */
  async healthCheck(): Promise<{ status: "ok" | "error"; details: any }> {
    try {
      const token = await this.getInstallationToken()

      const response = await this.makeAuthenticatedRequest(`/orgs/${this.organization}`)

      if (!response.ok) {
        const error = await response.text()
        return {
          status: "error",
          details: {
            message: `Organization access failed: ${response.status} ${error}`,
          },
        }
      }

      const orgData = (await response.json()) as any

      return {
        status: "ok",
        details: {
          organization: orgData.login,
          appId: this.appId,
          installationId: this.installationId,
          tokenExpiresAt: this.tokenCache?.expiresAt,
        },
      }
    } catch (error) {
      console.error("❌ GitHub health check failed", { error })
      return {
        status: "error",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }
  }
}

export const githubAppService = new GitHubAppService()
