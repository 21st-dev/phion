"use client";

import { useEffect, useState } from "react";
import { ProjectCard } from "@/components/project/project-card";
import { ProjectCardSkeleton } from "@/components/project/project-card-skeleton";
import { EmptyState } from "@/components/project/empty-state";
import type { DatabaseTypes } from "@shipvibes/database";
import { useToast } from "@/hooks/use-toast";

export function ProjectList() {
  const [projects, setProjects] = useState<DatabaseTypes.ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { error: showError } = useToast();

  useEffect(() => {
    fetchProjects();

    // ✅ УБИРАЕМ АГРЕССИВНЫЙ POLLING!
    // Обновляем статус только при необходимости, а не каждые 30 секунд
    // const interval = setInterval(() => {
    //   fetchProjects();
    // }, 30000);

    // return () => clearInterval(interval);
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
      showError(
        "Failed to load projects",
        "Please refresh the page to try again"
      );
    } finally {
      setLoading(false);
    }
  };

  // Конвертируем данные для совместимости с ProjectCard
  const formatProjectsForCards = (projects: DatabaseTypes.ProjectRow[]) => {
    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      url: project.netlify_url || undefined,
      deploy_status: mapDeployStatus(project.deploy_status || ""),
      updated_at:
        project.updated_at || project.created_at || new Date().toISOString(),
      created_at: project.created_at || new Date().toISOString(),
    }));
  };

  const mapDeployStatus = (
    status: string
  ): "QUEUED" | "BUILDING" | "ERROR" | "READY" | "CANCELED" => {
    console.log("🔄 [ProjectList] Mapping deploy status:", status);
    switch (status) {
      case "ready":
        return "READY";
      case "building":
        return "BUILDING";
      case "failed":
      case "error":
        return "ERROR";
      case "pending":
        return "QUEUED";
      case "canceled":
      case "cancelled":
        return "CANCELED";
      default:
        console.warn(
          "⚠️ [ProjectList] Unknown deploy status:",
          status,
          "- mapping to QUEUED"
        );
        return "QUEUED";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return <EmptyState />;
  }

  const formattedProjects = formatProjectsForCards(projects);

  return (
    <div className="space-y-4">
      {formattedProjects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
