import { getSupabaseServerClient, ProjectQueries } from "@shipvibes/database"
import { exec } from "child_process"
import fetch from "node-fetch"
import { promisify } from "util"

const execAsync = promisify(exec)

interface NetlifyCreateSiteResponse {
  id: string
  url: string
  admin_url: string
  name: string
  ssl_url?: string
  build_settings?: {
    repo_url?: string
    repo_branch?: string
    deploy_key_id?: string
    cmd?: string
    dir?: string
  }
}

interface NetlifyCreateSiteRequest {
  name: string
  repo?: {
    provider: "github"
    repo: string
    private: boolean
    branch: string
    installation_id: number
  }
  build_settings?: {
    cmd: string
    dir: string
    env?: Record<string, string>
  }
}

interface NetlifyWebhookResponse {
  id: string
  url: string
  event: string
  created_at: string
}

interface NetlifyDeployResponse {
  id: string
  url: string
  deploy_url: string
  state: "new" | "building" | "ready" | "error" | "enqueued"
  error_message?: string
}

interface NetlifyEnvVar {
  key: string
  value: string
  scopes: string[]
  context: string
}

interface NetlifyEnvResponse {
  key: string
  value: string
  scopes: string[]
  context: string
  updated_at: string
}

export class NetlifyService {
  private accessToken: string
  private baseUrl = "https://api.netlify.com/api/v1"
  private io?: any // Socket.io instance for real-time updates

  constructor(io?: any) {
    this.accessToken = process.env.NETLIFY_ACCESS_TOKEN!
    this.io = io

    if (!this.accessToken) {
      throw new Error("NETLIFY_ACCESS_TOKEN environment variable is required")
    }
  }

  /**
   */
  async hasProjectFiles(projectId: string): Promise<boolean> {
    console.log(`📋 GitHub architecture: project ${projectId} deploys automatically from GitHub`)
  }

  /**
   */
  async createSite(projectId: string, projectName: string): Promise<NetlifyCreateSiteResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/sites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `phion-${projectId.slice(0, 8)}`,
          created_via: "phion",
          session_id: projectId,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create Netlify site: ${response.status} ${errorText}`)
      }

      const data = (await response.json()) as NetlifyCreateSiteResponse
      console.log(`✅ Created Netlify site: ${data.url}`)

      return data
    } catch (error) {
      console.error("❌ Error creating Netlify site:", error)
      throw error
    }
  }

  /**
   */
  async createSiteWithGitHub(
    projectId: string,
    projectName: string,
    githubRepoName: string,
    githubOwner: string,
  ): Promise<NetlifyCreateSiteResponse> {
    try {
      // GitHub App Installation ID for organization phion-dev
      const installationId = parseInt(process.env.NETLIFY_GITHUB_INSTALLATION_ID!)

      if (!installationId || isNaN(installationId)) {
        throw new Error("NETLIFY_GITHUB_INSTALLATION_ID is required and must be a valid number")
      }

      const requestBody: NetlifyCreateSiteRequest = {
        name: `phion-${projectId.slice(0, 8)}`,
        repo: {
          provider: "github",
          repo: `${githubOwner}/${githubRepoName}`,
          private: true,
          branch: "main",
          installation_id: installationId,
        },
        build_settings: {
          cmd: "pnpm install && pnpm build",
          dir: "dist",
          env: {
            NODE_VERSION: "18",
            NPM_VERSION: "9",
          },
        },
      }

      console.log("🌐 Creating Netlify site with GitHub integration:", {
        projectId,
        repoName: githubRepoName,
        installationId,
        buildCmd: requestBody.build_settings?.cmd,
      })

      const response = await fetch(`${this.baseUrl}/sites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ Netlify API error:", errorText)
        throw new Error(`Failed to create Netlify site: ${response.status} ${errorText}`)
      }

      const data = (await response.json()) as NetlifyCreateSiteResponse

      console.log("✅ Created Netlify site with GitHub integration:", {
        siteId: data.id,
        name: data.name,
        adminUrl: data.admin_url,
        deployKeyId: data.build_settings?.deploy_key_id,
        repoUrl: data.build_settings?.repo_url,
      })


      return data
    } catch (error) {
      console.error("❌ Error creating Netlify site with GitHub:", error)
      throw error
    }
  }

  /**
   */
  async setupWebhookForSite(siteId: string, projectId: string): Promise<void> {
    await this.setupWebhook(siteId, projectId)
  }

  private static ngrokUrl: string | null = null

  /**
   */
  private async setupWebhook(siteId: string, projectId: string): Promise<void> {
    try {
      let webhookUrl = process.env.WEBSOCKET_SERVER_URL

      if (process.env.NODE_ENV === "development" || !webhookUrl) {
        try {
          console.log("🔗 Starting ngrok tunnel for development webhooks...")

          if (!NetlifyService.ngrokUrl) {
            const ngrok = await import("@ngrok/ngrok")

            const listener = await ngrok.forward({
              addr: 8080,
              authtoken_from_env: true,
            })

            NetlifyService.ngrokUrl = listener.url()
            console.log(`✅ Ngrok tunnel started: ${NetlifyService.ngrokUrl}`)
          }

          if (NetlifyService.ngrokUrl) {
            webhookUrl = NetlifyService.ngrokUrl
            console.log(`🌐 Using ngrok URL for webhooks: ${webhookUrl}`)
          } else {
            throw new Error("Failed to get ngrok URL")
          }
        } catch (error) {
          console.error("❌ Failed to setup ngrok tunnel:", error)
          console.log("⚠️ Falling back to localhost (webhooks will not work)")
          webhookUrl = "http://localhost:8080"
        }
      }

      const webhookEndpoint = `${webhookUrl}/webhooks/netlify`

      console.log(`🔗 Setting up webhook for site ${siteId} → ${webhookEndpoint}`)

      const events = ["deploy_created", "deploy_building", "deploy_failed"]
      const webhookPromises: Promise<any>[] = []

      for (const event of events) {
        const webhookPromise = fetch(`${this.baseUrl}/hooks`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "url",
            event: event,
            data: {
              url: webhookEndpoint,
            },
            site_id: siteId,
          }),
        })

        webhookPromises.push(webhookPromise)
      }

      const responses = await Promise.all(webhookPromises)

      const results: { event: string; hookId: string }[] = []
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i]
        const event = events[i]

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ Failed to setup webhook for event ${event}:`, errorText)
          continue
        }

        const webhookData = (await response.json()) as NetlifyWebhookResponse
        results.push({
          event,
          hookId: webhookData.id,
        })
      }

      if (results.length > 0) {
        console.log(`✅ Webhooks configured for site ${siteId}:`, {
          endpoint: webhookEndpoint,
          webhooks: results,
        })
      } else {
        console.log("⚠️ No webhooks were successfully configured")
      }
    } catch (error) {
      console.error(`❌ Error setting up webhook for site ${siteId}:`, error)
      console.log("⚠️ Continuing without webhook setup")
    }
  }

  /**
   */
  async checkAndUpdateDeployStatus(projectId: string): Promise<void> {
    try {
      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)
      const project = await projectQueries.getProjectById(projectId)

      if (!project || !project.netlify_site_id) {
        console.log(
          `⚠️ Cannot check status: project ${projectId} not found or missing netlify_site_id`,
        )
        return
      }

      let deployInfo: NetlifyDeployResponse

      if (project.netlify_deploy_id) {
        deployInfo = await this.getDeployStatus(project.netlify_site_id, project.netlify_deploy_id)
      } else {
        deployInfo = await this.getLatestDeploy(project.netlify_site_id)
      }

      console.log(`📊 Netlify deploy status for ${projectId}: ${deployInfo.state}`)

      if (
        (deployInfo.state === "ready" && project.deploy_status !== "ready") ||
        (deployInfo.state === "error" && project.deploy_status !== "failed")
      ) {
        const newStatus = deployInfo.state === "ready" ? "ready" : "failed"

        const updateData: any = {
          deploy_status: newStatus,
          netlify_deploy_id: deployInfo.id,
        }

        if (newStatus === "ready") {
          try {
            const siteInfo = await this.getSite(project.netlify_site_id)
            const finalUrl = siteInfo.ssl_url || siteInfo.url
            updateData.netlify_url = finalUrl
            console.log(`🌐 Final site URL: ${finalUrl}`)
          } catch (siteError) {
            console.error(`⚠️ Could not get site info for URL: ${siteError}`)
            // Fallback to deploy URL if available
            if (deployInfo.deploy_url) {
              updateData.netlify_url = deployInfo.deploy_url
            }
          }
        }

        await projectQueries.updateProject(projectId, updateData)

        const oldStatus = project.deploy_status || "building"
        console.log(
          `🚀 Deploy status changed for project ${projectId}: ${oldStatus} -> ${newStatus}`,
        )

        if (this.io) {
          this.io.to(`project:${projectId}`).emit("deploy_status_update", {
            projectId,
            status: newStatus,
            url: updateData.netlify_url,
            timestamp: new Date().toISOString(),
          })

          console.log(
            `📡 Emitted deploy status update: ${newStatus} - ${updateData.netlify_url || "no URL"}`,
          )
        }
      }

      if (
        deployInfo.state === "building" ||
        deployInfo.state === "enqueued" ||
        deployInfo.state === "new"
      ) {
        setTimeout(() => {
          this.checkAndUpdateDeployStatus(projectId).catch((err) => {
            console.error(`❌ Error checking deploy status: ${err.message}`)
          })
      }
    } catch (error) {
      console.error(`❌ Error checking deploy status:`, error)
      setTimeout(() => {
        this.checkAndUpdateDeployStatus(projectId).catch(() => {
        })
    }
  }

  /**
   */
  async getLatestDeploy(siteId: string): Promise<NetlifyDeployResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}/deploys?per_page=1`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get latest deploy: ${response.status} ${errorText}`)
      }

      const deploys = (await response.json()) as NetlifyDeployResponse[]

      if (!deploys || deploys.length === 0) {
        throw new Error(`No deploys found for site ${siteId}`)
      }

      return deploys[0]
    } catch (error) {
      console.error("❌ Error getting latest deploy:", error)
      throw error
    }
  }

  /**
   */
  async deployProject(
    siteId: string,
    projectId: string,
    commitId: string,
    title: string = "Update from Phion",
  ): Promise<NetlifyDeployResponse> {
    console.log(
      `🚀 GitHub architecture: Netlify automatically deploys commit ${commitId} for site ${siteId}`,
    )

    const mockResponse: NetlifyDeployResponse = {
      id: `auto-deploy-${Date.now()}`,
      url: `https://${siteId}.netlify.app`,
      deploy_url: `https://${siteId}.netlify.app`,
      state: "building",
    }

    console.log(`✅ Netlify auto-deploy initiated: ${mockResponse.deploy_url}`)

    setTimeout(() => {
      this.checkAndUpdateDeployStatus(projectId).catch((error) => {
        console.error(`❌ Error starting deploy status check for project ${projectId}:`, error)
      })
    }, 10000)

    return mockResponse
  }

  /**
   */
  async getDeployStatus(siteId: string, deployId: string): Promise<NetlifyDeployResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}/deploys/${deployId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get deploy status: ${response.status} ${errorText}`)
      }

      return (await response.json()) as NetlifyDeployResponse
    } catch (error) {
      console.error("❌ Error getting deploy status:", error)
      throw error
    }
  }

  /**
   */
  async getSite(siteId: string): Promise<NetlifyCreateSiteResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get site info: ${response.status} ${errorText}`)
      }

      return (await response.json()) as NetlifyCreateSiteResponse
    } catch (error) {
      console.error("❌ Error getting site info:", error)
      throw error
    }
  }

  /**
   */
  async deleteSite(siteId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to delete site: ${response.status} ${errorText}`)
      }

      console.log(`✅ Deleted Netlify site: ${siteId}`)
    } catch (error) {
      console.error("❌ Error deleting site:", error)
      throw error
    }
  }

  /**
   */
  async checkAllActiveDeployments(): Promise<void> {
    try {
      const supabase = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabase)

      const buildingProjects = await projectQueries.getProjectsByDeployStatus("building")

      console.log(`🔍 Found ${buildingProjects.length} projects with building status`)

      for (const project of buildingProjects) {
        if (project.netlify_deploy_id) {
          console.log(`🔄 Checking status for project ${project.id}`)
          await this.checkAndUpdateDeployStatus(project.id)

          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
    } catch (error) {
      console.error("❌ Error checking all active deployments:", error)
    }
  }

  /**
   */
  private emitDeployStatus(
    projectId: string,
    deployStatusId: string,
    status: string,
    message: string,
  ) {
    if (this.io) {
      this.io.to(`project:${projectId}`).emit("deploy_status_update", {
        projectId,
        deployStatusId,
        status,
        message,
        timestamp: new Date().toISOString(),
      })
      console.log(`📡 Emitted deploy status update: ${status} - ${message}`)
    }
  }

  /**
   */
  async updateEnvironmentVariables(
    siteId: string,
    envVars: Record<string, string>,
    context: string = "all",
    scopes: string[] = ["builds", "functions"],
  ): Promise<void> {
    try {
      console.log(`🔧 Updating environment variables for site ${siteId}:`, {
        count: Object.keys(envVars).length,
        context,
        scopes,
      })

      // Netlify API requires separate request for each variable
      const updatePromises = Object.entries(envVars).map(async ([key, value]) => {
        const envVar: NetlifyEnvVar = {
          key,
          value,
          scopes,
          context,
        }

        const response = await fetch(`${this.baseUrl}/sites/${siteId}/env`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            {
              key,
              values: [
                {
                  value,
                  context,
                },
              ],
              scopes,
            },
          ]),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ Failed to update env var ${key}:`, errorText)
          throw new Error(`Failed to update environment variable ${key}: ${response.status}`)
        }

        return await response.json()
      })

      await Promise.all(updatePromises)

      console.log(`✅ Successfully updated ${Object.keys(envVars).length} environment variables`)
    } catch (error) {
      console.error("❌ Error updating environment variables:", error)
      throw error
    }
  }

  /**
   */
  async getEnvironmentVariables(siteId: string): Promise<NetlifyEnvResponse[]> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}/env`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get environment variables: ${response.status} ${errorText}`)
      }

      return (await response.json()) as NetlifyEnvResponse[]
    } catch (error) {
      console.error("❌ Error getting environment variables:", error)
      throw error
    }
  }

  /**
   */
  async deleteEnvironmentVariable(siteId: string, key: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}/env/${key}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to delete environment variable: ${response.status} ${errorText}`)
      }

      console.log(`✅ Deleted environment variable: ${key}`)
    } catch (error) {
      console.error("❌ Error deleting environment variable:", error)
      throw error
    }
  }

  /**
   */
  async syncEnvFile(
    siteId: string,
    envContent: string,
    options: {
      context?: string
      scopes?: string[]
      deleteUnused?: boolean
    } = {},
  ): Promise<void> {
    try {
      const { context = "all", scopes = ["builds", "functions"], deleteUnused = false } = options

      console.log(`🔄 Syncing .env file with Netlify site ${siteId}`)

      const envVars = this.parseEnvContent(envContent)

      if (Object.keys(envVars).length === 0) {
        console.log("⚠️ No environment variables found in .env content")
        return
      }

      let existingVars: NetlifyEnvResponse[] = []
      if (deleteUnused) {
        existingVars = await this.getEnvironmentVariables(siteId)
      }

      await this.updateEnvironmentVariables(siteId, envVars, context, scopes)

      if (deleteUnused && existingVars.length > 0) {
        const varsToDelete = existingVars
          .filter((existing) => !envVars.hasOwnProperty(existing.key))
          .map((v) => v.key)

        for (const key of varsToDelete) {
          await this.deleteEnvironmentVariable(siteId, key)
        }

        if (varsToDelete.length > 0) {
          console.log(`🗑️ Deleted ${varsToDelete.length} unused environment variables`)
        }
      }

      console.log(`✅ Environment variables synced successfully`)
    } catch (error) {
      console.error("❌ Error syncing env file:", error)
      throw error
    }
  }

  /**
   */
  private parseEnvContent(content: string): Record<string, string> {
    const envVars: Record<string, string> = {}

    const lines = content.split("\n")
    for (const line of lines) {
      const trimmedLine = line.trim()

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue
      }

      const match = trimmedLine.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
      if (match) {
        const [, key, value] = match
        const cleanValue = value.replace(/^["']|["']$/g, "")
        envVars[key] = cleanValue
      }
    }

    return envVars
  }
}
