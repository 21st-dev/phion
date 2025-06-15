"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/geist/button"
import { Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

interface DeleteAllProjectsDialogProps {
  trigger?: React.ReactNode
  onSuccess?: () => void
  variant?: "button" | "menu-item"
}

export function DeleteAllProjectsDialog({
  trigger,
  onSuccess,
  variant = "button",
}: DeleteAllProjectsDialogProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { error: showError, success: showSuccess } = useToast()

  const confirmDeleteAllProjects = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/projects/delete-all", {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete all projects")
      }

      const result = await response.json()

      console.log("All projects deleted successfully:", result)

      showSuccess("All projects deleted", `Successfully deleted ${result.deletedCount} project(s)`)

      if (result.errors && result.errors.length > 0) {
        console.warn("Some errors occurred during deletion:", result.errors)
        showError(
          "Partial deletion completed",
          `${result.errors.length} error(s) occurred during deletion`,
        )
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push("/")
        // Принудительно обновляем страницу через небольшой delay
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }
    } catch (error) {
      console.error("Error deleting all projects:", error)
      showError(
        "Failed to delete projects",
        error instanceof Error ? error.message : "Please try again",
      )
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const defaultTrigger =
    variant === "button" ? (
      <Button
        type="error"
        size="medium"
        disabled={isDeleting}
        loading={isDeleting}
        prefix={<Trash2 className="h-4 w-4" />}
      >
        {isDeleting ? "Deleting..." : "Delete All Projects"}
      </Button>
    ) : (
      <div className="flex items-center gap-2 text-destructive">
        <Trash2 className="h-4 w-4" />
        Delete All Projects (DEV)
      </div>
    )

  return (
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogTrigger
        asChild
        onClick={(e) => {
          if (variant === "menu-item") {
            e.stopPropagation()
          }
        }}
      >
        {trigger || defaultTrigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete All Projects (Development)</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete ALL your projects? This action cannot be undone. This
            will permanently delete all files, publications, and history for every project you own.
            <br />
            <br />
            <strong className="text-destructive">
              This is a development-only feature and will delete everything!
            </strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="secondary"
            size="medium"
            onClick={() => setShowDeleteDialog(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="error"
            size="medium"
            onClick={confirmDeleteAllProjects}
            loading={isDeleting}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting All..." : "Delete All Projects"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
