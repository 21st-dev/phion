"use client";

import { useState, useEffect } from "react";
import { Material } from "@/components/geist/material";
import {
  Rocket,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";

interface SavePointItem {
  commit_id: string;
  commit_message: string;
  created_at: string;
  project_id: string;
}

interface RecentDeploysProps {
  projectId: string;
}

export function RecentDeploys({ projectId }: RecentDeploysProps) {
  const [savePoints, setSavePoints] = useState<SavePointItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSavePoints();
  }, [projectId]);

  const fetchSavePoints = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/commits`);
      if (!response.ok) {
        throw new Error("Failed to fetch save points");
      }
      const data = await response.json();
      setSavePoints(data.commits?.slice(0, 5) || []); // Показываем только последние 5
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const getDeployStatus = (savePoint: SavePointItem) => {
    // Логика определения статуса деплоя на основе времени
    const now = new Date();
    const saveTime = new Date(savePoint.created_at);
    const diffMinutes = (now.getTime() - saveTime.getTime()) / (1000 * 60);

    if (diffMinutes < 2) return "building";
    if (diffMinutes < 5) return "deploying";
    return "deployed";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "building":
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case "deploying":
        return <Rocket className="h-4 w-4 text-blue-500" />;
      case "deployed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${Math.floor(diffMinutes)}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <Material className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Recent Saves</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="h-4 w-4 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </Material>
    );
  }

  if (error) {
    return (
      <Material className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Recent Saves</h3>
        </div>
        <div className="text-center py-4">
          <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </Material>
    );
  }

  return (
    <Material className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Recent Saves</h3>
        {savePoints.length > 0 && (
          <ExternalLink className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {savePoints.length === 0 ? (
        <div className="text-center py-8">
          <Rocket className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No saves yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Start editing your files to see saves here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {savePoints.map((savePoint, index) => {
            const status = getDeployStatus(savePoint);
            return (
              <div
                key={savePoint.commit_id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {savePoint.commit_message}
                    </p>
                    <p className="text-xs text-gray-500">
                      Save point #{savePoints.length - index}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {index === 0 && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      Latest
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {formatDate(savePoint.created_at)}
                  </span>
                </div>
              </div>
            );
          })}

          {savePoints.length >= 5 && (
            <div className="text-center pt-2">
              <span className="text-sm text-gray-500">
                Showing latest 5 saves
              </span>
            </div>
          )}
        </div>
      )}
    </Material>
  );
}
