"use client";

import { Material } from "@/components/geist/material";
import { GitCommit } from "lucide-react";
import { DiffViewer } from "./diff-viewer";

interface FileHistoryItem {
  id: string;
  project_id: string;
  file_path: string;
  r2_object_key: string;
  content_hash: string;
  diff_text: string | null;
  file_size: number;
  created_at: string;
}

interface FileHistoryProps {
  history: FileHistoryItem[];
}

export function FileHistory({ history }: FileHistoryProps) {
  if (history.length === 0) {
    return (
      <Material type="base" className="p-6">
        <div className="text-center py-8">
          <GitCommit className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-1000 mb-2">
            No file changes yet
          </h3>
          <p className="text-sm text-gray-700">
            Start editing your project files to see the change history here.
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
          {history.length} change{history.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="space-y-4">
        {history.map((item) => (
          <DiffViewer
            key={item.id}
            filePath={item.file_path}
            diffText={item.diff_text}
            fileSize={item.file_size}
            timestamp={item.created_at}
          />
        ))}
      </div>
    </div>
  );
}
