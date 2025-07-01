#!/usr/bin/env node

import { exec, spawn } from "child_process"
import { existsSync, readFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { promisify } from "util"

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read debug mode from phion config
let DEBUG_MODE = false
try {
  const configPath = join(process.cwd(), "phion.config.json")
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf8"))
    DEBUG_MODE = config.debug === true
  }
} catch (error) {
  // Config not found or invalid, use default
  if (DEBUG_MODE) {
    console.log("⚠️ Could not read phion.config.json:", error.message)
  }
}

if (DEBUG_MODE) {
  console.log("🚀 Starting Phion development environment (DEBUG MODE)...\n")
} else {
  console.log("🚀 Starting your project...\n")
}

// Simple function to ensure phion is available
async function ensurePhion() {
  if (DEBUG_MODE) {
    console.log("✅ Phion will be installed/updated by pnpm install")
  }
  // No need to check versions - package.json has "latest" so pnpm install handles it
  return true
}

// Check if browser extension is ready (placeholder for future implementation)
function checkExtensionReady() {
  // TODO: Implement actual extension readiness check
  // For now, assume extension might be ready
  return true
}

// Main startup function
async function main() {
  try {
    // Check phion availability
    await ensurePhion()

    // Check extension readiness
    const extensionReady = checkExtensionReady()

    // Clear all development ports before starting
    if (DEBUG_MODE) {
      console.log("\n🧹 Clearing development ports...")
    }
    try {
      await execAsync("pnpm run clear:ports")
      if (DEBUG_MODE) {
        console.log("✅ Ports cleared successfully")
      }
    } catch (error) {
      if (DEBUG_MODE) {
        console.log("⚠️ Port clearing failed (ports may already be free):", error.message)
      }
    }

    if (DEBUG_MODE) {
      console.log("\n🚀 Starting development servers...")
    } else {
      console.log("\n🚀 Starting your project...")
      if (extensionReady) {
        console.log("🌐 Browser will open automatically when ready!")
      }
    }

    // Start Vite dev server
    const devProcess = spawn("pnpm", ["dev"], {
      stdio: "inherit",
      shell: true,
    })

    // Start sync agent
    const syncProcess = spawn("pnpm", ["sync"], {
      stdio: "inherit",
      shell: true,
    })

    // Handle process errors
    devProcess.on("error", (error) => {
      console.error("❌ Failed to start dev server:", error.message)
      process.exit(1)
    })

    syncProcess.on("error", (error) => {
      console.error("❌ Failed to start sync agent:", error.message)
      process.exit(1)
    })

    // Show helpful info after a delay
    setTimeout(() => {
      if (!DEBUG_MODE) {
        console.log("\n💡 Browser tips:")
        console.log("   • Browser should open automatically in 10-20 seconds")
        console.log("   • If not: Press Cmd+Shift+P → 'Phion: Open Preview'")
        console.log("   • Or visit: http://localhost:5173")
        console.log("   • Need help? Press Cmd+Shift+P → 'Phion: Fix Connection Issues'")
      }
    }, 8000)

    // Handle cleanup
    const cleanup = () => {
      if (DEBUG_MODE) {
        console.log("\n🛑 Stopping servers...")
      } else {
        console.log("\n🛑 Stopping...")
      }
      if (devProcess && !devProcess.killed) {
        devProcess.kill()
      }
      if (syncProcess && !syncProcess.killed) {
        syncProcess.kill()
      }
      process.exit(0)
    }

    process.on("SIGINT", cleanup)
    process.on("SIGTERM", cleanup)

    devProcess.on("exit", cleanup)
    syncProcess.on("exit", cleanup)
  } catch (error) {
    console.error("❌ Failed to start development environment:", error.message)
    process.exit(1)
  }
}

// Run the main function
main().catch((error) => {
  console.error("❌ Unexpected error:", error.message)
  process.exit(1)
})
