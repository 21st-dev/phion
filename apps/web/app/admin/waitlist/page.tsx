"use client"

import { useState, useEffect } from "react"
import { createAuthBrowserClient } from "@shipvibes/database"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/geist/spinner"
import {
  Eye,
  Calendar,
  Mail,
  Phone,
  PhoneOff,
  Check,
  X,
  Clock,
  Brain,
  RefreshCw,
  Zap,
  GitBranch,
  Server,
  MessageCircle,
  ArrowUpDown,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface WaitlistEntry {
  id: string
  email: string
  name: string
  coding_experience: string
  frustrations: string
  dream_project: string
  accepts_call: boolean | null
  status: string
  approved_at: string | null
  approved_by: string | null
  created_at: string
  ai_analysis_score: number | null
  ai_analysis_summary: string | null
  ai_analysis_reasoning: string | null
  ai_deployment_issues: boolean | null
  ai_versioning_issues: boolean | null
  ai_openness_score: number | null
  ai_analyzed_at: string | null
  ai_needs_reanalysis: boolean | null
  ai_experience_level: string | null
  ai_uses_cursor: boolean | null
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [analyzingEntry, setAnalyzingEntry] = useState<string | null>(null)
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false)
  const [sortBy, setSortBy] = useState<"score" | "created" | "status">("score")
  const [filterBy, setFilterBy] = useState<"all" | "analyzed" | "unanalyzed" | "high-score">("all")
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const supabase = createAuthBrowserClient()
  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => {
    fetchWaitlistEntries()

    // Автообновление каждые 30 секунд
    const interval = setInterval(fetchWaitlistEntries, 30000)
    return () => clearInterval(interval)
  }, [])

  const analyzeEntry = async (entryId: string) => {
    setAnalyzingEntry(entryId)
    try {
      const response = await fetch("/api/admin/waitlist/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to analyze entry")
      }

      // Обновляем локальное состояние
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                ai_analysis_score: result.analysis.score,
                ai_analysis_summary: result.analysis.summary,
                ai_analysis_reasoning: result.analysis.reasoning,
                ai_deployment_issues: result.analysis.deploymentIssues,
                ai_versioning_issues: result.analysis.versioningIssues,
                ai_openness_score: result.analysis.opennessScore,
                ai_experience_level: result.analysis.experienceLevel,
                ai_uses_cursor: result.analysis.usesCursor,
                ai_analyzed_at: new Date().toISOString(),
                ai_needs_reanalysis: false,
              }
            : entry,
        ),
      )

      showSuccess("Analysis completed", `AI score: ${result.analysis.score}/100`)
    } catch (err) {
      showError("Analysis failed", err instanceof Error ? err.message : "Please try again")
    } finally {
      setAnalyzingEntry(null)
    }
  }

  const bulkAnalyze = async () => {
    setBulkAnalyzing(true)
    try {
      const response = await fetch("/api/admin/waitlist/analyze", {
        method: "PUT",
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to perform bulk analysis")
      }

      showSuccess("Bulk analysis completed", `Processed ${result.processed} entries`)

      // Обновляем данные
      await fetchWaitlistEntries()
    } catch (err) {
      showError("Bulk analysis failed", err instanceof Error ? err.message : "Please try again")
    } finally {
      setBulkAnalyzing(false)
    }
  }

  const fetchWaitlistEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .order("ai_analysis_score", { ascending: false, nullsFirst: false })

      if (error) {
        throw error
      }

      setEntries((data as unknown as WaitlistEntry[]) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch waitlist entries")
    } finally {
      setLoading(false)
    }
  }

  const sendApprovalEmail = async (entryId: string) => {
    setSendingEmail(entryId)
    try {
      const response = await fetch(`/api/admin/waitlist/${entryId}/send-approval`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to send email")
      }

      showSuccess(
        "Email sent successfully!",
        result.mockMode
          ? `Test email sent to ${result.message.split(" to ")[1]} (mock mode)`
          : result.message,
      )

      return true
    } catch (err) {
      showError("Failed to send email", err instanceof Error ? err.message : "Please try again")
      return false
    } finally {
      setSendingEmail(null)
    }
  }

  const updateStatus = async (entryId: string, newStatus: "approved" | "rejected") => {
    setUpdatingStatus(entryId)
    try {
      const response = await fetch(`/api/admin/waitlist/${entryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update status")
      }

      // Update local state with the returned data
      setEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? { ...entry, ...result.data } : entry)),
      )

      showSuccess(
        "Status updated",
        `Entry has been ${newStatus === "approved" ? "approved" : "rejected"}`,
      )

      // Update dialog if it's open for this entry
      if (selectedEntry?.id === entryId) {
        setSelectedEntry((prev) => (prev ? { ...prev, ...result.data } : null))
      }

      // Автоматически отправляем email при аппруве
      if (newStatus === "approved") {
        setTimeout(() => {
          sendApprovalEmail(entryId)
        }, 1000) // Небольшая задержка чтобы пользователь увидел успешное обновление статуса
      }
    } catch (err) {
      showError("Failed to update status", err instanceof Error ? err.message : "Please try again")
    } finally {
      setUpdatingStatus(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
            <Check className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-300">
            <X className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        )
      case "pending":
      default:
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
    }
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

  // Фильтрация и сортировка
  const filteredAndSortedEntries = entries
    .filter((entry) => {
      switch (filterBy) {
        case "analyzed":
          return entry.ai_analyzed_at !== null
        case "unanalyzed":
          return entry.ai_analyzed_at === null
        case "high-score":
          return (entry.ai_analysis_score || 0) >= 70
        default:
          return true
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "score":
          return (b.ai_analysis_score || 0) - (a.ai_analysis_score || 0)
        case "created":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "status":
          return a.status.localeCompare(b.status)
        default:
          return 0
      }
    })

  const stats = {
    total: entries.length,
    pending: entries.filter((e) => e.status === "pending").length,
    approved: entries.filter((e) => e.status === "approved").length,
    rejected: entries.filter((e) => e.status === "rejected").length,
    acceptsCall: entries.filter((e) => e.accepts_call).length,
    analyzed: entries.filter((e) => e.ai_analyzed_at).length,
    unanalyzed: entries.filter((e) => !e.ai_analyzed_at).length,
    highScore: entries.filter((e) => (e.ai_analysis_score || 0) >= 70).length,
    avgScore:
      entries.length > 0
        ? Math.round(
            entries.reduce((sum, e) => sum + (e.ai_analysis_score || 0), 0) / entries.length,
          )
        : 0,
    deploymentIssues: entries.filter((e) => e.ai_deployment_issues).length,
    versioningIssues: entries.filter((e) => e.ai_versioning_issues).length,
    thisWeek: entries.filter((entry) => {
      const entryDate = new Date(entry.created_at)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return entryDate > weekAgo
    }).length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-100 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-center">
          <Spinner size={32} />
          <p className="mt-4 text-sm text-muted-foreground">Loading waitlist entries...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={fetchWaitlistEntries} className="mt-4" variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-1000">Waitlist Management</h1>
            <p className="text-gray-700">
              Manage early access applications for Phion. Total entries: {stats.total}
            </p>
          </div>

          {/* AI Analysis Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2">
              <Button
                onClick={bulkAnalyze}
                disabled={bulkAnalyzing || stats.unanalyzed === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {bulkAnalyzing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Brain className="w-4 h-4 mr-2" />
                )}
                Analyze All ({stats.unanalyzed})
              </Button>

              <Button onClick={fetchWaitlistEntries} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">AI Score</SelectItem>
                  <SelectItem value="created">Date Created</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entries</SelectItem>
                  <SelectItem value="analyzed">Analyzed</SelectItem>
                  <SelectItem value="unanalyzed">Unanalyzed</SelectItem>
                  <SelectItem value="high-score">High Score (70+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Average AI Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.avgScore}/100</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <Server className="w-4 h-4 mr-1" />
                  Deploy Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.deploymentIssues}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <GitBranch className="w-4 h-4 mr-1" />
                  Version Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.versioningIssues}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  High Score (70+)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.highScore}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Analyzed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.analyzed}/{stats.total}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Waitlist Table */}
          <Card>
            <CardHeader>
              <CardTitle>Waitlist Entries</CardTitle>
              <CardDescription>
                Showing {filteredAndSortedEntries.length} of {entries.length} entries. Click on any
                entry to view detailed information and manage approval status.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAndSortedEntries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {entries.length === 0
                      ? "No waitlist entries yet."
                      : "No entries match the current filter."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b bg-muted/30">
                        <TableHead className="font-semibold py-4">Name & Email</TableHead>
                        <TableHead className="font-semibold py-4 min-w-[150px]">
                          <div className="flex items-center gap-1">
                            <Brain className="w-4 h-4" />
                            AI Analysis
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold py-4 min-w-[180px]">
                          Experience
                        </TableHead>
                        <TableHead className="font-semibold py-4">Key Issues</TableHead>
                        <TableHead className="font-semibold py-4">Status & Actions</TableHead>
                        <TableHead className="font-semibold py-4">Applied</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedEntries.map((entry) => (
                        <TableRow key={entry.id} className="hover:bg-muted/50 transition-colors">
                          {/* Name & Email Column */}
                          <TableCell className="py-4">
                            <div className="space-y-1">
                              <div className="font-semibold text-base">{entry.name}</div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="w-4 h-4" />
                                {entry.email}
                              </div>
                            </div>
                          </TableCell>

                          {/* AI Analysis Column */}
                          <TableCell className="py-4">
                            {entry.ai_analysis_score !== null ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="text-xl font-bold text-purple-700">
                                    {entry.ai_analysis_score}
                                  </div>
                                  <div className="flex-1 max-w-[80px]">
                                    <Progress value={entry.ai_analysis_score} className="h-2" />
                                  </div>
                                </div>
                                <div>
                                  {entry.ai_analysis_score >= 80 && (
                                    <Badge className="bg-green-100 text-green-800 border-green-300 text-xs font-medium">
                                      🎯 High Fit
                                    </Badge>
                                  )}
                                  {entry.ai_analysis_score >= 50 &&
                                    entry.ai_analysis_score < 80 && (
                                      <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs font-medium">
                                        📊 Medium Fit
                                      </Badge>
                                    )}
                                  {entry.ai_analysis_score < 50 && (
                                    <Badge className="bg-red-100 text-red-700 border-red-300 text-xs font-medium">
                                      📉 Low Fit
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Badge variant="outline" className="text-xs">
                                  🤖 Not analyzed
                                </Badge>
                                <div className="text-xs text-muted-foreground">
                                  Click analyze to get AI score
                                </div>
                              </div>
                            )}
                          </TableCell>

                          {/* Experience Column */}
                          <TableCell className="py-4">
                            <div className="space-y-2">
                              {/* AI Experience Level & Cursor */}
                              {entry.ai_experience_level && (
                                <div className="flex flex-wrap gap-1">
                                  <Badge
                                    className={`text-xs font-medium ${
                                      entry.ai_experience_level === "beginner"
                                        ? "bg-green-100 text-green-800 border-green-300"
                                        : entry.ai_experience_level === "intermediate"
                                          ? "bg-blue-100 text-blue-800 border-blue-300"
                                          : "bg-gray-100 text-gray-800 border-gray-300"
                                    }`}
                                  >
                                    {entry.ai_experience_level === "beginner" && "🌱"}
                                    {entry.ai_experience_level === "intermediate" && "⚡"}
                                    {entry.ai_experience_level === "senior" && "🎯"}{" "}
                                    {entry.ai_experience_level}
                                  </Badge>
                                  {entry.ai_uses_cursor && (
                                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs font-medium">
                                      🖱️ Cursor
                                    </Badge>
                                  )}
                                </div>
                              )}

                              {/* Tools & Experience Text */}
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground font-medium">
                                  Tools & Background:
                                </div>
                                <div className="text-sm line-clamp-2 leading-relaxed text-gray-700">
                                  {entry.coding_experience}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Key Issues Column */}
                          <TableCell className="py-4">
                            <div className="flex flex-wrap gap-1">
                              {entry.ai_deployment_issues && (
                                <Badge className="bg-red-100 text-red-800 text-xs">
                                  <Server className="w-3 h-3 mr-1" />
                                  Deploy
                                </Badge>
                              )}
                              {entry.ai_versioning_issues && (
                                <Badge className="bg-orange-100 text-orange-800 text-xs">
                                  <GitBranch className="w-3 h-3 mr-1" />
                                  Git
                                </Badge>
                              )}
                              {entry.accepts_call && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs">
                                  <Phone className="w-3 h-3 mr-1" />
                                  Call OK
                                </Badge>
                              )}
                              {!entry.ai_deployment_issues &&
                                !entry.ai_versioning_issues &&
                                !entry.accepts_call && (
                                  <span className="text-xs text-muted-foreground">
                                    No issues found
                                  </span>
                                )}
                            </div>
                          </TableCell>

                          {/* Status & Actions Column */}
                          <TableCell className="py-4">
                            <div className="space-y-3">
                              <div>{getStatusBadge(entry.status)}</div>
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedEntry(entry)}
                                  className="h-8 px-2 text-xs"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>

                                {!entry.ai_analyzed_at && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => analyzeEntry(entry.id)}
                                    disabled={analyzingEntry === entry.id}
                                    className="h-8 px-2 text-xs bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                                  >
                                    {analyzingEntry === entry.id ? (
                                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <Brain className="w-3 h-3 mr-1" />
                                    )}
                                    Analyze
                                  </Button>
                                )}

                                {entry.status === "approved" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => sendApprovalEmail(entry.id)}
                                    disabled={sendingEmail === entry.id}
                                    className="h-8 px-2 text-xs bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                                  >
                                    {sendingEmail === entry.id ? (
                                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <Mail className="w-3 h-3 mr-1" />
                                    )}
                                    Send Email
                                  </Button>
                                )}

                                {entry.status === "pending" && (
                                  <>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-8 px-2 text-xs bg-green-600 hover:bg-green-700"
                                      onClick={() => updateStatus(entry.id, "approved")}
                                      disabled={updatingStatus === entry.id}
                                    >
                                      <Check className="w-3 h-3 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-xs border-red-300 text-red-700 hover:bg-red-50"
                                      onClick={() => updateStatus(entry.id, "rejected")}
                                      disabled={updatingStatus === entry.id}
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      Reject
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Applied Column */}
                          <TableCell className="py-4">
                            <div className="text-sm text-muted-foreground">
                              <div className="flex items-center gap-1 mb-1">
                                <Calendar className="w-3 h-3" />
                                <span className="text-xs">Applied</span>
                              </div>
                              <div className="text-xs">{formatDate(entry.created_at)}</div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Waitlist Application Details</DialogTitle>
            <DialogDescription>
              {selectedEntry &&
                `Application from ${selectedEntry.name} submitted on ${formatDate(
                  selectedEntry.created_at,
                )}`}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Name</h4>
                  <p className="mt-1">{selectedEntry.name}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Email</h4>
                  <p className="mt-1">{selectedEntry.email}</p>
                </div>
              </div>

              {/* AI Analysis Section */}
              {selectedEntry.ai_analyzed_at && (
                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-purple-800">
                      <Brain className="w-5 h-5" />
                      AI Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl font-bold text-purple-700">
                          {selectedEntry.ai_analysis_score}/100
                        </div>
                        <div className="w-32">
                          <Progress value={selectedEntry.ai_analysis_score || 0} className="h-3" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {selectedEntry.ai_deployment_issues && (
                          <Badge className="bg-red-100 text-red-800">
                            <Server className="w-3 h-3 mr-1" />
                            Deploy Issues
                          </Badge>
                        )}
                        {selectedEntry.ai_versioning_issues && (
                          <Badge className="bg-orange-100 text-orange-800">
                            <GitBranch className="w-3 h-3 mr-1" />
                            Version Issues
                          </Badge>
                        )}
                      </div>
                    </div>

                    {selectedEntry.ai_analysis_summary && (
                      <div>
                        <h5 className="font-medium text-sm text-muted-foreground mb-2">Summary</h5>
                        <p className="text-sm">{selectedEntry.ai_analysis_summary}</p>
                      </div>
                    )}

                    {selectedEntry.ai_analysis_reasoning && (
                      <div>
                        <h5 className="font-medium text-sm text-muted-foreground mb-2">
                          Reasoning
                        </h5>
                        <p className="text-sm leading-relaxed">
                          {selectedEntry.ai_analysis_reasoning}
                        </p>
                      </div>
                    )}

                    {selectedEntry.ai_openness_score !== null && (
                      <div>
                        <h5 className="font-medium text-sm text-muted-foreground mb-2">
                          Openness Score
                        </h5>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-sm">{selectedEntry.ai_openness_score}/10</span>
                          <Progress
                            value={(selectedEntry.ai_openness_score / 10) * 100}
                            className="h-2 w-20"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                  <div className="mt-1">{getStatusBadge(selectedEntry.status)}</div>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Onboarding Call</h4>
                  <Badge
                    variant={selectedEntry.accepts_call ? "default" : "secondary"}
                    className="mt-1"
                  >
                    {selectedEntry.accepts_call ? (
                      <>
                        <Phone className="w-3 h-3 mr-1" /> Willing to schedule
                      </>
                    ) : (
                      <>
                        <PhoneOff className="w-3 h-3 mr-1" /> Prefers no call
                      </>
                    )}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Coding Experience</h4>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedEntry.coding_experience}
                </p>
              </div>

              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Current Frustrations</h4>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedEntry.frustrations}
                </p>
              </div>

              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Dream Project</h4>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedEntry.dream_project}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-left">
                  <h4 className="font-medium text-sm text-muted-foreground">Applied</h4>
                  <p className="mt-1 text-sm">{formatDate(selectedEntry.created_at)}</p>
                  {selectedEntry.approved_at && (
                    <>
                      <h4 className="font-medium text-sm text-muted-foreground mt-2">
                        {selectedEntry.status === "approved" ? "Approved" : "Reviewed"} At
                      </h4>
                      <p className="mt-1 text-sm">{formatDate(selectedEntry.approved_at)}</p>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  {!selectedEntry.ai_analyzed_at && (
                    <Button
                      variant="outline"
                      onClick={() => analyzeEntry(selectedEntry.id)}
                      disabled={analyzingEntry === selectedEntry.id}
                      className="bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                    >
                      {analyzingEntry === selectedEntry.id ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Brain className="w-4 h-4 mr-2" />
                      )}
                      Analyze with AI
                    </Button>
                  )}

                  {selectedEntry.status === "approved" && (
                    <Button
                      variant="outline"
                      onClick={() => sendApprovalEmail(selectedEntry.id)}
                      disabled={sendingEmail === selectedEntry.id}
                      className="bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                    >
                      {sendingEmail === selectedEntry.id ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4 mr-2" />
                      )}
                      Send Welcome Email
                    </Button>
                  )}

                  {selectedEntry.status === "pending" && (
                    <>
                      <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => updateStatus(selectedEntry.id, "approved")}
                        disabled={updatingStatus === selectedEntry.id}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approve Access
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => updateStatus(selectedEntry.id, "rejected")}
                        disabled={updatingStatus === selectedEntry.id}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
