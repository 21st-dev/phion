"use client";

import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";
import { CreateProjectDialog } from "@/components/create-project-dialog";

export function EmptyState() {
  return (
    <Material type="base" className="p-12 text-center">
      <div className="max-w-sm mx-auto">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="text-gray-600"
          >
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 17L12 22L22 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Content */}
        <h3 className="text-xl font-semibold text-gray-1000 mb-2">
          No projects yet
        </h3>
        <p className="text-gray-700 mb-6">
          Create your first project to start building and deploying your
          frontend applications.
        </p>

        {/* Action */}
        <CreateProjectDialog
          trigger={
            <Button type="primary" size="medium">
              Create Project
            </Button>
          }
        />
      </div>
    </Material>
  );
}
