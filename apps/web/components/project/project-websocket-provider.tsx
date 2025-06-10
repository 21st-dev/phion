"use client";

import React from "react";

interface ProjectWebSocketProviderProps {
  project: any;
  initialHistory?: any[];
  initialPendingChanges?: any[];
  children: React.ReactNode;
}

export function ProjectWebSocketProvider({
  children,
}: ProjectWebSocketProviderProps) {
  return <>{children}</>;
}
