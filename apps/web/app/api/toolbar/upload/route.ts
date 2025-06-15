import { NextRequest, NextResponse } from "next/server"
import { r2ToolbarManager } from "@shipvibes/storage"
import { writeFile, unlink } from "fs/promises"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"

interface UploadRequest {
  version: string
  channel: "stable" | "beta" | "dev"
  releaseNotes?: string
  fileContent: string // base64 encoded
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement proper authentication in production
    // For now, skip auth check for build compatibility

    const body: UploadRequest = await request.json()
    const { version, channel, releaseNotes, fileContent } = body

    // Validate input
    if (!version || !channel || !fileContent) {
      return NextResponse.json(
        { error: "Missing required fields: version, channel, fileContent" },
        { status: 400 },
      )
    }

    if (!["stable", "beta", "dev"].includes(channel)) {
      return NextResponse.json(
        { error: "Invalid channel. Must be stable, beta, or dev" },
        { status: 400 },
      )
    }

    // Decode and save file temporarily
    const tempFileName = `toolbar-${uuidv4()}.js`
    const tempFilePath = join("/tmp", tempFileName)

    try {
      const fileBuffer = Buffer.from(fileContent, "base64")
      await writeFile(tempFilePath, new Uint8Array(fileBuffer))

      // Upload to R2
      const result = await r2ToolbarManager.uploadToolbarVersion(
        tempFilePath,
        version,
        channel,
        releaseNotes,
      )

      // Clean up temp file
      await unlink(tempFilePath)

      if (result.success) {
        return NextResponse.json({
          success: true,
          version: result.version,
          message: `Toolbar version ${version} uploaded successfully to ${channel} channel`,
        })
      } else {
        return NextResponse.json({ error: result.error || "Upload failed" }, { status: 500 })
      }
    } catch (fileError) {
      // Clean up temp file on error
      try {
        await unlink(tempFilePath)
      } catch {}

      throw fileError
    }
  } catch (error) {
    console.error("Toolbar upload failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Alternative endpoint for multipart form uploads
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const version = formData.get("version") as string
    const channel = formData.get("channel") as string
    const releaseNotes = formData.get("releaseNotes") as string

    if (!file || !version || !channel) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Save file temporarily
    const tempFileName = `toolbar-${uuidv4()}.js`
    const tempFilePath = join("/tmp", tempFileName)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      await writeFile(tempFilePath, buffer)

      // Upload to R2
      const result = await r2ToolbarManager.uploadToolbarVersion(
        tempFilePath,
        version,
        channel as "stable" | "beta" | "dev",
        releaseNotes,
      )

      // Clean up temp file
      await unlink(tempFilePath)

      if (result.success) {
        return NextResponse.json({
          success: true,
          version: result.version,
        })
      } else {
        return NextResponse.json({ error: result.error || "Upload failed" }, { status: 500 })
      }
    } catch (fileError) {
      // Clean up temp file on error
      try {
        await unlink(tempFilePath)
      } catch {}

      throw fileError
    }
  } catch (error) {
    console.error("Toolbar upload failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
