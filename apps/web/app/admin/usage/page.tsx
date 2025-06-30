"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  FolderOpen,
  GitCommit,
  Loader,
  RefreshCw,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react"
import { useEffect, useState } from "react"

interface UsageStats {
  users: {
    total: number
    activeLast7Days: number
    activeLast30Days: number
    dau: number
    mau: number
    dauMauData: Array<{
      date: string
      dau: number
      mau: number
    }>
  }
  projects: {
    total: number
    createdLast7Days: number
    deployStatus: Record<string, number>
  }
  activity: {
    totalCommits: number
    commitsLast7Days: number
  }
  retention: Array<{
    startDate: string
    cohortSize: number
    retentionRates: Array<{
      dayOffset: number
      retainedUsers: number
      retentionRate: number
    }>
  }>
  timestamp: string
}

interface UserActivity {
  userId: string
  projectsCount: number
  activeProjectsCount: number
  totalCommits: number
  recentCommits: number
  lastActivity: string | null
  deployStatusCounts: Record<string, number>
  projectNames: string[]
  joinedAt: string
  activityScore: number
  isActive: boolean
}

interface UserData {
  data: UserActivity[]
  meta: {
    total: number
    showing: number
    days: number
    cutoffDate: string
  }
}

export default function UsageDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [users, setUsers] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState("30")
  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => {
    fetchData()
  }, [timePeriod])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Параллельный запрос статистик и пользователей
      const [statsResponse, usersResponse] = await Promise.all([
        fetch(`/api/admin/usage/stats?days=${timePeriod}`),
        fetch(`/api/admin/usage/users?days=${timePeriod}&limit=50`),
      ])

      if (!statsResponse.ok || !usersResponse.ok) {
        throw new Error("Failed to fetch data")
      }

      const [statsData, usersData] = await Promise.all([statsResponse.json(), usersResponse.json()])

      setStats(statsData.data)
      setUsers(usersData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch dashboard data")
      showError("Failed to fetch data", "Please try refreshing the page")
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
    showSuccess("Dashboard refreshed", "Data has been updated")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatUserId = (userId: string) => {
    return userId.length > 8 ? `${userId.slice(0, 8)}...` : userId
  }

  const getDeployStatusBadge = (status: string, count: number) => {
    const statusConfig = {
      ready: {
        variant: "default" as const,
        icon: CheckCircle,
        className:
          "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-300",
      },
      building: {
        variant: "secondary" as const,
        icon: Loader,
        className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-300",
      },
      pending: {
        variant: "outline" as const,
        icon: Clock,
        className:
          "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300",
      },
      failed: {
        variant: "destructive" as const,
        icon: XCircle,
        className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-300",
      },
      cancelled: {
        variant: "secondary" as const,
        icon: AlertCircle,
        className: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900 dark:text-gray-300",
      },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: "outline" as const,
      icon: Clock,
      className: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900 dark:text-gray-300",
    }

    const Icon = config.icon

    return (
      <Badge key={status} variant={config.variant} className={`text-xs gap-1 ${config.className}`}>
        <Icon className="w-3 h-3" />
        {status} ({count})
      </Badge>
    )
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }, (_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchData} className="w-full" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Usage Dashboard</h1>
              <p className="text-muted-foreground">
                Monitor user activity and platform usage metrics
                {stats && (
                  <span className="text-sm text-muted-foreground ml-2">
                    Last updated: {formatDate(stats.timestamp)}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center space-x-4">
              <Select value={timePeriod} onValueChange={setTimePeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Overview Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Total Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.users.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.users.activeLast7Days} active last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <Activity className="w-4 h-4 mr-2" />
                    DAU
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.users.dau}</div>
                  <p className="text-xs text-muted-foreground">Daily Active Users</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    MAU
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.users.mau}</div>
                  <p className="text-xs text-muted-foreground">Monthly Active Users</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Total Projects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.projects.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.projects.createdLast7Days} created last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <GitCommit className="w-4 h-4 mr-2" />
                    Total Commits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.activity.totalCommits}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.activity.commitsLast7Days} last 7 days
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Deploy Status Overview */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Deploy Status Overview
                </CardTitle>
                <CardDescription>Current status of all projects in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.projects.deployStatus).map(([status, count]) =>
                    getDeployStatusBadge(status, count),
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* DAU/MAU Table */}
          {stats && stats.users.dauMauData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Daily & Monthly Active Users
                </CardTitle>
                <CardDescription>
                  Daily Active Users (DAU) and Monthly Active Users (MAU) based on commit activity
                  over the last {timePeriod} days. MAU shows unique users active in the 30 days
                  leading up to each date.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground">Date</TableHead>
                        <TableHead className="text-muted-foreground">DAU</TableHead>
                        <TableHead className="text-muted-foreground">MAU</TableHead>
                        <TableHead className="text-muted-foreground">DAU/MAU Ratio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.users.dauMauData.map((data) => (
                        <TableRow key={data.date} className="border-border hover:bg-muted/50">
                          <TableCell className="font-medium text-foreground">
                            {new Date(data.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            }) +
                              ", " +
                              new Date(data.date).toLocaleDateString("en-US", {
                                weekday: "short",
                              })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-foreground">{data.dau}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-foreground">
                              {data.mau > 0 ? data.mau : "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {data.mau > 0 && data.dau > 0
                                ? `${((data.dau / data.mau) * 100).toFixed(1)}%`
                                : "-"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 14-Day Retention Table */}
          {stats && stats.retention && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  14-Day User Retention
                </CardTitle>
                <CardDescription>
                  Cohort retention analysis showing what percentage of users who joined on each day
                  remained active (made commits) on subsequent days. Each row shows a cohort based
                  on their join date.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground min-w-[100px]">
                          Join Date
                        </TableHead>
                        <TableHead className="text-muted-foreground text-center">
                          Cohort Size
                        </TableHead>
                        {Array.from({ length: 14 }, (_, i) => (
                          <TableHead
                            key={i}
                            className="text-muted-foreground text-center min-w-[60px]"
                          >
                            Day {i}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.retention.map((cohort) => (
                        <TableRow
                          key={cohort.startDate}
                          className="border-border hover:bg-muted/50"
                        >
                          <TableCell className="font-medium text-foreground">
                            {new Date(cohort.startDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-center font-medium text-foreground">
                            {cohort.cohortSize}
                          </TableCell>
                          {cohort.retentionRates.map((rate) => (
                            <TableCell key={rate.dayOffset} className="text-center">
                              <div className="flex flex-col items-center space-y-1">
                                <span
                                  className={`text-sm font-medium ${
                                    rate.retentionRate > 50
                                      ? "text-green-600 dark:text-green-400"
                                      : rate.retentionRate > 20
                                        ? "text-yellow-600 dark:text-yellow-400"
                                        : rate.retentionRate > 0
                                          ? "text-orange-600 dark:text-orange-400"
                                          : "text-muted-foreground"
                                  }`}
                                >
                                  {rate.retentionRate.toFixed(1)}%
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {rate.retainedUsers}
                                </span>
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {stats.retention.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={16}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No retention data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p>
                    • Retention rates show the percentage of users from each cohort who were active
                    (made commits) on each day
                  </p>
                  <p>• Numbers below percentages show the actual count of retained users</p>
                  <p>• Day 0 represents the join date, Day 1 is the next day, etc.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Users Table */}
          {users && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Most Active Users
                </CardTitle>
                <CardDescription>
                  Top {users.meta.showing} users by activity score over the last {users.meta.days}{" "}
                  days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {users.data.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active users found for the selected time period
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">User ID</TableHead>
                          <TableHead className="text-muted-foreground">Projects</TableHead>
                          <TableHead className="text-muted-foreground">Commits</TableHead>
                          <TableHead className="text-muted-foreground">Activity Score</TableHead>
                          <TableHead className="text-muted-foreground">Last Activity</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.data.map((user) => (
                          <TableRow key={user.userId} className="border-border hover:bg-muted/50">
                            <TableCell className="font-mono text-sm text-foreground">
                              {formatUserId(user.userId)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">
                                  {user.projectsCount}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {user.activeProjectsCount} active
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">
                                  {user.totalCommits}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {user.recentCommits} recent
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-foreground">
                                  {user.activityScore}
                                </span>
                                <Progress
                                  value={Math.min(user.activityScore, 100)}
                                  className="w-16 h-2"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-foreground">
                              {user.lastActivity ? formatDate(user.lastActivity) : "Never"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.isActive ? "default" : "secondary"}>
                                {user.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
