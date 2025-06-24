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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { PROJECT_TEMPLATES } from "@shipvibes/shared"

interface CreateProjectDialogProps {
  trigger?: React.ReactNode
}

export function CreateProjectDialog({ trigger }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [templateType, setTemplateType] = useState<"vite" | "nextjs">("vite")
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
          template_type: templateType,
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
      setTemplateType("vite")

      // ✅ Быстрый redirect - пользователь увидит страницу с прогрессом
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Choose a template and give your project a name to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-3">
            <Label>Template Type</Label>
            <RadioGroup
              value={templateType}
              onValueChange={(value) => setTemplateType(value as "vite" | "nextjs")}
              disabled={isCreating}
              className="grid gap-3"
            >
              {(
                Object.entries(PROJECT_TEMPLATES) as Array<
                  [
                    keyof typeof PROJECT_TEMPLATES,
                    (typeof PROJECT_TEMPLATES)[keyof typeof PROJECT_TEMPLATES],
                  ]
                >
              ).map(([key, template]) => (
                <div key={key} className="flex items-center space-x-2">
                  <RadioGroupItem value={key} id={key} />
                  <Label htmlFor={key} className="flex-1 cursor-pointer">
                    <Card className="transition-colors hover:bg-accent/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="text-lg">{template.icon}</span>
                          {template.name}
                          <span className="ml-auto text-xs bg-muted px-2 py-1 rounded-full">
                            {template.platform}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-xs">
                          {template.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="My Awesome Project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={100}
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
