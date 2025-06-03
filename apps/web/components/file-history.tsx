"use client";

import { Material } from "@/components/geist/material";
import {
  GitCommit,
  ChevronDown,
  ChevronRight,
  File,
  Plus,
  Minus,
  Edit,
} from "lucide-react";
import { useState, useEffect } from "react";

interface CommitItem {
  commit_id: string;
  commit_message: string;
  created_at: string;
  project_id: string;
}

interface CommitFile {
  id: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

interface FileHistoryProps {
  projectId: string;
}

export function FileHistory({ projectId }: FileHistoryProps) {
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(
    new Set()
  );
  const [commitFiles, setCommitFiles] = useState<Record<string, CommitFile[]>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommits();
  }, [projectId]);

  const fetchCommits = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/commits`);
      if (response.ok) {
        const data = await response.json();
        setCommits(data.commits || []);
      }
    } catch (error) {
      console.error("Error fetching commits:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommitFiles = async (commitId: string) => {
    if (commitFiles[commitId]) return; // Уже загружено

    try {
      const response = await fetch(
        `/api/projects/${projectId}/commits?commit_id=${commitId}`
      );
      if (response.ok) {
        const data = await response.json();
        setCommitFiles((prev) => ({
          ...prev,
          [commitId]: data.files || [],
        }));
      }
    } catch (error) {
      console.error("Error fetching commit files:", error);
    }
  };

  const toggleCommit = async (commitId: string) => {
    if (expandedCommits.has(commitId)) {
      setExpandedCommits((prev) => {
        const newSet = new Set(prev);
        newSet.delete(commitId);
        return newSet;
      });
    } else {
      setExpandedCommits((prev) => new Set(prev).add(commitId));
      await fetchCommitFiles(commitId);
    }
  };

  const getFileIcon = (filePath: string) => {
    if (filePath.includes("deleted"))
      return <Minus className="h-4 w-4 text-red-500" />;
    if (filePath.includes("added"))
      return <Plus className="h-4 w-4 text-green-500" />;
    return <Edit className="h-4 w-4 text-blue-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Material type="base" className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </Material>
    );
  }

  if (commits.length === 0) {
    return (
      <Material type="base" className="p-6">
        <div className="text-center py-8">
          <GitCommit className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-1000 mb-2">
            No commits yet
          </h3>
          <p className="text-sm text-gray-700">
            Start editing your project files and save changes to see commits
            here.
          </p>
        </div>
      </Material>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-1000">File History</h2>
        <div className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
          {commits.length} commit{commits.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="space-y-3">
        {commits.map((commit) => (
          <Material
            key={commit.commit_id}
            type="base"
            className="overflow-hidden"
          >
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleCommit(commit.commit_id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {expandedCommits.has(commit.commit_id) ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                </div>
                <GitCommit className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {commit.commit_message}
                    </h3>
                    <div className="text-xs text-gray-500 ml-4 flex-shrink-0">
                      {new Date(commit.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {commit.commit_id.slice(0, 8)}
                  </div>
                </div>
              </div>
            </div>

            {/* Файлы коммита */}
            {expandedCommits.has(commit.commit_id) && (
              <div className="border-t border-gray-200 bg-gray-50">
                {commitFiles[commit.commit_id] ? (
                  <div className="p-4 space-y-2">
                    {commitFiles[commit.commit_id].map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 py-2"
                      >
                        {getFileIcon(file.file_path)}
                        <File className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700 flex-grow">
                          {file.file_path}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(file.file_size)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Material>
        ))}
      </div>
    </div>
  );
}
