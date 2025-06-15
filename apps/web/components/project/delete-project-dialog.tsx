"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/geist/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface DeleteProjectDialogProps {
  projectId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  variant?: "button" | "menu-item";
}

export function DeleteProjectDialog({
  projectId,
  trigger,
  onSuccess,
  variant = "button",
}: DeleteProjectDialogProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { error: showError, success: showSuccess } = useToast();

  const confirmDeleteProject = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      console.log("Project deleted successfully");
      showSuccess(
        "Project deleted",
        "The project has been permanently deleted",
      );

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      showError("Failed to delete project", "Please try again");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const defaultTrigger =
    variant === "button" ? (
      <Button
        type="error"
        size="medium"
        disabled={isDeleting}
        loading={isDeleting}
        prefix={<Trash2 className="h-4 w-4" />}
      >
        {isDeleting ? "Deleting..." : "Delete Project"}
      </Button>
    ) : (
      <div className="flex items-center gap-2 text-destructive">
        <Trash2 className="h-4 w-4" />
        Delete Project
      </div>
    );

  return (
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogTrigger
        asChild
        onClick={(e) => {
          if (variant === "menu-item") {
            e.stopPropagation();
          }
        }}
      >
        {trigger || defaultTrigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Project</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this project? This action cannot be
            undone. This will permanently delete all files, publications, and
            history.
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
            onClick={confirmDeleteProject}
            loading={isDeleting}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Project"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
