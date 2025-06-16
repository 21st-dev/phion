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
import { Spinner } from "@/components/geist/spinner"
import { Eye, Calendar, Mail, Phone, PhoneOff, Check, X, Clock } from "lucide-react"
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
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const supabase = createAuthBrowserClient()
  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => {
    fetchWaitlistEntries()
  }, [])

  const fetchWaitlistEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      setEntries(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch waitlist entries")
    } finally {
      setLoading(false)
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

  const stats = {
    total: entries.length,
    pending: entries.filter((e) => e.status === "pending").length,
    approved: entries.filter((e) => e.status === "approved").length,
    rejected: entries.filter((e) => e.status === "rejected").length,
    acceptsCall: entries.filter((e) => e.accepts_call).length,
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

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  Pending Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Approved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Willing to Call
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.acceptsCall}</div>
              </CardContent>
            </Card>
          </div>

          {/* Waitlist Table */}
          <Card>
            <CardHeader>
              <CardTitle>Waitlist Entries</CardTitle>
              <CardDescription>
                Click on any entry to view detailed information and manage approval status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No waitlist entries yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Call</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            {entry.email}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(entry.status)}</TableCell>
                        <TableCell>
                          <Badge variant={entry.accepts_call ? "default" : "secondary"}>
                            {entry.accepts_call ? (
                              <>
                                <Phone className="w-3 h-3 mr-1" /> Yes
                              </>
                            ) : (
                              <>
                                <PhoneOff className="w-3 h-3 mr-1" /> No
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {formatDate(entry.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEntry(entry)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>

                            {entry.status === "pending" && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => updateStatus(entry.id, "approved")}
                                  disabled={updatingStatus === entry.id}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-red-300 text-red-700 hover:bg-red-50"
                                  onClick={() => updateStatus(entry.id, "rejected")}
                                  disabled={updatingStatus === entry.id}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

                {selectedEntry.status === "pending" && (
                  <div className="flex gap-2">
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
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
