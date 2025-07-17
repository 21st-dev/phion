#!/usr/bin/env node

import { PhionAgent, AgentConfig } from "./agent.js"
import { checkForUpdates as checkVersionUpdates, getCurrentVersion } from "./version-checker.js"
import fs from "fs"
import path from "path"

// Function for reading configuration
function loadConfig(): AgentConfig {
  // 1. Try to find phion.config.json
  const configPath = path.join(process.cwd(), "phion.config.json")
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
      return {
        projectId: config.projectId,
        wsUrl: config.wsUrl || process.env.PHION_WS_URL || "ws://localhost:8080",
        debug: config.debug || false,
        toolbar: config.toolbar || {
          enabled: true,
          position: "top",
          autoOpen: true,
        },
      }
    } catch (error) {
      console.error("❌ Error reading phion.config.json:", (error as Error).message)
    }
  }

  // 2. Fallback to environment variables or args
  const projectId = process.env.PHION_PROJECT_ID || process.argv[2]
  const wsUrl = process.env.PHION_WS_URL || "ws://localhost:8080"

  if (!projectId || projectId === "__PROJECT_ID__") {
    console.error("❌ Missing project ID!")
    console.log("Add project ID to phion.config.json or pass as argument")
    process.exit(1)
  }

  return {
    projectId,
    wsUrl,
    debug: false,
    toolbar: {
      enabled: true,
      position: "top",
      autoOpen: true,
    },
  }
}

// Version check with update notifications
async function checkForUpdates(wsUrl: string, debug: boolean = false): Promise<void> {
  try {
    const currentVersion = getCurrentVersion()
    console.log(`📦 Phion v${currentVersion}`)

    // Check updates only if debug mode or explicitly requested
    if (debug) {
      try {
        const versionInfo = await checkVersionUpdates(wsUrl)

        if (versionInfo.hasUpdate && versionInfo.latest) {
          console.log(`🆕 New version ${versionInfo.latest} available!`)
          console.log("📥 Run 'pnpm update phion' to update")
          console.log("")
        }
      } catch (updateCheckError) {
        console.debug("Update check failed:", updateCheckError)
      }
    }
  } catch (error) {
    // Ignore update check errors
  }
}

async function main() {
  try {
    const config = loadConfig()
    await checkForUpdates(config.wsUrl, config.debug)
    const agent = new PhionAgent(config)

    // Graceful shutdown
    const shutdown = () => {
      agent.stop()
      process.exit(0)
    }

    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)

    // Start agent
    await agent.start()

    // Keep process alive
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.on("data", (key) => {
      // Ctrl+C для выхода
      if (key[0] === 3) {
        shutdown()
      }
    })
  } catch (error) {
    console.error("❌ Failed to start Phion Agent:", (error as Error).message)
    process.exit(1)
  }
}

main()
