import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import fs from 'fs/promises'
import path from 'path'

interface ToolbarVersion {
  version: string
  build: number
  channel: 'stable' | 'beta' | 'dev'
  url: string
  checksum: string
  releaseNotes?: string
  timestamp: number
}

interface UploadResult {
  success: boolean
  version: ToolbarVersion
  error?: string
}

export class R2ToolbarManager {
  private s3Client: S3Client
  private bucketName: string
  private baseUrl: string

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME!
    this.baseUrl = `https://${this.bucketName}.r2.dev`
    
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  }

  async uploadToolbarVersion(
    filePath: string,
    version: string,
    channel: 'stable' | 'beta' | 'dev',
    releaseNotes?: string
  ): Promise<UploadResult> {
    try {
      // Read toolbar file
      const fileContent = await fs.readFile(filePath)
      const checksum = this.calculateChecksum(fileContent)
      
      // Upload to R2
      const key = `toolbar/v${version}/index.global.js`
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileContent,
        ContentType: 'application/javascript',
        CacheControl: 'public, max-age=31536000', // 1 year
        Metadata: {
          version,
          channel,
          checksum,
          timestamp: Date.now().toString()
        }
      }))

      // Create version metadata
      const toolbarVersion: ToolbarVersion = {
        version,
        build: await this.getNextBuildNumber(channel),
        channel,
        url: `${this.baseUrl}/${key}`,
        checksum,
        releaseNotes,
        timestamp: Date.now()
      }

      // Upload metadata
      await this.uploadVersionMetadata(toolbarVersion)

      return {
        success: true,
        version: toolbarVersion
      }

    } catch (error) {
      console.error('Failed to upload toolbar version:', error)
      return {
        success: false,
        version: {} as ToolbarVersion,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getAvailableVersions(channel?: string): Promise<ToolbarVersion[]> {
    try {
      const prefix = 'toolbar/metadata/'
      const response = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      }))

      const versions: ToolbarVersion[] = []

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key) {
            try {
              const metadata = await this.getVersionMetadata(object.Key)
              if (!channel || metadata.channel === channel) {
                versions.push(metadata)
              }
            } catch (error) {
              console.warn('Failed to parse version metadata:', object.Key)
            }
          }
        }
      }

      // Sort by version descending
      return versions.sort((a, b) => this.compareVersions(b.version, a.version))

    } catch (error) {
      console.error('Failed to get available versions:', error)
      return []
    }
  }

  async getLatestVersion(channel: 'stable' | 'beta' | 'dev'): Promise<ToolbarVersion | null> {
    const versions = await this.getAvailableVersions(channel)
    return versions.length > 0 ? versions[0] : null
  }

  async deleteVersion(version: string): Promise<boolean> {
    try {
      // Delete the JS file
      await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: `toolbar/v${version}/index.global.js`
      }))

      // Delete metadata
      await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: `toolbar/metadata/v${version}.json`
      }))

      return true

    } catch (error) {
      console.error('Failed to delete version:', error)
      return false
    }
  }

  private async uploadVersionMetadata(version: ToolbarVersion): Promise<void> {
    const key = `toolbar/metadata/v${version.version}.json`
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify(version, null, 2),
      ContentType: 'application/json',
    }))
  }

  private async getVersionMetadata(key: string): Promise<ToolbarVersion> {
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    }))

    const content = await this.streamToString(response.Body)
    return JSON.parse(content)
  }

  private async getNextBuildNumber(channel: string): Promise<number> {
    const versions = await this.getAvailableVersions(channel)
    const maxBuild = Math.max(...versions.map(v => v.build), 0)
    return maxBuild + 1
  }

  private calculateChecksum(content: Buffer): string {
    return createHash('sha256').update(content.toString()).digest('hex').slice(0, 16)
  }

  private compareVersions(v1: string, v2: string): number {
    const clean1 = v1.replace(/[^\d.]/g, '')
    const clean2 = v2.replace(/[^\d.]/g, '')
    
    const parts1 = clean1.split('.').map(Number)
    const parts2 = clean2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const a = parts1[i] || 0
      const b = parts2[i] || 0
      if (a > b) return 1
      if (a < b) return -1
    }
    
    return 0
  }

  private async streamToString(stream: any): Promise<string> {
    const chunks: Uint8Array[] = []
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Uint8Array) => chunks.push(chunk))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    })
  }
}

export const r2ToolbarManager = new R2ToolbarManager() 