"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Terminal,
  Play,
  CheckCircle,
  Copy,
  FolderOpen,
  Zap,
} from "lucide-react";
import type { ProjectRow } from "@shipvibes/database";

interface ProjectOnboardingProps {
  project: ProjectRow;
}

export function ProjectOnboarding({ project }: ProjectOnboardingProps) {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

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

  const copyToClipboard = async (text: string, stepNumber: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStep(stepNumber);
      setTimeout(() => setCopiedStep(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const macroCommand = "pnpm start";

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2">
              <Zap className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900">
                Project Ready for Setup
              </h3>
              <p className="text-sm text-amber-700">
                Your project has been created but hasn't been started yet.
                Follow the steps below to begin development.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900">
            <Play className="h-5 w-5" />
            Quick Start (Recommended)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-green-700">
            Use this single command to download, install dependencies, start
            development server, and enable sync:
          </p>

          <div className="bg-green-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Badge
                variant="secondary"
                className="bg-green-200 text-green-800"
              >
                One-command setup
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(macroCommand, 0)}
                className="text-green-700 hover:text-green-900"
              >
                {copiedStep === 0 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <code className="text-sm font-mono text-green-900 block">
              {macroCommand}
            </code>
          </div>

          <div className="text-xs text-green-600 space-y-1">
            <p>• Downloads and extracts your project</p>
            <p>• Installs all dependencies</p>
            <p>• Starts development server (localhost:5173)</p>
            <p>• Enables real-time sync with Shipvibes</p>
          </div>
        </CardContent>
      </Card>

      {/* Step by Step */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Step-by-Step Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Download */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-blue-600">1</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download Project
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Download your project template and extract it to your desired
                location.
              </p>
              <Button onClick={handleDownload} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download {project.name}.zip
              </Button>
            </div>
          </div>

          {/* Step 2: Open in Editor */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-blue-600">2</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Open in Editor
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Extract the ZIP file and open the project folder in your code
                editor (Cursor, VS Code, etc.).
              </p>
            </div>
          </div>

          {/* Step 3: Install Dependencies */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-blue-600">3</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Install Dependencies
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Open terminal in the project folder and install dependencies.
              </p>
              <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
                <code className="text-sm font-mono">pnpm install</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard("pnpm install", 3)}
                >
                  {copiedStep === 3 ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Step 4: Start Development */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-blue-600">4</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Play className="h-4 w-4" />
                Start Development & Sync
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Start the development server and enable real-time sync with
                Shipvibes.
              </p>
              <div className="space-y-2">
                <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
                  <code className="text-sm font-mono">pnpm dev</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard("pnpm dev", 4)}
                  >
                    {copiedStep === 4 ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
                  <code className="text-sm font-mono">pnpm sync</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard("pnpm sync", 5)}
                  >
                    {copiedStep === 5 ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Run these commands in separate terminal windows, or use the
                quick start command above.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What happens next */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <h4 className="font-semibold text-blue-900 mb-2">
            What happens next?
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>
              • Your local development server will start at
              http://localhost:5173
            </li>
            <li>
              • The sync agent will connect to Shipvibes and monitor file
              changes
            </li>
            <li>
              • Every time you save a file, it will be automatically synced to
              the cloud
            </li>
            <li>
              • This page will update to show your file history and changes
            </li>
            <li>• Your project will be automatically deployed to a live URL</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
