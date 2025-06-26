#!/usr/bin/env node

import { execSync } from "child_process"
import fs from "fs"
import https from "https"
import os from "os"
import path from "path"

// Configuration: Add extensions to check here
const EXTENSIONS_TO_CHECK = [
  {
    id: "phion.phion-dev-tools",
    versionsUrl: "https://open-vsx.org/api/phion/phion-dev-tools/versions",
  },
  {
    id: "21st-dev.21st-extension",
    versionsUrl: "https://open-vsx.org/api/21st-dev/21st-extension/versions",
  },
  // Add more extensions here as needed
  // {
  //   id: 'publisher.extension-name',
  //   versionsUrl: 'https://open-vsx.org/api/publisher/extension-name/versions'
  // }
]

/**
 * Fetch JSON data from a URL
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = ""

        res.on("data", (chunk) => {
          data += chunk
        })

        res.on("end", () => {
          try {
            const json = JSON.parse(data)
            resolve(json)
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`))
          }
        })
      })
      .on("error", (error) => {
        reject(new Error(`Request failed: ${error.message}`))
      })
  })
}

/**
 * Download a file from URL to local path
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath)
    let downloadedBytes = 0

    https
      .get(url, (response) => {
        // Check if we got a redirect
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close()
          fs.unlink(filePath, () => {})
          console.log(`Following redirect to: ${response.headers.location}`)
          return downloadFile(response.headers.location, filePath).then(resolve).catch(reject)
        }

        // Check for successful response
        if (response.statusCode !== 200) {
          file.close()
          fs.unlink(filePath, () => {})
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        }

        response.on("data", (chunk) => {
          downloadedBytes += chunk.length
        })

        response.pipe(file)

        file.on("finish", () => {
          file.close()
          console.log(`Downloaded ${downloadedBytes} bytes`)

          // Verify file size
          const stats = fs.statSync(filePath)
          if (stats.size === 0) {
            fs.unlink(filePath, () => {})
            return reject(new Error("Downloaded file is empty"))
          }

          resolve(filePath)
        })

        file.on("error", (error) => {
          fs.unlink(filePath, () => {}) // Clean up on error
          reject(error)
        })
      })
      .on("error", (error) => {
        reject(error)
      })
  })
}

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number)
  const parts2 = v2.split(".").map(Number)

  const maxLength = Math.max(parts1.length, parts2.length)

  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0

    if (part1 < part2) return -1
    if (part1 > part2) return 1
  }

  return 0
}

/**
 * Get currently installed version of an extension
 */
function getInstalledVersion(extensionId) {
  try {
    const output = execSync("cursor --list-extensions --show-versions", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    const lines = output.split("\n")
    const extensionLine = lines.find((line) => line.startsWith(extensionId))

    if (extensionLine) {
      const version = extensionLine.split("@")[1]
      return version ? version.trim() : null
    }

    return null
  } catch (error) {
    console.warn(`Warning: Could not get installed version for ${extensionId}:`, error.message)
    return null
  }
}

/**
 * Install extension from file path
 */
function installExtension(filePath) {
  try {
    console.log(`Installing extension from: ${filePath}`)
    execSync(`cursor --install-extension "${filePath}"`, {
      stdio: "inherit",
    })
    return true
  } catch (error) {
    console.error(`Failed to install extension:`, error.message)
    return false
  }
}

/**
 * Get the latest version from all available versions
 */
function getLatestVersion(versions) {
  const versionNumbers = Object.keys(versions)

  if (versionNumbers.length === 0) {
    return null
  }

  // Sort versions in descending order to get the highest one
  versionNumbers.sort((a, b) => compareVersions(b, a))

  return versionNumbers[0]
}

/**
 * Fetch all versions and determine the latest one
 */
async function fetchLatestVersionInfo(extension) {
  console.log(`Fetching all versions from: ${extension.versionsUrl}`)
  const versionsData = await fetchJson(extension.versionsUrl)

  if (!versionsData.versions || typeof versionsData.versions !== "object") {
    throw new Error(`Invalid versions response format for ${extension.id}`)
  }

  const latestVersion = getLatestVersion(versionsData.versions)

  if (!latestVersion) {
    throw new Error(`No versions found for ${extension.id}`)
  }

  const latestVersionUrl = versionsData.versions[latestVersion]
  console.log(`Latest version found: ${latestVersion}`)
  console.log(`Fetching version details from: ${latestVersionUrl}`)

  // Fetch the specific version details
  const latestInfo = await fetchJson(latestVersionUrl)

  return {
    version: latestVersion,
    info: latestInfo,
  }
}

/**
 * Check and update a single extension
 */
async function checkAndUpdateExtension(extension) {
  console.log(`\n🔍 Checking ${extension.id}...`)

  try {
    // Fetch latest version info
    console.log(`Fetching latest version info...`)
    const latestVersionData = await fetchLatestVersionInfo(extension)

    if (!latestVersionData.version) {
      console.error(`❌ No version found in response for ${extension.id}`)
      return false
    }

    const latestVersion = latestVersionData.version
    console.log(`📦 Latest version: ${latestVersion}`)

    // Get currently installed version
    const installedVersion = getInstalledVersion(extension.id)

    if (installedVersion) {
      console.log(`💾 Installed version: ${installedVersion}`)

      const versionComparison = compareVersions(installedVersion, latestVersion)

      if (versionComparison === 0) {
        console.log(`✅ ${extension.id} is already up to date`)
        return true
      } else if (versionComparison > 0) {
        console.log(
          `✅ ${extension.id} local version (${installedVersion}) is newer than registry version (${latestVersion})`,
        )
        return true
      }

      console.log(`🔄 Updating from ${installedVersion} to ${latestVersion}`)
    } else {
      console.log(`📥 Extension not installed, will install latest version`)
    }

    const downloadInfo = latestVersionData.info.files?.download
    if (!downloadInfo) {
      console.error(`❌ No download URL found for ${extension.id}`)
      console.error(`Available files:`, Object.keys(latestVersionData.info.files || {}))
      return false
    }

    const downloadUrl = downloadInfo
    console.log(`⬇️  Downloading from: ${downloadUrl}`)

    // Create temp directory and download file
    const tempDir = path.join(os.tmpdir(), "cursor-extensions")
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const fileName = `${extension.id.replace(".", "-")}-${latestVersion}.vsix`
    const filePath = path.join(tempDir, fileName)

    await downloadFile(downloadUrl, filePath)
    console.log(`✅ Downloaded to: ${filePath}`)

    // Install the extension
    const success = installExtension(filePath)

    // Clean up downloaded file
    try {
      fs.unlinkSync(filePath)
    } catch (error) {
      console.warn(`Warning: Could not clean up temporary file: ${filePath}`)
    }

    if (success) {
      console.log(`🎉 Successfully updated ${extension.id} to version ${latestVersion}`)
      return true
    } else {
      console.error(`❌ Failed to install ${extension.id}`)
      return false
    }
  } catch (error) {
    console.error(`❌ Error checking ${extension.id}:`, error.message)
    return false
  }
}

/**
 * Main function
 */
async function main() {
  // Check if cursor CLI is available
  try {
    execSync("cursor --version", { stdio: "pipe" })
  } catch (error) {
    console.error(
      "❌ Cursor CLI not found. Please make sure Cursor is installed and accessible from command line.",
    )
    process.exit(1)
  }

  let successCount = 0
  let totalCount = EXTENSIONS_TO_CHECK.length

  // Check each extension
  for (const extension of EXTENSIONS_TO_CHECK) {
    const success = await checkAndUpdateExtension(extension)
    if (success) {
      successCount++
    }
  }

  // Summary
  console.log(`\n📊 Summary: ${successCount}/${totalCount} extensions processed successfully`)

  if (successCount === totalCount) {
    console.log("✅ All extensions are up to date!")
  } else {
    console.log("⚠️  Some extensions could not be updated. Check the logs above for details.")
  }

  // Explicitly exit to ensure the script doesn't hang
  process.exit(0)
}

// Run the script directly
main().catch((error) => {
  console.error("💥 Fatal error:", error.message)
  process.exit(1)
})
