"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/geist/button";
import { Select } from "@/components/geist/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROJECT_TEMPLATES } from "@shipvibes/shared";

interface CreateProjectDialogProps {
  trigger?: React.ReactNode;
}

export function CreateProjectDialog({ trigger }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [templateType, setTemplateType] = useState("vite-react");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const templates = Object.entries(PROJECT_TEMPLATES).map(
    ([key, template]) => ({
      value: key,
      label: template.name,
      description: template.description,
    })
  );

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      return;
    }

    setIsCreating(true);

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
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const data = await response.json();

      // Закрываем диалог и перенаправляем на страницу проекта
      setOpen(false);
      router.push(`/project/${data.project.id}`);

      // Сбрасываем форму
      setProjectName("");
      setTemplateType("vite-react");
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isCreating && projectName.trim()) {
      handleCreateProject();
    }
  };

  const defaultTrigger = (
    <Button
      type="primary"
      size="medium"
      prefix={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 5v14m-7-7h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      }
    >
      New Project
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Give your project a name and choose a template to get started.
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
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="template">Template</Label>
            <Select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              options={templates}
              size="medium"
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
  );
}
