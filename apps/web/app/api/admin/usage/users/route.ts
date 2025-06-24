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

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "30")
    const limit = parseInt(searchParams.get("limit") || "50")

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Получаем всех пользователей с их проектами
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(
        `
        user_id,
        id,
        name,
        deploy_status,
        created_at,
        updated_at
      `,
      )
      .not("user_id", "is", null)
      .order("updated_at", { ascending: false })

    if (projectsError) throw projectsError

    // Группируем по пользователям
    const userStats = new Map()

    for (const project of projects) {
      const userId = project.user_id

      if (!userStats.has(userId)) {
        userStats.set(userId, {
          userId,
          projectsCount: 0,
          activeProjectsCount: 0,
          totalCommits: 0,
          recentCommits: 0,
          totalFileChanges: 0,
          recentFileChanges: 0,
          lastActivity: null,
          deployStatusCounts: {},
          projectNames: [],
          joinedAt: project.created_at,
        })
      }

      const stats = userStats.get(userId)
      stats.projectsCount++
      stats.projectNames.push(project.name)

      // Обновляем дату присоединения (берем самый ранний проект)
      if (new Date(project.created_at) < new Date(stats.joinedAt)) {
        stats.joinedAt = project.created_at
      }

      // Обновляем последнюю активность
      if (!stats.lastActivity || new Date(project.updated_at) > new Date(stats.lastActivity)) {
        stats.lastActivity = project.updated_at
      }

      // Считаем активные проекты (обновлялись недавно)
      if (new Date(project.updated_at) > cutoffDate) {
        stats.activeProjectsCount++
      }

      // Статистика по статусам деплоя
      const status = project.deploy_status
      stats.deployStatusCounts[status] = (stats.deployStatusCounts[status] || 0) + 1
    }

    // Получаем статистику по коммитам для каждого пользователя
    for (const [userId, stats] of Array.from(userStats.entries())) {
      // Получаем все проекты пользователя
      const userProjects = projects.filter((p) => p.user_id === userId)
      const projectIds = userProjects.map((p) => p.id)

      if (projectIds.length > 0) {
        // Общее количество коммитов
        const { count: totalCommits, error: totalCommitsError } = await supabase
          .from("commit_history")
          .select("*", { count: "exact", head: true })
          .in("project_id", projectIds)

        if (!totalCommitsError) {
          stats.totalCommits = totalCommits || 0
        }

        // Коммиты за период
        const { count: recentCommits, error: recentCommitsError } = await supabase
          .from("commit_history")
          .select("*", { count: "exact", head: true })
          .in("project_id", projectIds)
          .gte("created_at", cutoffDate.toISOString())

        if (!recentCommitsError) {
          stats.recentCommits = recentCommits || 0
        }

        // Общее количество изменений файлов
        const { count: totalFileChanges, error: totalFileChangesError } = await supabase
          .from("file_history")
          .select("*", { count: "exact", head: true })
          .in("project_id", projectIds)

        if (!totalFileChangesError) {
          stats.totalFileChanges = totalFileChanges || 0
        }

        // Изменения файлов за период
        const { count: recentFileChanges, error: recentFileChangesError } = await supabase
          .from("file_history")
          .select("*", { count: "exact", head: true })
          .in("project_id", projectIds)
          .gte("created_at", cutoffDate.toISOString())

        if (!recentFileChangesError) {
          stats.recentFileChanges = recentFileChanges || 0
        }
      }
    }

    // Конвертируем в массив и сортируем по активности
    const users = Array.from(userStats.values())
      .map((stats) => ({
        ...stats,
        // Вычисляем общий показатель активности
        activityScore:
          stats.recentCommits * 2 + stats.recentFileChanges * 1 + stats.activeProjectsCount * 3,
        isActive: stats.lastActivity ? new Date(stats.lastActivity) > cutoffDate : false,
      }))
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, limit)

    return NextResponse.json({
      data: users,
      meta: {
        total: userStats.size,
        showing: users.length,
        days,
        cutoffDate: cutoffDate.toISOString(),
      },
    })
  } catch (error) {
    console.error("Error fetching user stats:", error)
    return NextResponse.json({ error: "Failed to fetch user statistics" }, { status: 500 })
  }
}
