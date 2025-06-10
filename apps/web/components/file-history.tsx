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

interface FileHistoryItem {
  id: string;
  file_path: string;
  file_size: number;
  created_at: string;
  commit_id?: string;
  commit_message?: string;
}

interface FileHistoryProps {
  projectId: string;
}

export function FileHistory({ projectId }: FileHistoryProps) {
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [fileHistory, setFileHistory] = useState<FileHistoryItem[]>([]);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(
    new Set()
  );
  const [commitFiles, setCommitFiles] = useState<Record<string, CommitFile[]>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [showFileHistory, setShowFileHistory] = useState(false);

  useEffect(() => {
    console.log(
      "🔍 FileHistory: useEffect triggered with projectId:",
      projectId
    );
    fetchCommits();
  }, [projectId]);

  const fetchCommits = async () => {
    console.log(
      "📡 FileHistory: Starting fetchCommits for project:",
      projectId
    );
    try {
      const url = `/api/projects/${projectId}/commits`;
      console.log("📡 FileHistory: Making request to:", url);

      const response = await fetch(url);
      console.log(
        "📡 FileHistory: Response status:",
        response.status,
        response.statusText
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ FileHistory: Received data:", data);
        console.log(
          "📊 FileHistory: Commits array length:",
          data.commits?.length || 0
        );
        console.log("📋 FileHistory: Commits data:", data.commits);

        setCommits(data.commits || []);

        // Если коммитов нет, пробуем загрузить историю файлов напрямую
        if (!data.commits || data.commits.length === 0) {
          console.log(
            "🔄 FileHistory: No commits found, trying to fetch file history directly"
          );
          await fetchFileHistory();
        }
      } else {
        console.error(
          "❌ FileHistory: Response not ok:",
          response.status,
          response.statusText
        );
        const errorText = await response.text();
        console.error("❌ FileHistory: Error response body:", errorText);

        // Если API не работает, пробуем запасной вариант
        console.log(
          "🔄 FileHistory: API failed, trying file history as fallback"
        );
        await fetchFileHistory();
      }
    } catch (error) {
      console.error("❌ FileHistory: Error fetching commits:", error);
      console.log(
        "🔄 FileHistory: Exception occurred, trying file history as fallback"
      );
      await fetchFileHistory();
    } finally {
      console.log(
        "🏁 FileHistory: fetchCommits completed, setting loading to false"
      );
      setLoading(false);
    }
  };

  const fetchFileHistory = async () => {
    console.log(
      "📂 FileHistory: Fetching file history directly for project:",
      projectId
    );
    try {
      const url = `/api/projects/${projectId}/versions`;
      console.log("📂 FileHistory: Making request to:", url);

      const response = await fetch(url);
      console.log(
        "📂 FileHistory: File history response status:",
        response.status
      );

      if (response.ok) {
        const data = await response.json();
        console.log("📂 FileHistory: Received file history data:", data);
        console.log("📂 FileHistory: File history length:", data?.length || 0);

        setFileHistory(data || []);
        setShowFileHistory(true);
      } else {
        console.error(
          "❌ FileHistory: Error fetching file history:",
          response.status
        );
      }
    } catch (error) {
      console.error("❌ FileHistory: Error fetching file history:", error);
    }
  };

  const fetchCommitFiles = async (commitId: string) => {
    if (commitFiles[commitId]) {
      console.log("📁 FileHistory: Files already loaded for commit:", commitId);
      return; // Уже загружено
    }

    console.log("📁 FileHistory: Fetching files for commit:", commitId);
    try {
      const url = `/api/projects/${projectId}/commits?commit_id=${commitId}`;
      console.log("📁 FileHistory: Making request to:", url);

      const response = await fetch(url);
      console.log("📁 FileHistory: Files response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("📁 FileHistory: Received files data:", data);
        console.log("📁 FileHistory: Files count:", data.files?.length || 0);

        setCommitFiles((prev) => ({
          ...prev,
          [commitId]: data.files || [],
        }));
      } else {
        console.error(
          "❌ FileHistory: Error fetching commit files:",
          response.status
        );
      }
    } catch (error) {
      console.error("❌ FileHistory: Error fetching commit files:", error);
    }
  };

  const toggleCommit = async (commitId: string) => {
    console.log("🔄 FileHistory: Toggling commit:", commitId);
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

  console.log(
    "🎨 FileHistory: Rendering, loading:",
    loading,
    "commits.length:",
    commits.length,
    "showFileHistory:",
    showFileHistory,
    "fileHistory.length:",
    fileHistory.length
  );

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

  // Показываем историю файлов, если нет коммитов
  if (commits.length === 0 && showFileHistory && fileHistory.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-1000">File History</h2>
          <div className="px-2 py-1 bg-yellow-100 text-yellow-700 text-sm rounded">
            {fileHistory.length} file version
            {fileHistory.length !== 1 ? "s" : ""} (no commits)
          </div>
        </div>

        <Material type="base" className="p-4">
          <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded border border-yellow-200 mb-4">
            ⚠️ Showing individual file versions. These haven't been organized
            into commits yet.
          </div>
          <div className="space-y-2">
            {fileHistory.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 py-2 px-3 hover:bg-gray-50 rounded"
              >
                <File className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700 flex-grow">
                  {file.file_path}
                </span>
                <span className="text-xs text-gray-500">
                  {formatFileSize(file.file_size)}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(file.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Material>
      </div>
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
          <div className="mt-4 text-xs text-gray-500 bg-gray-100 p-2 rounded">
            Debug: projectId = {projectId}, commits.length = {commits.length},
            fileHistory.length = {fileHistory.length}, showFileHistory ={" "}
            {showFileHistory}
          </div>
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
