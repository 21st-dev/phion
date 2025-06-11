import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { r2ToolbarManager } from '@shipvibes/storage'

interface UpdateCheckRequest {
  currentVersion: string
  channel: 'stable' | 'beta' | 'dev'
  projectId: string
}

interface ToolbarVersion {
  version: string
  build: number
  channel: 'stable' | 'beta' | 'dev'
  url: string
  checksum: string
  releaseNotes?: string
  timestamp: number
}

// Versions are now loaded dynamically from R2

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parts1[i] || 0
    const b = parts2[i] || 0
    if (a > b) return 1
    if (a < b) return -1
  }
  
  return 0
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateCheckRequest = await request.json()
    const { currentVersion, channel, projectId } = body

    // Validate request
    if (!currentVersion || !channel || !projectId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify project exists (optional security check)
    const supabase = await createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 404 }
      )
    }

    // Get latest version from R2
    const latestVersion = await r2ToolbarManager.getLatestVersion(channel)
    
    if (!latestVersion) {
      return NextResponse.json({
        hasUpdate: false,
        currentVersion
      })
    }

    // Check if update is needed
    const hasUpdate = compareVersions(latestVersion.version, currentVersion) > 0

    const response = {
      hasUpdate,
      currentVersion,
      latestVersion: hasUpdate ? latestVersion : undefined,
      forceUpdate: false // Could be dynamic based on version compatibility
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Toolbar update check failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get current available versions (for debugging)
    const allVersions = await r2ToolbarManager.getAvailableVersions()
    
    const versionsByChannel = allVersions.reduce((acc, version) => {
      if (!acc[version.channel]) {
        acc[version.channel] = []
      }
      acc[version.channel].push(version)
      return acc
    }, {} as Record<string, ToolbarVersion[]>)

    return NextResponse.json({
      channels: ['stable', 'beta', 'dev'],
      versions: versionsByChannel,
      total: allVersions.length
    })
  } catch (error) {
    console.error('Failed to get versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch versions' },
      { status: 500 }
    )
  }
} 