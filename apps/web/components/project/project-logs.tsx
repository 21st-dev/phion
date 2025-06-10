"use client";

import { useState, useEffect } from "react";
import { Material } from "@/components/geist/material";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  GitCommit,
  Activity,
  Users,
  AlertCircle,
  CheckCircle,
  Loader,
} from "lucide-react";

interface ProjectLogEntry {
  timestamp: string;
  projectId: string;
  eventType: string;
  description: string;
  triggeredBy?: string;
  metadata?: Record<string, any>;
}

interface ProjectStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  firstEvent?: string;
  lastEvent?: string;
}

interface ProjectLogsProps {
  projectId: string;
}

export function ProjectLogs({ projectId }: ProjectLogsProps) {
  const [logs, setLogs] = useState<ProjectLogEntry[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventType, setSelectedEventType] = useState<string>("all");

  useEffect(() => {
    fetchLogs();
  }, [projectId, selectedEventType]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedEventType !== "all") {
        params.set("type", selectedEventType);
      }

      const response = await fetch(`/api/projects/${projectId}/logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case "project_created":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "file_changed":
      case "file_deleted":
        return <FileText className="h-4 w-4 text-orange-500" />;
      case "commit_created":
        return <GitCommit className="h-4 w-4 text-green-500" />;
      case "deploy_started":
      case "deploy_building":
        return <Loader className="h-4 w-4 text-yellow-500" />;
      case "deploy_completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "deploy_failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "agent_connected":
      case "agent_disconnected":
        return <Users className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (loading) {
    return (
      <Material type="base" className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading logs...</span>
        </div>
      </Material>
    );
  }

  return (
    <div className="space-y-6">
      <Material type="base" className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Project Logs</h2>
            <Button onClick={fetchLogs} size="sm" variant="outline">
              Refresh
            </Button>
          </div>

          <div className="h-[500px] overflow-y-auto">
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No logs found for this project
                </div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {getEventTypeIcon(log.eventType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge>{formatEventType(log.eventType)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {log.triggeredBy && (
                          <span className="text-xs text-muted-foreground">
                            via {log.triggeredBy}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">
                        {log.description}
                      </p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Show metadata
                          </summary>
                          <pre className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Material>
    </div>
  );
}
