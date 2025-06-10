import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { Material } from "@/components/geist/material";
import { StatusDot } from "@/components/geist/status-dot";
import { Skeleton } from "@/components/geist/skeleton";
import { ProjectNavigation } from "@/components/project/project-navigation";
import { ProjectWebSocketProvider } from "@/components/project/project-websocket-provider";
import { ProjectLayoutClient } from "@/components/project/project-layout-client";
import {
  getProjectById,
  getProjectFileHistory,
  getPendingChanges,
} from "@shipvibes/database";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

