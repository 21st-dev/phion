export { VybcelAgent, type AgentConfig, type FileChange, type FileDelete } from "./agent.js";
export { getCurrentVersion, checkForUpdates, isNewerVersion, type VersionInfo } from "./version-checker.js";
export { openPreview, detectVSCode, type VSCodeConfig } from "./vscode-utils.js";

// Vite plugin exports
export { vybcelPlugin as plugin } from "./plugin.js";
export type { VybcelConfig, VybcelPluginOptions, ToolbarVersion, UpdateCheckResponse } from "./types.js"; 