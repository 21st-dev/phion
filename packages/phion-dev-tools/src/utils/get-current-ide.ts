import * as vscode from "vscode"

export type IDE = "VSCODE" | "WINDSURF" | "CURSOR" | "UNKNOWN"

export function getCurrentIDE(): IDE {
  if (vscode.env.appName.toLowerCase().includes("cursor")) {
    return "CURSOR"
  }
  return "UNKNOWN"
}
