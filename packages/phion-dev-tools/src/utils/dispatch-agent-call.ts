import * as vscode from "vscode"
import { callCursorAgent } from "./call-cursor-agent"
import { getCurrentIDE } from "./get-current-ide"
import type { PromptRequest } from "./types"

export async function dispatchAgentCall(request: PromptRequest) {
  const ide = getCurrentIDE()
  switch (ide) {
    case "CURSOR":
      return await callCursorAgent(request)
    case "UNKNOWN":
      vscode.window.showErrorMessage("Failed to call agent: IDE is not supported")
  }
}
