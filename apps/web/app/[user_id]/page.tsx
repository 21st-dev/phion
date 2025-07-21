"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ProjectList } from "@/components/project-list"
import { DeleteAllProjectsDialog } from "@/components/project/delete-all-projects-dialog"
import { Header } from "@/components/layout/header"
import { createAuthBrowserClient } from "@shipvibes/database"
import type { User } from "@supabase/supabase-js"
import { CreateProjectButton } from "@/components/create-project-button"
import { useInvalidateProjects } from "@/hooks/use-projects"
import { Spinner } from "@/components/geist/spinner"
import { FirstExperienceOnboarding } from "@/components/onboarding/first-experience"
import { useProjects } from "@/hooks/use-projects"

export default function UserDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const router = useRouter()
  const supabase = createAuthBrowserClient()
  const invalidateProjects = useInvalidateProjects()
  const { data: projects, isLoading: projectsLoading } = useProjects()

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/")
        return
      }

      setUser(user)
      setLoading(false)
    }

    checkAuth()
  }, [router, supabase.auth])

  useEffect(() => {
    // Check if need to show onboarding
    if (!loading && !projectsLoading && user) {
      // If user has no projects and no saved onboarding completion flag
      const hasSeenOnboarding = localStorage.getItem(`onboarding-seen-${user.id}`)
      console.log("Onboarding check:", {
        loading,
        projectsLoading,
        projects: projects?.length || 0,
        hasSeenOnboarding,
        userId: user.id
      })
      if ((!projects || projects.length === 0) && !hasSeenOnboarding) {
        console.log("Showing onboarding!")
        setShowOnboarding(true)
      }
    }
  }, [loading, projectsLoading, projects, user])

  const handleDeleteAllSuccess = () => {
    invalidateProjects()
  }

  const handleOnboardingComplete = () => {
    if (user) {
      localStorage.setItem(`onboarding-seen-${user.id}`, "true")
    }
    setShowOnboarding(false)
    invalidateProjects()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-100 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-center">
          <Spinner size={32} />
          <p className="mt-4 text-sm text-muted-foreground">Loading your projects...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (showOnboarding) {
    return <FirstExperienceOnboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="min-h-screen bg-background-100">
      <div className="sticky top-0 z-50">
        <Header user={user} />
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col space-y-8">
            {/* Hero Section */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-gray-1000">Your Projects</h1>
                <p className="text-gray-700">
                  Edit your frontend code locally in Cursor and see changes published instantly.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <CreateProjectButton />
                {/* Dev-only: Delete All Projects */}
                {process.env.NODE_ENV === "development" && (
                  <DeleteAllProjectsDialog variant="button" onSuccess={handleDeleteAllSuccess} />
                )}
              </div>
            </div>

            {/* Projects */}
            <ProjectList />
          </div>
        </div>
      </main>
    </div>
  )
}
