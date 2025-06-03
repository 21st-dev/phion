"use client";

import { useState, useEffect } from "react";
import { Material } from "@/components/geist/material";
import {
  Rocket,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";

interface CommitItem {
  commit_id: string;
  commit_message: string;
  created_at: string;
  project_id: string;
}

interface RecentDeploysProps {
  projectId: string;
}

export function RecentDeploys({ projectId }: RecentDeploysProps) {
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectInfo, setProjectInfo] = useState<any>(null);

  useEffect(() => {
    fetchRecentCommits();
    fetchProjectInfo();
  }, [projectId]);

  const fetchRecentCommits = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/commits`);
      if (response.ok) {
        const data = await response.json();
        const commits = data.commits || [];
        // Take only the first 5 commits
        setCommits(Array.isArray(commits) ? commits.slice(0, 5) : []);
      }
    } catch (error) {
      console.error("Error fetching recent commits:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectInfo = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/status`);
      if (response.ok) {
        const data = await response.json();
        setProjectInfo(data);
      }
    } catch (error) {
      console.error("Error fetching project info:", error);
    }
  };

  const getDeployStatus = (commit: CommitItem) => {
    // Для простоты считаем что все коммиты успешно задеплоены
    // В будущем можно добавить tracking статуса каждого деплоя
    return "success";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "building":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Material type="base" className="p-6">
        <h4 className="text-lg font-semibold text-gray-1000 mb-4">
          Recent Deploys
        </h4>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
              <div className="flex-1 h-4 bg-gray-200 rounded"></div>
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </Material>
    );
  }

  return (
    <Material type="base" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-1000">Recent Deploys</h4>
        {projectInfo?.netlify_url && (
          <a
            href={projectInfo.netlify_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View Live Site
          </a>
        )}
      </div>

      {commits.length === 0 ? (
        <div className="text-center py-8">
          <Rocket className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">
            No deploys yet
          </h3>
          <p className="text-sm text-gray-500">
            Save your first changes to trigger a deployment.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {commits.map((commit, index) => {
            const status = getDeployStatus(commit);
            return (
              <div
                key={commit.commit_id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {commit.commit_message}
                    </p>
                    <p className="text-xs text-gray-500">
                      {commit.commit_id.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {index === 0 && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      Latest
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {formatDate(commit.created_at)}
                  </span>
                </div>
              </div>
            );
          })}

          {commits.length >= 5 && (
            <div className="text-center pt-2">
              <span className="text-sm text-gray-500">
                Showing latest 5 deploys
              </span>
            </div>
          )}
        </div>
      )}
    </Material>
  );
}
