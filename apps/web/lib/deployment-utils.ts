import React from "react";
import { Badge } from "@/components/ui/badge";

export type DeployStatus = "ready" | "failed" | "building" | "pending" | "no_deploy";

export const getStatusBadge = (status: string | null, hasDeployUrl?: boolean) => {
  const deployStatus = status || "pending";
  
  // Если статус ready но нет deploy_url - это значит коммит без деплоя
  if (deployStatus === "ready" && !hasDeployUrl) {
    return React.createElement(Badge, {
      variant: "outline",
      className: "bg-muted/50 text-muted-foreground hover:bg-muted"
    }, "No Deploy");
  }
  
  switch (deployStatus) {
    case "ready":
      return React.createElement(Badge, {
        variant: "default",
        className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
      }, "Ready");
    case "failed":
      return React.createElement(Badge, {
        variant: "destructive"
      }, "Failed");
    case "building":
      return React.createElement(Badge, {
        variant: "default",
        className: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
      }, "Building");
    case "no_deploy":
      return React.createElement(Badge, {
        variant: "outline"
      }, "No Deploy");
    case "pending":
    default:
      return React.createElement(Badge, {
        variant: "outline"
      }, "Pending");
  }
}; 