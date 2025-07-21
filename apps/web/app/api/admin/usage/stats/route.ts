import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Use admin client with service role key - bypasses user authentication
    const supabase = createAdminClient()

    // Admin authentication is handled by middleware, so we can proceed directly

    // Get the days parameter from the request
    const { searchParams } = new URL(request.url)
    const daysParam = parseInt(searchParams.get("days") || "30")

    // Get general statistics (using UTC consistently)
    const now = new Date()
    const last7Days = new Date()
    last7Days.setUTCDate(now.getUTCDate() - 7)
    const last30Days = new Date()
    last30Days.setUTCDate(now.getUTCDate() - 30)

    // Today's date for DAU (using UTC)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    const { data: totalUsers, error: totalUsersError } = await supabase
      .from("projects")
      .select("user_id")
      .not("user_id", "is", null)

    if (totalUsersError) throw totalUsersError

    const uniqueUsers = Array.from(new Set(totalUsers.map((p) => p.user_id))).length

    const { data: activeUsers7d, error: activeUsers7dError } = await supabase
      .from("projects")
      .select("user_id")
      .gte("updated_at", last7Days.toISOString())
      .not("user_id", "is", null)

    if (activeUsers7dError) throw activeUsers7dError

    const activeUsersLast7Days = Array.from(new Set(activeUsers7d.map((p) => p.user_id))).length

    const { data: activeUsers30d, error: activeUsers30dError } = await supabase
      .from("projects")
      .select("user_id")
      .gte("updated_at", last30Days.toISOString())
      .not("user_id", "is", null)

    if (activeUsers30dError) throw activeUsers30dError

    const activeUsersLast30Days = Array.from(new Set(activeUsers30d.map((p) => p.user_id))).length

    // Calculate how many days of data we need to fetch
    // We need daysParam days of DAU/MAU data, and each MAU needs 30 days of history
    const totalDaysNeeded = daysParam + 30 // daysParam + 30 additional days for the earliest MAU calculation

    const dataStartDate = new Date()
    dataStartDate.setUTCDate(dataStartDate.getUTCDate() - totalDaysNeeded)
    dataStartDate.setUTCHours(0, 0, 0, 0)

    const { data: allCommits, error: allCommitsError } = await supabase
      .from("commit_history")
      .select(
        `
        created_at,
        project_id,
        projects!inner(user_id)
      `,
      )
      .gte("created_at", dataStartDate.toISOString())

    if (allCommitsError) throw allCommitsError

    // Generate DAU/MAU data for the selected period (using UTC consistently)
    const dauMauData = []
    for (let i = 0; i < daysParam; i++) {
      const date = new Date()
      date.setUTCDate(date.getUTCDate() - i)
      date.setUTCHours(0, 0, 0, 0)

      const nextDay = new Date(date)
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)

      // Calculate 30 days before this date for MAU (including the current date)
      const mauStartDate = new Date(date)
      mauStartDate.setUTCDate(mauStartDate.getUTCDate() - 29) // 29 days back + current day = 30 days total

      // Filter commits for DAU (this specific day)
      const dayCommits =
        allCommits?.filter((commit) => {
          if (!commit.created_at) return false
          const commitDate = new Date(commit.created_at)
          return commitDate >= date && commitDate < nextDay
        }) || []

      const dayActiveUsers = Array.from(
        new Set(
          dayCommits
            .filter((commit) => commit.projects?.user_id)
            .map((commit) => commit.projects.user_id),
        ),
      ).length

      // Filter commits for MAU (30 days leading up to this date)
      const mauCommits =
        allCommits?.filter((commit) => {
          if (!commit.created_at) return false
          const commitDate = new Date(commit.created_at)
          return commitDate >= mauStartDate && commitDate < nextDay
        }) || []

      const mauActiveUsers = Array.from(
        new Set(
          mauCommits
            .filter((commit) => commit.projects?.user_id)
            .map((commit) => commit.projects.user_id),
        ),
      ).length

      dauMauData.push({
        date: date.toISOString().split("T")[0],
        dau: dayActiveUsers,
        mau: mauActiveUsers,
      })
    }

    // Today's DAU and MAU for the summary cards (first element since we reversed the order)
    const todayDAU = dauMauData[0]?.dau || 0
    const todayMAU = dauMauData[0]?.mau || 0

    const { count: totalProjects, error: totalProjectsError } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })

    if (totalProjectsError) throw totalProjectsError

    const { count: projectsLast7Days, error: projects7dError } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last7Days.toISOString())

    if (projects7dError) throw projects7dError

    const { count: totalCommits, error: totalCommitsError } = await supabase
      .from("commit_history")
      .select("*", { count: "exact", head: true })

    if (totalCommitsError) throw totalCommitsError

    const { count: commitsLast7Days, error: commits7dError } = await supabase
      .from("commit_history")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last7Days.toISOString())

    if (commits7dError) throw commits7dError

    const { count: totalFileChanges, error: totalFileChangesError } = await supabase
      .from("file_history")
      .select("*", { count: "exact", head: true })

    if (totalFileChangesError) throw totalFileChangesError

    const { data: deployStats, error: deployStatsError } = await supabase
      .from("projects")
      .select("deploy_status")

    if (deployStatsError) throw deployStatsError

    const deployStatusCounts = deployStats.reduce(
      (acc, project) => {
        if (project.deploy_status !== null && project.deploy_status !== undefined) {
          acc[project.deploy_status] = (acc[project.deploy_status] || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>,
    )

    // Calculate 14-day retention data efficiently
    const retentionDays = 14

    // Calculate the date range we need (using UTC to match database)
    const retentionStartDate = new Date()
    retentionStartDate.setUTCDate(retentionStartDate.getUTCDate() - retentionDays + 1)
    retentionStartDate.setUTCHours(0, 0, 0, 0)

    const retentionEndDate = new Date()
    retentionEndDate.setUTCDate(retentionEndDate.getUTCDate() + retentionDays)
    retentionEndDate.setUTCHours(0, 0, 0, 0)

    // Get all users who registered in the retention period from auth.users with pagination
    let allUsers: any[] = []
    let page = 1
    const perPage = 1000

    while (true) {
      const { data: usersPage, error: usersPageError } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      })

      if (usersPageError) throw usersPageError

      allUsers = allUsers.concat(usersPage.users)

      // If we got fewer users than perPage, we've reached the end
      if (usersPage.users.length < perPage) {
        break
      }

      page++
    }

    // Filter users by date range manually since the admin API doesn't support date filtering
    // Database timestamps are in UTC, so this comparison is consistent
    const filteredUsers = allUsers.filter((user) => {
      const createdAt = new Date(user.created_at) // This is already UTC from the DB
      return createdAt >= retentionStartDate
    })

    // Get all commits for the retention period
    const { data: retentionCommits, error: retentionCommitsError } = await supabase
      .from("commit_history")
      .select(
        `
        created_at,
        project_id,
        projects!inner(user_id)
      `,
      )
      .gte("created_at", retentionStartDate.toISOString())
      .lt("created_at", retentionEndDate.toISOString())

    if (retentionCommitsError) throw retentionCommitsError

    // Process data in memory for efficiency
    // Map user registration dates
    const userJoinDates = new Map<string, Date>()
    for (const user of filteredUsers) {
      if (user.id && user.created_at) {
        const joinDate = new Date(user.created_at)
        userJoinDates.set(user.id, joinDate)
      }
    }

    // Group commits by user and date (using UTC dates consistently)
    const userCommitsByDate = new Map<string, Set<string>>()
    for (const commit of retentionCommits) {
      if (commit.projects?.user_id && commit.created_at) {
        const userId = commit.projects.user_id
        // Since DB timestamps are in UTC, this gives us the correct UTC date
        const commitDate = new Date(commit.created_at).toISOString().split("T")[0]

        if (!userCommitsByDate.has(userId)) {
          userCommitsByDate.set(userId, new Set())
        }
        userCommitsByDate.get(userId)!.add(commitDate)
      }
    }

    // Calculate retention for each cohort (using UTC consistently)
    const retentionData = []
    for (let startDayOffset = 0; startDayOffset < retentionDays; startDayOffset++) {
      const startDate = new Date()
      startDate.setUTCDate(startDate.getUTCDate() - startDayOffset)
      startDate.setUTCHours(0, 0, 0, 0)

      const nextDay = new Date(startDate)
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)

      // Find users who joined on this specific day
      const cohortUsers = Array.from(userJoinDates.entries())
        .filter(([userId, joinDate]) => {
          return joinDate >= startDate && joinDate < nextDay
        })
        .map(([userId]) => userId)

      const cohortSize = cohortUsers.length

      // Calculate retention for each day offset
      const retentionRates = []
      for (let dayOffset = 0; dayOffset < retentionDays; dayOffset++) {
        const checkDate = new Date(startDate)
        checkDate.setUTCDate(checkDate.getUTCDate() + dayOffset)
        const checkDateStr = checkDate.toISOString().split("T")[0]

        if (cohortSize === 0) {
          retentionRates.push({
            dayOffset,
            retainedUsers: 0,
            retentionRate: 0,
          })
          continue
        }

        // Count how many cohort users were active on this day
        const retainedUsers = cohortUsers.filter((userId) =>
          userCommitsByDate.get(userId)?.has(checkDateStr),
        ).length

        const retentionRate = cohortSize > 0 ? (retainedUsers / cohortSize) * 100 : 0

        retentionRates.push({
          dayOffset,
          retainedUsers,
          retentionRate: Math.round(retentionRate * 100) / 100, // Round to 2 decimal places
        })
      }

      retentionData.push({
        startDate: startDate.toISOString().split("T")[0],
        cohortSize,
        retentionRates,
      })
    }

    const stats = {
      users: {
        total: uniqueUsers,
        activeLast7Days: activeUsersLast7Days,
        activeLast30Days: activeUsersLast30Days,
        dau: todayDAU,
        mau: todayMAU,
        dauMauData: dauMauData, // Show selected period for the table
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
      retention: retentionData,
      timestamp: now.toISOString(),
    }

    return NextResponse.json({ data: stats })
  } catch (error) {
    console.error("Error fetching usage stats:", error)
    return NextResponse.json({ error: "Failed to fetch usage statistics" }, { status: 500 })
  }
}
