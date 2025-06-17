import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@shipvibes/database"
import { CommitHistoryQueries } from "@shipvibes/database"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "10")
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()
    const commitQueries = new CommitHistoryQueries(supabase)

    // Получаем историю коммитов
    const commits = await commitQueries.getProjectCommitHistory(projectId, limit, offset)

    // Получаем дополнительную статистику
    const stats = await commitQueries.getCommitStats(projectId)

    return NextResponse.json({
      success: true,
      commits: commits.map((commit) => ({
        id: commit.id,
        sha: commit.github_commit_sha,
        message: commit.commit_message,
        url: commit.github_commit_url,
        filesCount: commit.files_count || 0,
        createdAt: commit.created_at,
        committedBy: commit.committed_by || "System",
      })),
      stats: {
        totalCommits: stats.total_commits,
        totalFilesChanged: stats.total_files_changed,
        firstCommit: stats.first_commit,
        lastCommit: stats.last_commit,
      },
      pagination: {
        limit,
        offset,
        hasMore: commits.length === limit,
      },
    })
  } catch (error) {
    console.error("Error fetching commit history:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch commit history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
