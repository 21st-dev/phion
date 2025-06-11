"use client";

import { useState, useEffect } from "react";
import { Material } from "@/components/geist/material";
import { Button } from "@/components/geist/button";
import { FileText, Save, Plus, Minus, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PendingChange {
  id: string;
  file_path: string;
  action: "modified" | "added" | "deleted";
  file_size: number;
  updated_at: string;
}

interface PendingChangesSidebarProps {
  projectId: string;
  pendingChanges: PendingChange[];
  onSaveAll: (commitMessage: string) => void;
  onDiscardAll: () => void;
  isLoading?: boolean;
}

// Client-side only time display component
function TimeDisplay({ timestamp }: { timestamp: string }) {
  const [timeString, setTimeString] = useState<string>("");

  useEffect(() => {
    setTimeString(new Date(timestamp).toLocaleTimeString());
  }, [timestamp]);

  return <span>{timeString || "Loading..."}</span>;
}

export function PendingChangesSidebar({
  projectId,
  pendingChanges,
  onSaveAll,
  onDiscardAll,
  isLoading = false,
}: PendingChangesSidebarProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [showCommitDialog, setShowCommitDialog] = useState(false);

  const handleSaveAll = () => {
    const message = commitMessage || `Update ${pendingChanges.length} files`;
    onSaveAll(message);

    // Reset state
    setCommitMessage("");
    setShowCommitDialog(false);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "added":
        return <Plus className="h-3 w-3 text-green-600" />;
      case "deleted":
        return <Minus className="h-3 w-3 text-red-600" />;
      case "modified":
      default:
        return <Edit className="h-3 w-3 text-blue-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "added":
        return "text-green-600 bg-green-50 border-green-200";
      case "deleted":
        return "text-red-600 bg-red-50 border-red-200";
      case "modified":
      default:
        return "text-blue-600 bg-blue-50 border-blue-200";
    }
  };

  if (pendingChanges.length === 0) {
    return (
      <Material type="base" className="h-full">
        <div
          className="p-4 text-center"
          style={{ color: "var(--ds-gray-600)" }}
        >
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No pending changes</p>
          <p className="text-sm opacity-75">Make changes to see them here</p>
        </div>
      </Material>
    );
  }

  return (
    <Material type="base" className="h-full flex flex-col">
      <div
        className="p-4 border-b"
        style={{ borderColor: "var(--ds-gray-alpha-400)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3
            className="font-medium"
            style={{ color: "var(--geist-foreground)" }}
          >
            Unsaved Changes
          </h3>
          <Badge variant="secondary">{pendingChanges.length} files</Badge>
        </div>

        <div className="text-sm" style={{ color: "var(--ds-gray-600)" }}>
          Changes are automatically tracked. Click Save All to deploy.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pendingChanges.map((change) => (
          <div
            key={change.id}
            className="p-3 border-b hover:bg-gray-50"
            style={{ borderColor: "var(--ds-gray-alpha-200)" }}
          >
            <div className="flex items-center gap-2">
              {getActionIcon(change.action)}
              <span
                className="text-sm font-medium truncate flex-1"
                style={{ color: "var(--geist-foreground)" }}
              >
                {change.file_path}
              </span>
              <Badge
                variant="secondary"
                className={`text-xs ${getActionColor(change.action)}`}
              >
                {change.action}
              </Badge>
            </div>
            <div
              className="ml-5 text-xs mt-1"
              style={{ color: "var(--ds-gray-500)" }}
            >
              <TimeDisplay timestamp={change.updated_at} />
            </div>
          </div>
        ))}
      </div>

      <div
        className="p-4 border-t"
        style={{
          borderColor: "var(--ds-gray-alpha-400)",
          backgroundColor: "var(--ds-background-100)",
        }}
      >
        {!showCommitDialog ? (
          <div className="space-y-2">
            <Button
              type="primary"
              onClick={() => setShowCommitDialog(true)}
              fullWidth
              disabled={isLoading}
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? "Saving..." : `Save All (${pendingChanges.length})`}
            </Button>

            <Button
              type="error"
              onClick={onDiscardAll}
              fullWidth
              disabled={isLoading}
            >
              <Minus className="h-4 w-4 mr-2" />
              Discard All Changes
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              placeholder="Commit message (optional)"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full p-2 border rounded text-sm resize-none"
              style={{
                borderColor: "var(--ds-gray-alpha-400)",
                backgroundColor: "var(--ds-background-100)",
              }}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                type="primary"
                onClick={handleSaveAll}
                fullWidth
                disabled={isLoading}
              >
                Save & Deploy
              </Button>
              <Button
                type="secondary"
                onClick={() => setShowCommitDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Material>
  );
}
