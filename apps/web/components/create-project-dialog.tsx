"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/geist/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

interface CreateProjectDialogProps {
  trigger?: React.ReactNode
}

export function CreateProjectDialog({ trigger }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()
  const { error: showError, success: showSuccess } = useToast()

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName.trim(),
          template_type: "vite-react",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create project")
      }

      const data = await response.json()

      showSuccess("Project created successfully", `"${projectName.trim()}" is ready for setup`)

      setOpen(false)
      setProjectName("")

      router.push(`/project/${data.project.id}/onboarding`)
    } catch (error) {
      console.error("Error creating project:", error)
      showError("Failed to create project", "Please try again")
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isCreating && projectName.trim()) {
      handleCreateProject()
    }
  }

  const defaultTrigger = (
    <Button
      type="primary"
      size="medium"
      prefix={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      }
    >
      New Project
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Give your project a name to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="My Awesome Project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={100}
              autoFocus
              disabled={isCreating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="secondary"
            size="medium"
            onClick={() => setOpen(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            size="medium"
            onClick={handleCreateProject}
            loading={isCreating}
            disabled={!projectName.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
