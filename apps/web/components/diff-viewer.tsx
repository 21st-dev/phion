"use client";

import { useState } from "react";
import { Material } from "@/components/geist/material";
import { Button } from "@/components/geist/button";
import { ChevronDown, ChevronRight, FileText, Plus, Minus } from "lucide-react";
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockGroup,
} from "@/components/ui/code-block";
import { useTheme } from "next-themes";

interface DiffViewerProps {
  filePath: string;
  diffText: string | null;
  fileSize: number;
  timestamp: string;
}

interface DiffLine {
  type: "addition" | "deletion" | "context";
  content: string;
  lineNumber: number;
}

export function DiffViewer({
  filePath,
  diffText,
  fileSize,
  timestamp,
}: DiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { theme } = useTheme();

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const parseDiff = (diffText: string): DiffLine[] => {
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

  // Get file extension for language detection
  const getLanguage = (filepath: string): string => {
    const ext = filepath.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "js":
        return "javascript";
      case "jsx":
        return "jsx";
      case "ts":
        return "typescript";
      case "tsx":
        return "tsx";
      case "css":
        return "css";
      case "html":
        return "html";
      case "json":
        return "json";
      case "md":
        return "markdown";
      case "py":
        return "python";
      default:
        return "text";
    }
  };

  const generateDiffCode = (lines: DiffLine[]): string => {
    return lines
      .map((line) => {
        const prefix =
          line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " ";
        return `${prefix}${line.content}`;
      })
      .join("\n");
  };

  return (
    <Material type="base" className="mb-4">
      <div
        className="p-4 pb-3 border-b"
        style={{
          borderColor: "var(--ds-gray-alpha-400)",
          backgroundColor: "var(--ds-background-100)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="small"
              type="tertiary"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <FileText
              className="h-4 w-4"
              style={{ color: "var(--ds-gray-600)" }}
            />
            <h3
              className="text-sm font-medium"
              style={{ color: "var(--geist-foreground)" }}
            >
              {filePath}
            </h3>
          </div>
          <div
            className="flex items-center gap-4 text-sm"
            style={{ color: "var(--ds-gray-600)" }}
          >
            <span>{formatFileSize(fileSize)}</span>
            <span>{formatTimestamp(timestamp)}</span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 pt-0">
          {diffText ? (
            <CodeBlock>
              <CodeBlockGroup className="px-4 py-2 border-b">
                <div className="flex items-center gap-2">
                  <div
                    className="px-2 py-1 text-xs font-medium rounded"
                    style={{
                      backgroundColor: "var(--ds-blue-100)",
                      color: "var(--ds-blue-700)",
                    }}
                  >
                    {getLanguage(filePath).toUpperCase()}
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: "var(--ds-gray-600)" }}
                  >
                    Changes in {filePath}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Plus
                      className="h-3 w-3"
                      style={{ color: "var(--ds-green-700)" }}
                    />
                    <span style={{ color: "var(--ds-green-700)" }}>
                      {
                        diffLines.filter((line) => line.type === "addition")
                          .length
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Minus
                      className="h-3 w-3"
                      style={{ color: "var(--ds-red-700)" }}
                    />
                    <span style={{ color: "var(--ds-red-700)" }}>
                      {
                        diffLines.filter((line) => line.type === "deletion")
                          .length
                      }
                    </span>
                  </div>
                </div>
              </CodeBlockGroup>
              <CodeBlockCode
                code={generateDiffCode(diffLines)}
                language="diff"
                theme={theme === "dark" ? "github-dark" : "github-light"}
                className="[&>pre]:!bg-transparent [&>pre]:!p-0"
              />
            </CodeBlock>
          ) : (
            <div
              className="text-center py-8"
              style={{ color: "var(--ds-gray-600)" }}
            >
              <FileText
                className="h-8 w-8 mx-auto mb-2 opacity-50"
                style={{ color: "var(--ds-gray-600)" }}
              />
              <p>No diff available for this file</p>
              <p className="text-sm" style={{ color: "var(--ds-gray-500)" }}>
                This might be the first version of the file
              </p>
            </div>
          )}
        </div>
      )}
    </Material>
  );
}
