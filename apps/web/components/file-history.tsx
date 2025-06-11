"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GitCommit,
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  FileText,
  Plus,
  Minus,
  Edit,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileChange {
  file_path: string;
  change_type: "create" | "update" | "delete";
  additions?: number;
  deletions?: number;
}

interface Commit {
  id: string;
  message: string;
  created_at: string;
  author_email?: string;
  file_changes: FileChange[];
}

interface FileHistoryProps {
  projectId: string;
  onRevert?: (commitId: string) => void;
}

export function FileHistory({ projectId, onRevert }: FileHistoryProps) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    fetchCommits();
  }, [projectId]);

  const fetchCommits = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/versions`);

      if (!response.ok) {
        throw new Error("Failed to fetch commits");
      }

      const data = await response.json();
      setCommits(data.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const toggleCommitExpansion = (commitId: string) => {
    const newExpanded = new Set(expandedCommits);
    if (newExpanded.has(commitId)) {
      newExpanded.delete(commitId);
    } else {
      newExpanded.add(commitId);
    }
    setExpandedCommits(newExpanded);
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case "create":
        return <Plus className="h-3 w-3 text-green-600" />;
      case "delete":
        return <Minus className="h-3 w-3 text-red-600" />;
      case "update":
      default:
        return <Edit className="h-3 w-3 text-blue-600" />;
    }
  };

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case "create":
        return "text-green-600 bg-green-50";
      case "delete":
        return "text-red-600 bg-red-50";
      case "update":
      default:
        return "text-blue-600 bg-blue-50";
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            File History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p>Error loading file history: {error}</p>
            <Button variant="outline" onClick={fetchCommits} className="mt-2">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (commits.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            File History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <GitCommit className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No commits yet
            </h3>
            <p className="text-sm text-muted-foreground">
              Make some changes and save them to see your project history here.
            </p>
            <div className="mt-4 text-xs text-muted-foreground bg-muted p-2 rounded">
              💡 Tip: Every time you save changes, a new commit is created
              automatically
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCommit className="h-5 w-5" />
          File History
          <Badge variant="secondary">{commits.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {commits.map((commit, index) => {
            const isExpanded = expandedCommits.has(commit.id);
            const isLatest = index === 0;

            return (
              <div key={commit.id} className="border rounded-lg">
                <div
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCommitExpansion(commit.id)}
                >
                  <div className="flex items-start gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <GitCommit className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">
                          {commit.message}
                        </h3>
                        {isLatest && (
                          <Badge variant="default" className="text-xs">
                            Latest
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground ml-4 flex-shrink-0">
                        {formatDate(commit.created_at)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{commit.file_changes.length} files changed</span>
                        {commit.author_email && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {commit.author_email}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {!isLatest && onRevert && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRevert(commit.id);
                        }}
                        className="ml-2"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Revert
                      </Button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-muted bg-muted/25">
                    <div className="p-4">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Changed Files ({commit.file_changes.length})
                      </h4>
                      <div className="space-y-2">
                        {commit.file_changes.map((change, changeIndex) => (
                          <div
                            key={changeIndex}
                            className="flex items-center gap-2 text-sm"
                          >
                            {getChangeIcon(change.change_type)}
                            <span className="text-muted-foreground flex-grow">
                              {change.file_path}
                            </span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                getChangeColor(change.change_type)
                              )}
                            >
                              {change.change_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {change.additions && `+${change.additions}`}
                              {change.deletions && ` -${change.deletions}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
