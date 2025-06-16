import { NextRequest, NextResponse } from "next/server"
import { createAuthServerClient, ProjectQueries } from "@shipvibes/database"
import { cookies } from "next/headers"
import { githubAppService } from "@/lib/github-service"

async function getAuthenticatedUser(_request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createAuthServerClient({
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      } catch {
        // Игнорируем ошибки установки cookies
      }
    },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, supabase: null, error: "Unauthorized" }
  }

  return { user, supabase, error: null }
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем, что это dev environment (для безопасности)
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "This endpoint is only available in development environment" },
        { status: 403 },
      )
    }

    const { user, supabase, error } = await getAuthenticatedUser(request)
    if (error || !supabase) {
      return NextResponse.json({ error }, { status: 401 })
    }

    console.log("🔍 [CLEANUP] Starting orphaned repositories scan...")

    // Получаем все репозитории phion-project-* из GitHub
    const githubRepositories = await githubAppService.findOrphanedRepositories()

    // Получаем все проекты из базы данных
    const projectQueries = new ProjectQueries(supabase)
    const { data: dbProjects } = await supabase
      .from("projects")
      .select("id, github_repo_name, name, created_at")

    const dbRepoNames = new Set(
      dbProjects?.filter((p) => p.github_repo_name).map((p) => p.github_repo_name) || [],
    )

    // Находим осиротевшие репозитории (есть в GitHub, но нет в БД)
    const orphanedRepos = githubRepositories.filter((repo) => !dbRepoNames.has(repo.name))

    console.log(
      `🔍 [CLEANUP] Found ${orphanedRepos.length} orphaned repositories out of ${githubRepositories.length} total`,
    )

    const response = {
      success: true,
      totalGithubRepos: githubRepositories.length,
      totalDbProjects: dbProjects?.length || 0,
      orphanedRepos: orphanedRepos.map((repo) => ({
        name: repo.name,
        url: repo.html_url,
        created_at: repo.created_at,
        private: repo.private,
      })),
      orphanedCount: orphanedRepos.length,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("❌ [CLEANUP] Error scanning for orphaned repositories:", error)
    return NextResponse.json({ error: "Failed to scan for orphaned repositories" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Проверяем, что это dev environment (для безопасности)
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "This endpoint is only available in development environment" },
        { status: 403 },
      )
    }

    const { user, supabase, error } = await getAuthenticatedUser(request)
    if (error || !supabase) {
      return NextResponse.json({ error }, { status: 401 })
    }

    const body = await request.json()
    const { repoNames, confirmDeletion } = body

    if (!confirmDeletion) {
      return NextResponse.json(
        { error: "confirmDeletion must be true to proceed with deletion" },
        { status: 400 },
      )
    }

    if (!Array.isArray(repoNames) || repoNames.length === 0) {
      return NextResponse.json({ error: "repoNames array is required" }, { status: 400 })
    }

    console.log(`🗑️ [CLEANUP] Starting deletion of ${repoNames.length} orphaned repositories...`)

    let deletedCount = 0
    let errors: string[] = []

    for (const repoName of repoNames) {
      try {
        console.log(`🗑️ [CLEANUP] Deleting repository: ${repoName}`)
        await githubAppService.deleteRepository(repoName)
        console.log(`✅ [CLEANUP] Deleted repository: ${repoName}`)
        deletedCount++
      } catch (deleteError) {
        const errorMessage = `Failed to delete ${repoName}: ${deleteError instanceof Error ? deleteError.message : "Unknown error"}`
        console.error(`❌ [CLEANUP] ${errorMessage}`)
        errors.push(errorMessage)
      }
    }

    const response = {
      success: true,
      deletedCount,
      totalRequested: repoNames.length,
      message: `Successfully deleted ${deletedCount} out of ${repoNames.length} repositories`,
      errors: errors.length > 0 ? errors : undefined,
    }

    console.log(`🎉 [CLEANUP] Orphaned repositories cleanup completed:`, response)

    return NextResponse.json(response)
  } catch (error) {
    console.error("❌ [CLEANUP] Error deleting orphaned repositories:", error)
    return NextResponse.json({ error: "Failed to delete orphaned repositories" }, { status: 500 })
  }
}
