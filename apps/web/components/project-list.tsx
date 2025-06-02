"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Download,
  Calendar,
  Folder,
  ArrowRight,
  Rocket,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { ProjectRow } from "@shipvibes/database";

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deployingProjects, setDeployingProjects] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    fetchProjects();
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

  const handleDownload = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/download`);
      if (!response.ok) {
        throw new Error("Failed to download project");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-${projectId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading project:", error);
      alert("Failed to download project. Please try again.");
    }
  };

  const handleDeploy = async (projectId: string) => {
    try {
      setDeployingProjects((prev) => new Set(prev).add(projectId));

      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to trigger deploy");
      }

      // Обновляем список проектов
      await fetchProjects();
    } catch (error) {
      console.error("Error triggering deploy:", error);
      alert("Failed to trigger deploy. Please try again.");
    } finally {
      setDeployingProjects((prev) => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Ready
          </Badge>
        );
      case "building":
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            Building
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Projects</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </CardContent>
              <CardFooter>
                <div className="h-10 bg-muted rounded w-full"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Projects</h2>
        </div>
        <Card className="flex flex-col items-center justify-center p-8 text-center">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Folder className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first project to get started with automatic deployment.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Projects</h2>
        <p className="text-sm text-muted-foreground">
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="flex flex-col hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <Link href={`/project/${project.id}`} className="flex-1">
                  <div className="cursor-pointer">
                    <CardTitle className="text-lg hover:text-primary transition-colors">
                      {project.name}
                    </CardTitle>
                    <CardDescription>{project.template_type}</CardDescription>
                  </div>
                </Link>
                {getStatusBadge(project.deploy_status)}
              </div>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="flex items-center text-sm text-muted-foreground mb-3">
                <Calendar className="mr-2 h-4 w-4" />
                {new Date(project.created_at).toLocaleDateString()}
              </div>

              {project.netlify_url && (
                <a
                  href={project.netlify_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  View live site
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              )}
            </CardContent>

            <CardFooter>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(project.id)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeploy(project.id)}
                    disabled={
                      deployingProjects.has(project.id) ||
                      project.deploy_status === "building"
                    }
                  >
                    {deployingProjects.has(project.id) ||
                    project.deploy_status === "building" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4 mr-2" />
                    )}
                    Deploy
                  </Button>

                  <details className="text-xs select-none">
                    <summary className="cursor-pointer text-primary">
                      Setup
                    </summary>
                    <pre className="bg-muted px-2 py-1 rounded mt-1 whitespace-pre-wrap select-all text-xs">
                      pnpm start
                    </pre>
                  </details>
                </div>

                <Link href={`/project/${project.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
