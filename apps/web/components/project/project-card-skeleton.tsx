"use client";

import { Material } from "@/components/geist/material";
import { Skeleton } from "@/components/geist/skeleton";

export function ProjectCardSkeleton() {
  return (
    <Material
      type="base"
      className="p-6 hover:shadow-border-medium transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Project name and status */}
          <div className="flex items-center space-x-3 mb-2">
            <Skeleton width="200px" height="28px" animated={true} />
            <Skeleton width="60px" height="20px" pill animated={true} />
          </div>

          {/* Project URL placeholder */}
          <div className="mb-3">
            <Skeleton width="300px" height="16px" animated={true} />
          </div>

          {/* Timestamps */}
          <div className="flex items-center space-x-4 text-xs">
            <Skeleton width="80px" height="12px" animated={true} />
            <span className="text-muted-foreground">•</span>
            <Skeleton width="90px" height="12px" animated={true} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          <Skeleton width="60px" height="32px" animated={true} />
          <Skeleton width="50px" height="32px" animated={true} />
        </div>
      </div>
    </Material>
  );
}
