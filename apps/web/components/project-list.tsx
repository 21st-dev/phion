"use client";

import { useEffect, useState } from "react";
import { ProjectCard } from "@/components/project/project-card";
import { EmptyState } from "@/components/project/empty-state";
import { Skeleton } from "@/components/geist/skeleton";
import type { DatabaseTypes } from "@shipvibes/database";

export function ProjectList() {
  const [projects, setProjects] = useState<DatabaseTypes.ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    switch (status) {
      case "ready":
        return "READY";
      case "building":
        return "BUILDING";
      case "failed":
        return "ERROR";
      case "pending":
        return "QUEUED";
      default:
        return "QUEUED";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} width="100%" height={120} animated={true} />
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
