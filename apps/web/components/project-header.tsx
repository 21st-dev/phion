"use client";

import { StatusDot } from "@/components/geist/status-dot";
import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";
import { RelativeTimeCard } from "@/components/geist/relative-time-card";
import Link from "next/link";
import type { ProjectRow } from "@shipvibes/database";

interface ProjectHeaderProps {
  project: ProjectRow;
  hideDownloadButton?: boolean;
}

export function ProjectHeader({
  project,
  hideDownloadButton = false,
}: ProjectHeaderProps) {
  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/download`);
      if (!response.ok) {
        throw new Error("Failed to download project");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading project:", error);
      alert("Failed to download project. Please try again.");
    }
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

  return (
    <div className="mb-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/">
          <Button
            type="secondary"
            size="small"
            prefix={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20 11H7.414l4.293-4.293-1.414-1.414L4 12l6.293 6.293 1.414-1.414L7.414 13H20v-2z" />
              </svg>
            }
          >
            Back to Projects
          </Button>
        </Link>
      </div>

      {/* Project Header */}
      <Material type="base" className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Project name and status */}
            <div className="flex items-center space-x-3 mb-3">
              <h1 className="text-2xl font-semibold text-gray-1000 truncate">
                {project.name}
              </h1>
              <StatusDot state={mapDeployStatus(project.deploy_status)} />
            </div>

            {/* Project URL if available */}
            {project.netlify_url && (
              <div className="mb-3">
                <a
                  href={project.netlify_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-gray-700 hover:text-gray-1000 transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                  </svg>
                  {project.netlify_url}
                </a>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center space-x-4 text-xs text-gray-600">
              <RelativeTimeCard
                date={new Date(project.created_at).getTime()}
                side="top"
              >
                <span>Created {formatRelativeTime(project.created_at)}</span>
              </RelativeTimeCard>
              <span>•</span>
              <span>Template: {project.template_type}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4">
            {!hideDownloadButton && (
              <Button
                type="secondary"
                size="medium"
                onClick={handleDownload}
                prefix={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                  </svg>
                }
              >
                Download
              </Button>
            )}
            {project.netlify_url && (
              <Button
                type="primary"
                size="medium"
                onClick={() => window.open(project.netlify_url!, "_blank")}
                prefix={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                  </svg>
                }
              >
                View Live
              </Button>
            )}
          </div>
        </div>
      </Material>
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}
