"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";

interface DiffViewerProps {
  filePath: string;
  diffText: string | null;
  fileSize: number;
  timestamp: string;
}

export function DiffViewer({
  filePath,
  diffText,
  fileSize,
  timestamp,
}: DiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const parseDiff = (diffText: string) => {
    if (!diffText) return [];

    const lines = diffText.split("\n");
    return lines.map((line, index) => {
      const type = line.startsWith("+")
        ? "addition"
        : line.startsWith("-")
        ? "deletion"
        : "context";
      return {
        type,
        content: line.slice(1), // Remove the +/- prefix
        lineNumber: index + 1,
      };
    });
  };

  const diffLines = diffText ? parseDiff(diffText) : [];

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 h-auto"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{filePath}</CardTitle>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{formatFileSize(fileSize)}</span>
            <span>{formatTimestamp(timestamp)}</span>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {diffText ? (
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted px-3 py-2 text-sm font-medium border-b">
                Changes in {filePath}
              </div>
              <div className="bg-background">
                {diffLines.map((line, index) => (
                  <div
                    key={index}
                    className={`flex text-sm font-mono ${
                      line.type === "addition"
                        ? "bg-green-50 text-green-800 border-l-2 border-green-500"
                        : line.type === "deletion"
                        ? "bg-red-50 text-red-800 border-l-2 border-red-500"
                        : "bg-background text-foreground"
                    }`}
                  >
                    <div className="px-3 py-1 text-muted-foreground bg-muted/50 border-r min-w-[60px] text-right">
                      {line.lineNumber}
                    </div>
                    <div className="px-3 py-1 flex-1">
                      <span
                        className={`${
                          line.type === "addition"
                            ? "text-green-700"
                            : line.type === "deletion"
                            ? "text-red-700"
                            : ""
                        }`}
                      >
                        {line.type === "addition" && "+"}
                        {line.type === "deletion" && "-"}
                        {line.content}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No diff available for this file</p>
              <p className="text-sm">
                This might be the first version of the file
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
