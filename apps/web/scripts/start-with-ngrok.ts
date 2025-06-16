#!/usr/bin/env tsx

import { spawn } from "child_process"
import { ngrokService } from "../lib/ngrok-service"

async function startWithNgrok() {
  console.log("🚀 Starting Phion Web with ngrok tunnel...\n")

  try {
    // 1. Сначала запускаем ngrok туннель
    console.log("🔗 Setting up ngrok tunnel...")
    const tunnelUrl = await ngrokService.startTunnel()
    console.log(`✅ Ngrok tunnel ready: ${tunnelUrl}\n`)

    // 2. Затем запускаем Next.js dev сервер
    console.log("📦 Starting Next.js dev server...")
    const nextProcess = spawn("pnpm", ["dev"], {
      stdio: "inherit",
      cwd: process.cwd(),
      env: {
        ...process.env,
        WEBSOCKET_SERVER_URL: tunnelUrl, // Передаем URL в переменную окружения
      },
    })

    nextProcess.on("error", (error) => {
      console.error("❌ Failed to start Next.js dev server:", error)
      process.exit(1)
    })

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down...")
      nextProcess.kill("SIGINT")
      await ngrokService.stopTunnel()
      process.exit(0)
    })

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Shutting down...")
      nextProcess.kill("SIGTERM")
      await ngrokService.stopTunnel()
      process.exit(0)
    })
  } catch (error) {
    console.error("❌ Failed to start with ngrok:", error)
    process.exit(1)
  }
}

// Запускаем
startWithNgrok().catch(console.error)
