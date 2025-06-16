import { exec } from "child_process"
import { promisify } from "util"
import http from "http"

const execAsync = promisify(exec)

export interface VSCodeConfig {
  autoOpen: boolean
  port: number
  url?: string
}

/**
 * Detects if VS Code or Cursor is running
 */
export function detectVSCode(): boolean {
  return !!(
    process.env.VSCODE_PID ||
    process.env.TERM_PROGRAM === "vscode" ||
    process.env.VSCODE_INJECTION === "1" ||
    process.env.TERM_PROGRAM === "cursor" ||
    process.env.CURSOR_PID ||
    process.env.CURSOR_TRACE_ID
  )
}

/**
 * Determines if Cursor (not VS Code) is being used
 */
export function isCursor(): boolean {
  return !!(
    process.env.CURSOR_TRACE_ID || process.env.VSCODE_GIT_ASKPASS_NODE?.includes("Cursor.app")
  )
}

/**
 * Checks if code/cursor command is available in PATH
 */
export async function isCodeCommandAvailable(): Promise<boolean> {
  const useCursor = isCursor()
  const command = useCursor ? "cursor" : "code"

  try {
    await execAsync(`${command} --version`)
    return true
  } catch {
    try {
      const altCommand = useCursor ? "code" : "cursor"
      await execAsync(`${altCommand} --version`)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Checks if dev server is ready on specified port
 */
export function checkDevServerReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(res.statusCode === 200)
    })

    req.on("error", () => {
      resolve(false)
    })

    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

/**
 * Finds active Vite dev server port
 */
export async function findVitePort(): Promise<number | null> {
  const commonPorts = [5177, 5176, 5175, 5174, 5173, 3001, 3000]

  for (const port of commonPorts) {
    if (await checkDevServerReady(port)) {
      return port
    }
  }

  return null
}

/**
 * Waits for dev server to be ready with timeout
 */
export async function waitForDevServer(port: number, timeout = 30000): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await checkDevServerReady(port)) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return false
}

/**
 * Opens URL in VS Code/Cursor Simple Browser
 */
export async function openInVSCodeSimpleBrowser(url: string): Promise<boolean> {
  const useCursor = isCursor()
  const command = useCursor ? "cursor" : "code"

  try {
    if (useCursor) {
      await execAsync(`${command} --command "vscode.open" --command-args "${url}"`)
      return true
    } else {
      await execAsync(`${command} --command "simpleBrowser.show" --command-args "${url}"`)
      return true
    }
  } catch {
    try {
      await execAsync(`${command} --command "simpleBrowser.show" --command-args "${url}"`)
      return true
    } catch {
      try {
        const encodedUrl = encodeURIComponent(url)
        await execAsync(
          `${command} --open-url "vscode://ms-vscode.vscode-simple-browser/show?url=${encodedUrl}"`,
        )
        return true
      } catch {
        try {
          await execAsync(`${command} --open-url "${url}"`)
          return true
        } catch {
          return false
        }
      }
    }
  }
}

/**
 * Opens URL in system browser as fallback
 */
export async function openInSystemBrowser(url: string): Promise<boolean> {
  try {
    const platform = process.platform
    let command: string

    switch (platform) {
      case "darwin":
        command = `open "${url}"`
        break
      case "win32":
        command = `start "" "${url}"`
        break
      default:
        command = `xdg-open "${url}"`
        break
    }

    await execAsync(command)
    return true
  } catch {
    return false
  }
}

/**
 * Main function for opening preview
 */
export async function openPreview(config: VSCodeConfig, debug = false): Promise<void> {
  if (!config.autoOpen) {
    return
  }

  // Find active Vite port
  let port = config.port
  let url = config.url

  if (!url) {
    const foundPort = await findVitePort()
    if (foundPort) {
      port = foundPort
      url = `http://localhost:${port}`
    } else {
      url = `http://localhost:${port}`
    }
  }

  // Check server readiness
  const isReady = await checkDevServerReady(port)
  if (!isReady) {
    if (debug) {
      console.warn(`Dev server not ready at ${url}`)
    }
    return
  }

  // Show URL to user (only in debug mode)
  if (debug) {
    console.log(`🚀 Development server ready: ${url}`)
  }

  // Try Simple Browser if VS Code/Cursor detected
  const isVSCode = detectVSCode()
  const hasCodeCommand = await isCodeCommandAvailable()

  if (isVSCode && hasCodeCommand) {
    const success = await openInVSCodeSimpleBrowser(url)
    if (success) {
      if (debug) {
        console.log("✅ Preview opened in browser")
      }
      return
    }
  }

  // Fallback to system browser
  const systemSuccess = await openInSystemBrowser(url)
  if (systemSuccess) {
    if (debug) {
      console.log("✅ Preview opened in browser")
    }
    return
  }

  console.log(`💡 Open manually: ${url}`)
}
