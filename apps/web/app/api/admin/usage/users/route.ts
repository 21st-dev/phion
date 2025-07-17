import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Use admin client with service role key - bypasses user authentication
    const supabase = createAdminClient()

    // Admin authentication is handled by middleware, so we can proceed directly

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "30")
    const limit = parseInt(searchParams.get("limit") || "50")

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Get all users with their projects
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

    // Bulk fetch all commit and file change data - MUCH faster than N+1 queries
    const [
      { data: totalCommitsData },
      { data: recentCommitsData },
      { data: totalFileChangesData },
      { data: recentFileChangesData },
    ] = await Promise.all([
      // All commits
      supabase.from("commit_history").select("project_id"),

      // Recent commits
      supabase
        .from("commit_history")
        .select("project_id")
        .gte("created_at", cutoffDate.toISOString()),

      // All file changes
      supabase.from("file_history").select("project_id"),

      // Recent file changes
      supabase
        .from("file_history")
        .select("project_id")
        .gte("created_at", cutoffDate.toISOString()),
    ])

    // Count commits and file changes per project
    const totalCommitsByProject = new Map()
    const recentCommitsByProject = new Map()
    const totalFileChangesByProject = new Map()
    const recentFileChangesByProject = new Map()

    // Count total commits per project
    totalCommitsData?.forEach((item) => {
      const count = totalCommitsByProject.get(item.project_id) || 0
      totalCommitsByProject.set(item.project_id, count + 1)
    })

    // Count recent commits per project
    recentCommitsData?.forEach((item) => {
      const count = recentCommitsByProject.get(item.project_id) || 0
      recentCommitsByProject.set(item.project_id, count + 1)
    })

    // Count total file changes per project
    totalFileChangesData?.forEach((item) => {
      const count = totalFileChangesByProject.get(item.project_id) || 0
      totalFileChangesByProject.set(item.project_id, count + 1)
    })

    // Count recent file changes per project
    recentFileChangesData?.forEach((item) => {
      const count = recentFileChangesByProject.get(item.project_id) || 0
      recentFileChangesByProject.set(item.project_id, count + 1)
    })

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

      // Add commit and file change counts for this project
      stats.totalCommits += totalCommitsByProject.get(project.id) || 0
      stats.recentCommits += recentCommitsByProject.get(project.id) || 0
      stats.totalFileChanges += totalFileChangesByProject.get(project.id) || 0
      stats.recentFileChanges += recentFileChangesByProject.get(project.id) || 0

      // Update join date (take earliest project)
      if (project.created_at && new Date(project.created_at) < new Date(stats.joinedAt)) {
        stats.joinedAt = project.created_at
      }

      // Update last activity
      if (
        project.updated_at &&
        (!stats.lastActivity || new Date(project.updated_at) > new Date(stats.lastActivity))
      ) {
        stats.lastActivity = project.updated_at
      }

      if (project.updated_at && new Date(project.updated_at) > cutoffDate) {
        stats.activeProjectsCount++
      }

      const status = project.deploy_status
      if (status) {
        stats.deployStatusCounts[status] = (stats.deployStatusCounts[status] || 0) + 1
      }
    }

    const users = Array.from(userStats.values())
      .map((stats) => ({
        ...stats,
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
