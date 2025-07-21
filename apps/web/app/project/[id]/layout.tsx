import React from "react"
import { notFound, redirect } from "next/navigation"
import { cookies } from "next/headers"
import { Header } from "@/components/layout/header"
import { ProjectNavigation } from "@/components/project/project-navigation"
import { ProjectLayoutClient } from "@/components/project/project-layout-client"
import {
  getProjectById,
  getPendingChanges,
  createAuthServerClient,
  getSupabaseServerClient,
  CommitHistoryQueries,
} from "@shipvibes/database"

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params

  // Get user for Header
  const cookieStore = await cookies()
  const supabase = createAuthServerClient({
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      } catch {
        // Ignore errors setting cookies in Server Components
      }
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is not authenticated, redirect to main page
  if (!user) {
    redirect("/")
  }

  // Get commit history ( API )
  const supabaseServer = getSupabaseServerClient()
  const commitHistoryQueries = new CommitHistoryQueries(supabaseServer)

  const [project, commits, pendingChanges] = await Promise.all([
    getProjectById(id),
    commitHistoryQueries.getProjectCommitHistory(id),
    getPendingChanges(id),
  ])

  const history = commits.map((commit) => ({
    commit_id: commit.github_commit_sha,
    commit_message: commit.commit_message,
    created_at: commit.created_at,
    project_id: commit.project_id,
    files_count: commit.files_count || 0,
  }))

  console.log("🎯 [ProjectLayout] Server-side data loaded:", {
    projectId: id,
    projectExists: !!project,
    commitsFromDB: commits?.length || 0,
    historyLength: history?.length || 0,
    history: history,
    pendingChangesLength: pendingChanges?.length || 0,
    pendingChanges: pendingChanges,
  })

  if (!project) {
    notFound()
  }

  return (
    <ProjectLayoutClient
      project={project}
      initialHistory={history}
      initialPendingChanges={pendingChanges}
    >
      <div className="min-h-screen bg-background-100">
        {/* Fixed Header and Navigation */}
        <div className="fixed top-0 left-0 right-0 z-50">
          {/*  Header  */}
          <Header user={user} project={project} />

          {/* Navigation Tabs */}
          <div className="border-b border-border bg-background-100">
            <div className="px-4">
              <ProjectNavigation projectId={project.id} project={project} />
            </div>
          </div>
        </div>
        {/* Add padding to account for fixed header height */}
        <div className="pt-[120px]"></div>

        {/* Page Content */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </div>
    </ProjectLayoutClient>
  )
}
