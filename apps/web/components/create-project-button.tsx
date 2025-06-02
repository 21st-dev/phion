"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

export function CreateProjectButton() {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreateProject = async () => {
    setIsCreating(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Project ${Date.now()}`,
          template_type: "vite-react",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const data = await response.json();

      // Перенаправляем на страницу проекта
      router.push(`/project/${data.project.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button
      onClick={handleCreateProject}
      disabled={isCreating}
      className="gap-2"
      size="sm"
    >
      {isCreating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating...
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" />
          New Project
        </>
      )}
    </Button>
  );
}
