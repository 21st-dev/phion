"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Material } from "@/components/geist/material";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/geist/status-dot";
import { Toggle } from "@/components/geist/toggle";
import { AlertTriangle, RefreshCw, Globe, Package, Clock } from "lucide-react";
import { useProject } from "@/components/project/project-layout-client";
import { RecentDeploys } from "@/components/project/recent-deploys";
import { useState, useEffect } from "react";

export default function ProjectOverviewPage() {
  const { project, pendingChanges, agentConnected, lastUpdated } = useProject();
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState<string>("");
  const [dateDisplay, setDateDisplay] = useState<string>("");

  // Fix hydration mismatch by updating time only on client side
  useEffect(() => {
    setTimeDisplay(lastUpdated.toLocaleTimeString());
    setDateDisplay(lastUpdated.toLocaleDateString());
  }, [lastUpdated]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Add refresh logic here
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="space-y-8">
      {/* Project Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
            <StatusDot state={agentConnected ? "READY" : "ERROR"} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agentConnected ? "Connected" : "Offline"}
            </div>
            <p className="text-xs text-muted-foreground">
              {agentConnected ? "Syncing files" : "Not syncing"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Changes
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingChanges.length}</div>
            <p className="text-xs text-muted-foreground">
              {pendingChanges.length > 0 ? "Ready to deploy" : "All synced"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deploy Status</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.deploy_status === "ready" ? "Live" : "Building"}
            </div>
            <p className="text-xs text-muted-foreground">
              {project.netlify_url ? "Available online" : "Not deployed"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeDisplay || "Loading..."}
            </div>
            <p className="text-xs text-muted-foreground">
              {dateDisplay || "Loading..."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Changes Alert */}
      {pendingChanges.length > 0 && (
        <Material type="base" className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-amber-900">
                {pendingChanges.length} pending changes
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                You have unsaved changes that haven't been deployed yet.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingChanges.slice(0, 5).map((change) => (
                  <Badge key={change.id} variant="outline" className="text-xs">
                    {change.file_path}
                  </Badge>
                ))}
                {pendingChanges.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{pendingChanges.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Material>
      )}

      {/* Recent Deploys */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Deployments</h2>
          {project.netlify_url && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                project.netlify_url &&
                window.open(project.netlify_url, "_blank")
              }
            >
              <Globe className="w-4 h-4 mr-2" />
              View Live Site
            </Button>
          )}
        </div>

        <RecentDeploys projectId={project.id} />
      </div>

      {/* Quick Actions */}
      <Material type="base" className="p-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-1000 mb-4">
            Quick Actions
          </h4>
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {!isRefreshing && <RefreshCw className="w-4 h-4 mr-2" />}
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">Auto-refresh</span>
              <Toggle
                checked={autoRefreshEnabled}
                onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
              />
            </div>
          </div>
        </div>
      </Material>
    </div>
  );
}
