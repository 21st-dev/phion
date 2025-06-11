"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusBadge } from "@/lib/deployment-utils";
import { motion, AnimatePresence } from "motion/react";

import {
  GitCommit,
  ChevronRight,
  FileText,
  Plus,
  Minus,
  Edit,
  RotateCcw,
  ExternalLink,
  Globe,
  Clock,
  XCircle,
  Loader2,
  Save,
  X,
  AlertCircle,
} from "lucide-react";
import { useProject } from "@/components/project/project-layout-client";

interface FileChange {
  file_path: string;
  change_type: "create" | "update" | "delete";
  additions?: number;
  deletions?: number;
}

interface Commit {
  commit_id: string;
  commit_message: string;
  created_at: string;
  files_count: number;
  file_changes?: FileChange[];
}

interface Deployment {
  id: string;
  commit_id: string;
  status: "building" | "ready" | "failed" | "pending" | "no_deploy";
  deploy_url?: string;
  created_at: string;
  build_time?: number;
  error_message?: string;
}

interface PendingChange {
  id: string;
  file_path: string;
  action: string;
  content?: string;
  created_at: string;
}

interface PendingChangesCardProps {
  pendingChanges: PendingChange[];
  onSaveAll: () => void;
  onDiscardAll: () => void;
  isLoading: boolean;
}

function PendingChangesCard({
  pendingChanges,
  onSaveAll,
  onDiscardAll,
  isLoading,
}: PendingChangesCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (pendingChanges.length === 0) {
    return null;
  }

  const getChangeIcon = (action: string) => {
    switch (action) {
      case "create":
        return <Plus className="h-3 w-3 text-primary" />;
      case "delete":
        return <Minus className="h-3 w-3 text-destructive" />;
      case "modified":
      default:
        return <Edit className="h-3 w-3 text-primary" />;
    }
  };

  return (
    <div className="border rounded-lg bg-card border-border bg-muted/50">
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground truncate">
                Draft Changes
              </h3>
              <Badge variant="outline">Draft</Badge>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>{pendingChanges.length} files changed</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Unsaved</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDiscardAll();
              }}
              disabled={isLoading}
            >
              <X className="h-3 w-3 mr-1" />
              Discard
            </Button>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSaveAll();
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              {isLoading ? "Saving..." : "Save & Publish"}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="border-t bg-muted/25 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Draft Details */}
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Draft Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="text-muted-foreground">
                    <strong>Status:</strong> Unsaved changes
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Files changed:</strong> {pendingChanges.length}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Action:</strong> Save to publish
                  </div>
                </div>
              </motion.div>

              {/* Changed Files */}
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  Changed Files
                </h5>
                <div className="space-y-1">
                  {pendingChanges.map((change) => (
                    <motion.div
                      key={change.id}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 text-sm p-2 rounded bg-background"
                    >
                      {getChangeIcon(change.action)}
                      <span className="font-mono text-sm flex-1">
                        {change.file_path}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {change.action}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DeploymentItemProps {
  deployment: Deployment;
  commit?: Commit;
  onRevert?: (commitId: string) => void;
  isLatest?: boolean;
}

function DeploymentItem({
  deployment,
  commit,
  onRevert,
  isLatest,
}: DeploymentItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case "create":
        return <Plus className="h-3 w-3 text-primary" />;
      case "delete":
        return <Minus className="h-3 w-3 text-destructive" />;
      case "update":
      default:
        return <Edit className="h-3 w-3 text-primary" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else {
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days !== 1 ? "s" : ""} ago`;
    }
  };

  return (
    <div className="border rounded-lg bg-card">
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground truncate">
                {commit?.commit_message || "Publish"}
              </h3>
              {getStatusBadge(deployment.status, !!deployment.deploy_url)}
              {isLatest && (
                <Badge variant="outline" className="text-xs">
                  Latest
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <GitCommit className="h-3 w-3" />
                <span>
                  {deployment.commit_id?.substring(0, 8) || "unknown"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatDate(deployment.created_at)}</span>
              </div>
              {commit && <span>{commit.files_count} files changed</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deployment.status === "ready" && deployment.deploy_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(deployment.deploy_url, "_blank");
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
            {!isLatest && onRevert && commit && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRevert(commit.commit_id);
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Revert
              </Button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="border-t bg-muted/25 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Deployment Details */}
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Publication Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="text-muted-foreground">
                    <strong>Publication ID:</strong>{" "}
                    {deployment.id?.substring(0, 8) || "unknown"}...
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Status:</strong> {deployment.status}
                  </div>
                  {deployment.deploy_url && (
                    <div className="text-muted-foreground">
                      <strong>URL:</strong>{" "}
                      <a
                        href={deployment.deploy_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {deployment.deploy_url}
                      </a>
                    </div>
                  )}
                  {deployment.build_time && (
                    <div className="text-muted-foreground">
                      <strong>Build Time:</strong> {deployment.build_time}s
                    </div>
                  )}
                  {deployment.error_message && (
                    <div className="text-destructive">
                      <strong>Error:</strong> {deployment.error_message}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Commit Details */}
              {commit && (
                <motion.div
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <GitCommit className="h-4 w-4" />
                    Commit Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="text-muted-foreground">
                      <strong>Commit ID:</strong>{" "}
                      {commit.commit_id?.substring(0, 8) || "unknown"}...
                    </div>
                    <div className="text-muted-foreground">
                      <strong>Files changed:</strong> {commit.files_count}
                    </div>
                    <div className="text-muted-foreground">
                      <strong>Date:</strong>{" "}
                      {new Date(commit.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* File Changes */}
                  {commit.file_changes && commit.file_changes.length > 0 && (
                    <motion.div
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3"
                    >
                      <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        Changed Files
                      </h5>
                      <div className="space-y-1">
                        {commit.file_changes.map((change, index) => (
                          <motion.div
                            key={index}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-2 text-sm p-2 rounded bg-background"
                          >
                            {getChangeIcon(change.change_type)}
                            <span className="font-mono text-sm flex-1">
                              {change.file_path}
                            </span>
                            {change.additions !== undefined && (
                              <span className="text-primary text-xs">
                                +{change.additions}
                              </span>
                            )}
                            {change.deletions !== undefined && (
                              <span className="text-destructive text-xs">
                                -{change.deletions}
                              </span>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DeploymentsListProps {
  onRevert?: (commitId: string) => void;
}

export function DeploymentsList({ onRevert }: DeploymentsListProps) {
  const {
    history,
    project,
    pendingChanges,
    saveAllChanges,
    discardAllChanges,
    isSaving,
    lastUpdated,
    agentConnected,
  } = useProject();

  // Вспомогательная функция для безопасного преобразования статуса
  const getValidDeployStatus = (
    status: string | null
  ): Deployment["status"] => {
    if (!status) return "no_deploy";
    if (["building", "ready", "failed", "pending"].includes(status)) {
      return status as "building" | "ready" | "failed" | "pending";
    }
    return "no_deploy";
  };

  // Логируем изменения в history
  useEffect(() => {
    console.log("🚀 [DeploymentsList] History updated:", {
      historyLength: history?.length || 0,
      history: history,
      willShowWaitingCard: !history || history.length === 0,
    });
  }, [history]);

  // Логируем изменения статуса деплоя
  useEffect(() => {
    console.log("🔄 [DeploymentsList] Deploy status updated:", {
      deployStatus: project.deploy_status,
      netlifyUrl: project.netlify_url,
      lastUpdated: lastUpdated.toISOString(),
      agentConnected,
    });
  }, [project.deploy_status, project.netlify_url, lastUpdated, agentConnected]);

  if (!history || history.length === 0) {
    return (
      <div className="space-y-4">
        {/* Pending Changes Card */}
        <PendingChangesCard
          pendingChanges={pendingChanges}
          onSaveAll={saveAllChanges}
          onDiscardAll={discardAllChanges}
          isLoading={isSaving}
        />

        {/* Показываем карточку в зависимости от статуса */}
        {project.deploy_status === "failed" ? (
          // Карточка ошибки инициализации
          <div className="border rounded-lg bg-card border-border border-destructive/20">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-4 w-4 text-destructive mt-1" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">
                      Project setup failed
                    </h3>
                    {getStatusBadge("failed")}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>Initialization error</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Setup failed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Карточка инициализации проекта
          <div className="border rounded-lg bg-card border-border">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <Loader2 className="h-4 w-4 text-muted-foreground mt-1 animate-spin" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">
                      Setting up project
                    </h3>
                    {getStatusBadge("pending")}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      <span>Preparing template files</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>In progress</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Changes Card */}
      <PendingChangesCard
        pendingChanges={pendingChanges}
        onSaveAll={saveAllChanges}
        onDiscardAll={discardAllChanges}
        isLoading={isSaving}
      />

      {/* Deployments List */}
      {history.map((commit: Commit, index) => {
        const isLatest = index === 0;

        // Создаем объект деплоймента на основе коммита
        const deployment: Deployment = {
          id: `deploy_${commit.commit_id?.substring(0, 8) || "unknown"}`,
          commit_id: commit.commit_id || "",
          status: isLatest
            ? getValidDeployStatus(project.deploy_status)
            : "no_deploy", // Старые коммиты не имеют активного деплоя
          deploy_url: isLatest ? project.netlify_url || undefined : undefined,
          created_at: commit.created_at,
        };

        return (
          <DeploymentItem
            key={deployment.id}
            deployment={deployment}
            commit={commit}
            onRevert={onRevert}
            isLatest={isLatest}
          />
        );
      })}
    </div>
  );
}
