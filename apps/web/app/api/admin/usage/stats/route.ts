import { NextRequest, NextResponse } from "next/server"
import { createAuthServerClient } from "@shipvibes/database"
import { cookies } from "next/headers"

const ADMIN_USER_ID = "28a1b02f-d1a1-4ca4-968f-ab186dcb59e0"

export async function GET(request: NextRequest) {
  try {
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
    } = await supabase.auth.getUser()

    if (!user || user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Получаем общие статистики
    const now = new Date()
    const last7Days = new Date()
    last7Days.setDate(now.getDate() - 7)
    const last30Days = new Date()
    last30Days.setDate(now.getDate() - 30)

    // Общее количество пользователей с проектами
    const { data: totalUsers, error: totalUsersError } = await supabase
      .from("projects")
      .select("user_id")
      .not("user_id", "is", null)

    if (totalUsersError) throw totalUsersError

    const uniqueUsers = Array.from(new Set(totalUsers.map((p) => p.user_id))).length

    // Активные пользователи за последние 7 дней (создали проект или коммитили)
    const { data: activeUsers7d, error: activeUsers7dError } = await supabase
      .from("projects")
      .select("user_id")
      .gte("updated_at", last7Days.toISOString())
      .not("user_id", "is", null)

    if (activeUsers7dError) throw activeUsers7dError

    const activeUsersLast7Days = Array.from(new Set(activeUsers7d.map((p) => p.user_id))).length

    // Активные пользователи за последние 30 дней
    const { data: activeUsers30d, error: activeUsers30dError } = await supabase
      .from("projects")
      .select("user_id")
      .gte("updated_at", last30Days.toISOString())
      .not("user_id", "is", null)

    if (activeUsers30dError) throw activeUsers30dError

    const activeUsersLast30Days = Array.from(new Set(activeUsers30d.map((p) => p.user_id))).length

    // Общее количество проектов
    const { count: totalProjects, error: totalProjectsError } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })

    if (totalProjectsError) throw totalProjectsError

    // Проекты созданные за последние 7 дней
    const { count: projectsLast7Days, error: projects7dError } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last7Days.toISOString())

    if (projects7dError) throw projects7dError

    // Общее количество коммитов
    const { count: totalCommits, error: totalCommitsError } = await supabase
      .from("commit_history")
      .select("*", { count: "exact", head: true })

    if (totalCommitsError) throw totalCommitsError

    // Коммиты за последние 7 дней
    const { count: commitsLast7Days, error: commits7dError } = await supabase
      .from("commit_history")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last7Days.toISOString())

    if (commits7dError) throw commits7dError

    // Общее количество изменений файлов
    const { count: totalFileChanges, error: totalFileChangesError } = await supabase
      .from("file_history")
      .select("*", { count: "exact", head: true })

    if (totalFileChangesError) throw totalFileChangesError

    // Статистика по статусам деплоя
    const { data: deployStats, error: deployStatsError } = await supabase
      .from("projects")
      .select("deploy_status")

    if (deployStatsError) throw deployStatsError

    const deployStatusCounts = deployStats.reduce(
      (acc, project) => {
        acc[project.deploy_status] = (acc[project.deploy_status] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const stats = {
      users: {
        total: uniqueUsers,
        activeLast7Days: activeUsersLast7Days,
        activeLast30Days: activeUsersLast30Days,
      },
      projects: {
        total: totalProjects || 0,
        createdLast7Days: projectsLast7Days || 0,
        deployStatus: deployStatusCounts,
      },
      activity: {
        totalCommits: totalCommits || 0,
        commitsLast7Days: commitsLast7Days || 0,
        totalFileChanges: totalFileChanges || 0,
      },
      timestamp: now.toISOString(),
    }

    return NextResponse.json({ data: stats })
  } catch (error) {
    console.error("Error fetching usage stats:", error)
    return NextResponse.json({ error: "Failed to fetch usage statistics" }, { status: 500 })
  }
}
