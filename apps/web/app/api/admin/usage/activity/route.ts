import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Use admin client with service role key - bypasses user authentication
    const supabase = createAdminClient()

    // Admin authentication is handled by middleware, so we can proceed directly

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "30")

    // Create  N 
    const dates = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push({
        date: date.toISOString().split("T")[0], // YYYY-MM-DD format
        fullDate: date.toISOString(),
        projects: 0,
        commits: 0,
        fileChanges: 0,
        activeUsers: 0,
      })
    }

    // Get  project
    const { data: projectActivity, error: projectError } = await supabase
      .from("projects")
      .select("created_at, updated_at, user_id")
      .gte("created_at", dates[0].fullDate)

    if (projectError) throw projectError

    // Get 
    const { data: commitActivity, error: commitError } = await supabase
      .from("commit_history")
      .select("created_at, project_id")
      .gte("created_at", dates[0].fullDate)

    if (commitError) throw commitError

    // Get 
    const { data: fileActivity, error: fileError } = await supabase
      .from("file_history")
      .select("created_at, project_id")
      .gte("created_at", dates[0].fullDate)

    if (fileError) throw fileError

    // Get project
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, user_id")

    if (projectsError) throw projectsError

    const projectUserMap = new Map()
    projects.forEach((p) => {
      projectUserMap.set(p.id, p.user_id)
    })

    const dailyStats = dates.map((dayData) => {
      const dayStart = new Date(dayData.date + "T00:00:00")
      const dayEnd = new Date(dayData.date + "T23:59:59")

      const projectsCreated = projectActivity.filter((p) => {
        if (!p.created_at) return false
        const createdAt = new Date(p.created_at)
        return createdAt >= dayStart && createdAt <= dayEnd
      }).length

      const commitsCount = commitActivity.filter((c) => {
        if (!c.created_at) return false
        const createdAt = new Date(c.created_at)
        return createdAt >= dayStart && createdAt <= dayEnd
      }).length

      const fileChangesCount = fileActivity.filter((f) => {
        if (!f.created_at) return false
        const createdAt = new Date(f.created_at)
        return createdAt >= dayStart && createdAt <= dayEnd
      }).length

      const activeUserIds = new Set()

      projectActivity.forEach((p) => {
        if (!p.created_at) return
        const createdAt = new Date(p.created_at)
        if (createdAt >= dayStart && createdAt <= dayEnd) {
          activeUserIds.add(p.user_id)
        }
      })

      commitActivity.forEach((c) => {
        if (!c.created_at) return
        const createdAt = new Date(c.created_at)
        if (createdAt >= dayStart && createdAt <= dayEnd) {
          const userId = projectUserMap.get(c.project_id)
          if (userId) {
            activeUserIds.add(userId)
          }
        }
      })

      fileActivity.forEach((f) => {
        if (!f.created_at) return
        const createdAt = new Date(f.created_at)
        if (createdAt >= dayStart && createdAt <= dayEnd) {
          const userId = projectUserMap.get(f.project_id)
          if (userId) {
            activeUserIds.add(userId)
          }
        }
      })

      return {
        date: dayData.date,
        projects: projectsCreated,
        commits: commitsCount,
        fileChanges: fileChangesCount,
        activeUsers: activeUserIds.size,
        // Add -
        displayDate: dayStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      }
    })

    const totalActivity = dailyStats.reduce(
      (acc, day) => ({
        projects: acc.projects + day.projects,
        commits: acc.commits + day.commits,
        fileChanges: acc.fileChanges + day.fileChanges,
        activeUsers: Math.max(acc.activeUsers, day.activeUsers), // Peak active users
      }),
      { projects: 0, commits: 0, fileChanges: 0, activeUsers: 0 },
    )

    const averageActivity = {
      projects: Math.round(totalActivity.projects / days),
      commits: Math.round(totalActivity.commits / days),
      fileChanges: Math.round(totalActivity.fileChanges / days),
      activeUsers: Math.round(dailyStats.reduce((sum, day) => sum + day.activeUsers, 0) / days),
    }

    return NextResponse.json({
      data: {
        dailyStats,
        totalActivity,
        averageActivity,
        period: {
          days,
          startDate: dates[0].date,
          endDate: dates[dates.length - 1].date,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching activity data:", error)
    return NextResponse.json({ error: "Failed to fetch activity data" }, { status: 500 })
  }
}
