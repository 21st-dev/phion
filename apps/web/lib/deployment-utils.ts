import React from "react"
import { Badge } from "@/components/ui/badge"

export type DeployStatus = "ready" | "failed" | "building" | "pending" | "no_deploy"

export const getStatusBadge = (status: string | null, hasDeployUrl?: boolean) => {
  const deployStatus = status || "pending"

      // If status is ready but no deploy_url - this means commit without deploy
  if (deployStatus === "ready" && !hasDeployUrl) {
    return React.createElement(
      Badge,
      {
        variant: "outline",
        className: "bg-muted/50 text-muted-foreground hover:bg-muted",
      },
      "Not Published",
    )
  }

  switch (deployStatus) {
    case "ready":
      return React.createElement(
        Badge,
        {
          variant: "outline",
          className:
            "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/20",
        },
        "Live",
      )
    case "failed":
      return React.createElement(
        Badge,
        {
          variant: "outline",
          className:
            "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/20",
        },
        "Failed",
      )
    case "building":
      return React.createElement(
        Badge,
        {
          variant: "outline",
          className:
            "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/20",
        },
        "Publishing",
      )
    case "no_deploy":
      return React.createElement(
        Badge,
        {
          variant: "outline",
          className: "text-muted-foreground hover:bg-muted/50",
        },
        "Not Published",
      )
    case "pending":
    default:
      return React.createElement(
        Badge,
        {
          variant: "outline",
          className: "text-muted-foreground hover:bg-muted/50",
        },
        "Pending",
      )
  }
}
