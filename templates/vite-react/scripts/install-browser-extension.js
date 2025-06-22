#!/usr/bin/env node

import { exec } from "child_process"
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "fs"
import { homedir } from "os"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { promisify } from "util"

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log("📦 Installing Phion Auto Browser Extension for Cursor...")

const extensionDir = join(__dirname, "auto-browser-extension")
const packageJsonPath = join(extensionDir, "package.json")
const extensionJsPath = join(extensionDir, "src", "extension.ts")

// Check if extension files exist
if (!existsSync(packageJsonPath) || !existsSync(extensionJsPath)) {
  console.log("❌ Extension files not found.")
  process.exit(1)
}

// Function to copy directory recursively
function copyDir(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true })
  }

  const files = readdirSync(src)

  for (const file of files) {
    const srcPath = join(src, file)
    const destPath = join(dest, file)

    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

// Auto-reload Cursor window
async function reloadCursorWindow() {
  try {
    console.log("🔄 Automatically reloading Cursor window...")

    // Method 1: Try cursor command with reload
    try {
      await execAsync('cursor --command "workbench.action.reloadWindow"')
      console.log("✅ Cursor window reloaded automatically!")
      return true
    } catch (error) {
      // Method 1 failed, try Method 2
    }

    // Method 2: Try with code command (if cursor not available)
    try {
      await execAsync('code --command "workbench.action.reloadWindow"')
      console.log("✅ Window reloaded automatically!")
      return true
    } catch (error) {
      // Method 2 failed, try Method 3
    }

    // Method 3: macOS AppleScript approach
    if (process.platform === "darwin") {
      try {
        const script = `
          tell application "Cursor"
            activate
            delay 0.5
            tell application "System Events"
              keystroke "p" using {command down, shift down}
              delay 0.5
              type text "Developer: Reload Window"
              delay 0.5
              keystroke return
            end tell
          end tell
        `
        await execAsync(`osascript -e '${script}'`)
        console.log("✅ Cursor window reload triggered via AppleScript!")
        return true
      } catch (error) {
        // Method 3 failed
      }
    }

    // All methods failed
    return false
  } catch (error) {
    return false
  }
}

try {
  // Find Cursor extensions directory
  const homeDir = homedir()
  const cursorExtensionsDir = join(homeDir, ".cursor", "extensions")

  if (!existsSync(cursorExtensionsDir)) {
    console.log("❌ Cursor extensions directory not found")
    console.log("💡 Make sure Cursor is installed and has been run at least once")
    process.exit(1)
  }

  // Create extension directory in Cursor extensions
  const targetExtensionDir = join(cursorExtensionsDir, "phion-auto-browser-0.0.8")

  console.log("🔄 Copying extension to Cursor extensions directory...")
  console.log(`📁 Target: ${targetExtensionDir}`)

  // Remove old versions if they exist
  const oldVersionDirs = [
    join(cursorExtensionsDir, "phion-auto-browser-0.0.1"),
    join(cursorExtensionsDir, "phion-auto-browser-0.0.2"),
    join(cursorExtensionsDir, "phion-auto-browser-0.0.3"),
    join(cursorExtensionsDir, "phion-auto-browser-0.0.4"),
    join(cursorExtensionsDir, "phion-auto-browser-0.0.5"),
    join(cursorExtensionsDir, "phion-auto-browser-0.0.6"),
    join(cursorExtensionsDir, "phion-auto-browser-0.0.7"),
  ]

  for (const oldVersionDir of oldVersionDirs) {
    if (existsSync(oldVersionDir)) {
      console.log(`🗑️  Removing old version: ${oldVersionDir}...`)
      rmSync(oldVersionDir, { recursive: true, force: true })
    }
  }

  // Copy extension files
  copyDir(extensionDir, targetExtensionDir)

  console.log("✅ Extension installed successfully in Cursor!")

  // Try automatic reload
  const reloadSuccess = await reloadCursorWindow()

  if (reloadSuccess) {
    console.log("")
    console.log("🎉 Extension is now active and ready to use!")
    console.log("✨ Browser will auto-open when you run 'pnpm start'")
  } else {
    console.log("")
    console.log("🔄 Please reload Cursor window manually:")
    console.log("   1. Press Cmd+Shift+P (or Ctrl+Shift+P on Windows/Linux)")
    console.log("   2. Type: 'Developer: Reload Window'")
    console.log("   3. Press Enter")
    console.log("")
    console.log("🎉 After reload, the browser will auto-open when you run 'pnpm start'!")
  }

  console.log("")
  console.log("💡 Manual commands (if needed):")
  console.log("   • Cmd+Shift+P → 'Phion: Start Project'")
  console.log("   • Cmd+Shift+P → 'Phion: Open Preview'")
} catch (error) {
  console.log("❌ Failed to install extension:", error.message)
  console.log("")
  console.log("💡 Manual installation alternative:")
  console.log("   1. Open Cursor")
  console.log("   2. Press Cmd+Shift+P (or Ctrl+Shift+P)")
  console.log("   3. Type 'Developer: Reload Window' and press Enter")
  console.log("   4. Try running 'pnpm start' again")
  console.log("")
  console.log("🆘 If issues persist:")
  console.log("   • Restart Cursor completely")
  console.log("   • Verify the extension directory exists")
  console.log("   • Check Cursor's Extensions panel")
}
