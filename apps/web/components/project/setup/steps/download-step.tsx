"use client";

import { useState } from "react";
import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";
import type { ProjectRow } from "@shipvibes/database";

interface DownloadStepProps {
  project: ProjectRow;
  onDownload: () => void;
  isCompleted?: boolean;
}

export function DownloadStep({
  project,
  onDownload,
  isCompleted = false,
}: DownloadStepProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Material type="base" className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 font-sans">
        Download Project
      </h3>
      <div className="space-y-4">
        <Button
          type="primary"
          size="large"
          onClick={handleDownload}
          loading={isDownloading}
          fullWidth
          prefix={
            !isDownloading ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            ) : undefined
          }
        >
          {isDownloading ? "Generating files..." : "Download project files"}
        </Button>

        {isCompleted && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20,6 9,17 4,12" />
            </svg>
            Files downloaded successfully!
          </div>
        )}
      </div>
    </Material>
  );
}
