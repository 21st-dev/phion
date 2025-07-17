import { getProjectById } from "@shipvibes/database"
import AdmZip from "adm-zip"
import { NextRequest, NextResponse } from "next/server"
// import { downloadProjectTemplate } from "@shipvibes/storage";
// Add GitHub App service
import { githubAppService } from "@/lib/github-service"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  let projectId: string | undefined

  try {
    const { id } = await params
    projectId = id

    console.log(`🔄 [DOWNLOAD] Starting GitHub-based download for project ${projectId}`)

    // Check  project
    console.log(`📋 [DOWNLOAD] Fetching project data for ${projectId}`)
    const project = await getProjectById(projectId)

    if (!project) {
      console.log(`❌ [DOWNLOAD] Project not found: ${projectId}`)
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    console.log(`✅ [DOWNLOAD] Project found: ${project.name} (template: ${project.template_type})`)

    // Check,  project has GitHub 
    if (!project.github_repo_name) {
      console.log(`❌ [DOWNLOAD] Project ${projectId} has no GitHub repository`)
      return NextResponse.json(
        { error: "Project does not have a GitHub repository" },
        { status: 404 },
      )
    }

    // Download project from GitHub
    console.log(`⬇️ [DOWNLOAD] Downloading ZIP from GitHub repository: ${project.github_repo_name}`)
    const downloadStartTime = Date.now()

    let originalProjectData: Buffer
    try {
      originalProjectData = await githubAppService.downloadRepositoryZip(
        project.github_repo_name,
        "main",
      )
      const downloadTime = Date.now() - downloadStartTime
      console.log(
        `✅ [DOWNLOAD] GitHub download completed in ${downloadTime}ms, size: ${
          originalProjectData?.length || 0
        } bytes`,
      )
    } catch (downloadError) {
      console.error(`❌ [DOWNLOAD] GitHub download failed for project ${projectId}:`, downloadError)
      return NextResponse.json({ error: "Failed to download project from GitHub" }, { status: 500 })
    }

    if (!originalProjectData || originalProjectData.length === 0) {
      console.log(`❌ [DOWNLOAD] Empty or invalid project data from GitHub for ${projectId}`)
      return NextResponse.json({ error: "Project template is empty or corrupted" }, { status: 404 })
    }

    console.log(`🔄 [DOWNLOAD] Processing ZIP to rename root folder for project ${projectId}...`)
    const processingStartTime = Date.now()

    let processedProjectData: Buffer
    try {
      const originalZip = new AdmZip(originalProjectData)
      const entries = originalZip.getEntries()

      console.log(`📂 [DOWNLOAD] Original ZIP contains ${entries.length} entries`)

      let originalRootFolder = ""
      const firstEntry = entries.find((entry) => entry.isDirectory)
      if (firstEntry) {
        console.log(`📁 [DOWNLOAD] Original root folder: "${originalRootFolder}"`)
      }

      // Create  ZIP 
      const newZip = new AdmZip()

      let newRootFolder = project.name.trim()

      newRootFolder = newRootFolder

      // If ,  fallback
      if (!newRootFolder) {
        newRootFolder = "project"
      }

      console.log(
        `📁 [DOWNLOAD] Renaming root folder: "${originalRootFolder}" → "${newRootFolder}"`,
      )

      let processedEntries = 0
      entries.forEach((entry) => {
        let newPath = entry.entryName

        // If , 
        if (originalRootFolder && entry.entryName.startsWith(originalRootFolder)) {
          newPath = entry.entryName.replace(originalRootFolder, newRootFolder)
        }

        // Add  ZIP
        if (entry.isDirectory) {
          newZip.addFile(newPath, Buffer.alloc(0))
        } else {
          newZip.addFile(newPath, entry.getData())
        }

        processedEntries++

        if (processedEntries % 100 === 0 || processedEntries === entries.length) {
          console.log(`🔄 [DOWNLOAD] Processed ${processedEntries}/${entries.length} entries`)
        }
      })

      processedProjectData = newZip.toBuffer()
      const processingTime = Date.now() - processingStartTime
      console.log(
        `✅ [DOWNLOAD] ZIP processing completed in ${processingTime}ms, new size: ${processedProjectData.length} bytes`,
      )
    } catch (processingError) {
      console.error(
        `❌ [DOWNLOAD] ZIP processing failed for project ${projectId}:`,
        processingError,
      )

      console.log(`⚠️ [DOWNLOAD] Falling back to original ZIP for project ${projectId}`)
      processedProjectData = originalProjectData
    }

    const totalTime = Date.now() - startTime
    console.log(`🎉 [DOWNLOAD] Successfully completed download for ${projectId} in ${totalTime}ms`)

    // Create safe filename for download with Unicode support
    const originalFileName = project.name.trim() || "project"

    // ASCII-safe filename for browser compatibility
    const safeFileName =
      originalFileName
        .replace(/[<>:"/\\|?*]/g, "-") // Dangerous symbols for filesystem
        .replace(/\s+/g, "-") // Spaces to dashes
        .replace(/-+/g, "-") // Multiple dashes to single
        .replace(/^-+|-+$/g, "") // Remove dashes at start and end
        // Replace non-ASCII symbols with ASCII equivalents
        .replace(/[^\x00-\x7F]/g, function (char) {
          // Simple transliteration for Cyrillic characters
          const transliterationMap: Record<string, string> = {
            : "a", : "b", : "v", : "g", : "d", : "e", : "yo", : "zh", : "z", : "i",
            : "y", : "k", : "l", : "m", : "n", : "o", : "p", : "r", : "s", : "t",
            : "u", : "f", : "h", : "ts", : "ch", : "sh", : "sch", : "", : "y",
            : "", : "e", : "yu", : "ya", : "A", : "B", : "V", : "G", : "D",
            : "E", : "Yo", : "Zh", : "Z", : "I", : "Y", : "K", : "L", : "M",
            : "N", : "O", : "P", : "R", : "S", : "T", : "U", : "F", : "H",
            : "Ts", : "Ch", : "Sh", : "Sch", : "", : "Y", : "", : "E", : "Yu", : "Ya"
          }

          return transliterationMap[char] || "x"
        }) || "project"

    // Create complete filename without project ID
    const fullFileName = `${safeFileName}.zip`

    console.log(`📁 [DOWNLOAD] Filename: "${originalFileName}" → "${fullFileName}"`)

    return new NextResponse(processedProjectData, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fullFileName}"`,
        "Content-Length": processedProjectData.length.toString(),
        // Add 
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error(
      `❌ [DOWNLOAD] Fatal error for project ${projectId || "unknown"} after ${totalTime}ms:`,
      error,
    )
    return NextResponse.json(
      {
        error: "Failed to download project",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
