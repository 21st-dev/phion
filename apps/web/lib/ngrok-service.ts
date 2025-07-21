// NgrokService uses dynamic import to avoid webpack errors

export class NgrokService {
  private tunnelUrl: string | null = null
  private isStarted = false

  /**
   */
  async startTunnel(): Promise<string> {
    if (this.isStarted && this.tunnelUrl) {
      console.log(`🔗 Ngrok tunnel already running: ${this.tunnelUrl}`)
      return this.tunnelUrl
    }

    try {
      console.log("🚀 Starting ngrok tunnel for port 8080...")

      const ngrok = await import("@ngrok/ngrok")

      const listener = await ngrok.default.forward({
        addr: 8080,
      })

      this.tunnelUrl = listener.url()
      this.isStarted = true

      console.log(`✅ Ngrok tunnel started: ${this.tunnelUrl}`)
      console.log(`🌐 Webhooks endpoint: ${this.tunnelUrl}/webhooks/netlify`)

      process.env.WEBSOCKET_SERVER_URL = this.tunnelUrl || ""

      return this.tunnelUrl || ""
    } catch (error) {
      console.error("❌ Failed to start ngrok tunnel:", error)

      // Fallback to localhost if ngrok doesn't work
      console.log("⚠️ Falling back to localhost:8080")
      this.tunnelUrl = "http://localhost:8080"
      process.env.WEBSOCKET_SERVER_URL = this.tunnelUrl || ""

      return this.tunnelUrl
    }
  }

  /**
   */
  async stopTunnel(): Promise<void> {
    if (!this.isStarted) {
      return
    }

    try {
      console.log("🛑 Stopping ngrok tunnel...")

      const ngrok = await import("@ngrok/ngrok")
      await ngrok.default.disconnect()
      await ngrok.default.kill()

      this.tunnelUrl = null
      this.isStarted = false

      console.log("✅ Ngrok tunnel stopped")
    } catch (error) {
      console.error("❌ Error stopping ngrok tunnel:", error)
    }
  }

  /**
   */
  getTunnelUrl(): string | null {
    return this.tunnelUrl
  }

  /**
   */
  isRunning(): boolean {
    return this.isStarted && this.tunnelUrl !== null
  }
}

export const ngrokService = new NgrokService()

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down ngrok tunnel...")
  await ngrokService.stopTunnel()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down ngrok tunnel...")
  await ngrokService.stopTunnel()
  process.exit(0)
})
