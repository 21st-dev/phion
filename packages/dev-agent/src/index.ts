export { PhionAgent, type AgentConfig, type FileChange, type FileDelete } from "./agent.js"
export { getCurrentVersion, checkForUpdates } from "./version-checker.js"
export { openPreview, detectVSCode, type VSCodeConfig } from "./vscode-utils.js"

// Vite plugin exports
export { phionPlugin as plugin } from "./plugin.js"

// Next.js plugin exports
export { withPhionToolbar, createToolbarHandler } from "./plugin-next.js"

export type {
  PhionConfig,
  PhionPluginOptions,
  ToolbarVersion,
  UpdateCheckResponse,
} from "./types.js"
