import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface VersionInfo {
  current: string
  latest?: string
  hasUpdate: boolean
}

/**
 */
export function getCurrentVersion(): string {
  try {
    // Try different paths for package.json in ES modules
    const possiblePaths = [
      path.join(__dirname, "..", "package.json"), // From dist/ to package root
      path.join(__dirname, "..", "..", "package.json"), // If dist is in subfolder
      path.join(process.cwd(), "node_modules", "phion", "package.json"), // In node_modules
    ]

    for (const packageJsonPath of possiblePaths) {
      try {
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
          if (packageJson.name === "phion" && packageJson.version) {
            return packageJson.version
          }
        }
      } catch (pathError) {
        // Try next path
        continue
      }
    }

    // Fallback version
    return "0.0.1"
  } catch (error) {
    // Fallback version
    return "0.0.1"
  }
}

/**
 */
export async function checkLatestVersion(wsUrl: string): Promise<string | null> {
  try {
    // Form HTTP URL from WebSocket URL
    const httpUrl = wsUrl.replace("ws://", "http://").replace("wss://", "https://")
    const versionUrl = `${httpUrl}/api/version`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(versionUrl, {
      method: "GET",
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      return data.latestAgentVersion || null
    }
  } catch (error) {
    // Ignore errors - not critical for agent operation
    if (process.env.DEBUG) {
      console.debug("Failed to check latest version:", error)
    }
  }

  return null
}

/**
 */
export function isNewerVersion(latest: string, current: string): boolean {
  try {
    const latestParts = latest.split(".").map(Number)
    const currentParts = current.split(".").map(Number)

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latestPart = latestParts[i] || 0
      const currentPart = currentParts[i] || 0

      if (latestPart > currentPart) return true
      if (latestPart < currentPart) return false
    }

    return false
  } catch (error) {
    return false
  }
}

/**
 */
export async function checkForUpdates(wsUrl: string): Promise<VersionInfo> {
  const current = getCurrentVersion()
  const latest = await checkLatestVersion(wsUrl)

  const hasUpdate = latest ? isNewerVersion(latest, current) : false

  return {
    current,
    latest: latest || undefined,
    hasUpdate,
  }
}
