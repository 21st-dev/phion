import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@shipvibes/database"
import { CommitHistoryQueries, ProjectQueries, PendingChangesQueries } from "@shipvibes/database"

interface RevertRequest {
  targetCommitSha: string
  commitMessage?: string
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id
    const { targetCommitSha, commitMessage }: RevertRequest = await request.json()

    if (!projectId || !targetCommitSha) {
      return NextResponse.json(
        {
          error: "Project ID and target commit SHA are required",
        },
        { status: 400 },
      )
    }

    const supabase = getSupabaseServerClient()
    const commitQueries = new CommitHistoryQueries(supabase)
    const projectQueries = new ProjectQueries(supabase)
    const pendingQueries = new PendingChangesQueries(supabase)

    // Проверяем что коммит существует для этого проекта
    const targetCommit = await commitQueries.getCommitBySha(projectId, targetCommitSha)
    if (!targetCommit) {
      return NextResponse.json(
        {
          error: "Target commit not found",
        },
        { status: 404 },
      )
    }

    // Получаем данные проекта
    const project = await projectQueries.getProjectById(projectId)
    if (!project) {
      return NextResponse.json(
        {
          error: "Project not found",
        },
        { status: 404 },
      )
    }

    // Очищаем pending changes так как делаем полный откат
    await pendingQueries.clearAllPendingChanges(projectId)

    // Отправляем запрос на откат в WebSocket сервер
    const wsServerUrl = process.env.WEBSOCKET_SERVER_URL || "http://localhost:8080"

    const revertResponse = await fetch(`${wsServerUrl}/api/projects/revert-to-commit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        targetCommitSha,
        commitMessage: commitMessage || `Revert to ${targetCommitSha.substring(0, 7)}`,
        githubRepoName: project.github_repo_name,
        githubOwner: project.github_owner || "phion",
      }),
    })

    if (!revertResponse.ok) {
      const errorData = await revertResponse.json()
      throw new Error(errorData.error || "Failed to revert commit")
    }

    const revertData = await revertResponse.json()

    return NextResponse.json({
      success: true,
      message: "Revert operation initiated",
      targetCommit: {
        sha: targetCommit.github_commit_sha,
        message: targetCommit.commit_message,
        createdAt: targetCommit.created_at,
      },
      newCommitSha: revertData.newCommitSha,
    })
  } catch (error) {
    console.error("Error reverting to commit:", error)
    return NextResponse.json(
      {
        error: "Failed to revert to commit",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
