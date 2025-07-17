import fetch from "node-fetch"

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

interface NetlifyWebhookResponse {
  id: string
  site_id: string
  type: string
  event: string
  data: {
    url: string
  }
  created_at: string
  updated_at: string
}

export class NetlifyService {
  private accessToken: string
  private baseUrl = "https://api.netlify.com/api/v1"

  constructor() {
    this.accessToken = process.env.NETLIFY_ACCESS_TOKEN!

    if (!this.accessToken) {
      throw new Error("NETLIFY_ACCESS_TOKEN environment variable is required")
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
      // GitHub App Installation ID for phion organization
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

  /**
   */
  private async setupWebhook(siteId: string, projectId: string): Promise<void> {
    try {
      let webhookUrl = process.env.WEBSOCKET_SERVER_URL

      if (process.env.NODE_ENV === "development" || !webhookUrl) {
        try {
          console.log("🔗 Starting ngrok tunnel for development webhooks...")
          const { ngrokService } = await import("./ngrok-service")
          webhookUrl = await ngrokService.startTunnel()
        } catch (error) {
          console.error("❌ Failed to import/start ngrok:", error)
          console.log("⚠️ Falling back to localhost:8080 for webhooks")
          webhookUrl = "http://localhost:8080"
        }
      }

      const webhookEndpoint = `${webhookUrl}/webhooks/netlify`

      console.log(`🔗 Setting up webhook for site ${siteId} → ${webhookEndpoint}`)

              // deploy_succeeded doesn't exist - remove it
      const events = ["deploy_created", "deploy_building", "deploy_failed"]
      const webhookPromises = []

      // Create separate webhook for each event
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

      // Check results
      const results = []
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
        const error = await response.text()
        throw new Error(`Failed to get site info: ${response.status} ${error}`)
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
        const error = await response.text()
        throw new Error(`Failed to delete site: ${response.status} ${error}`)
      }

      console.log(`✅ Deleted Netlify site: ${siteId}`)
    } catch (error) {
      console.error("❌ Error deleting site:", error)
      throw error
    }
  }
}

export const netlifyService = new NetlifyService()
