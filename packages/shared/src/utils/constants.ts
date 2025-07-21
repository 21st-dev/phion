// Project constants

// Supported file extensions for synchronization
export const ALLOWED_FILE_EXTENSIONS = [
  // Web files
  "html",
  "htm",
  "css",
  "scss",
  "sass",
  "less",
  // JavaScript/TypeScript
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  // Vue/Svelte
  "vue",
  "svelte",
  // Configuration files
  "json",
  "yaml",
  "yml",
  "toml",
  "ini",
  // Markdown and documentation
  "md",
  "mdx",
  "txt",
  // Images (for web)
  "svg",
  "ico",
  // Other
  "env",
  "gitignore",
  "gitkeep",
];

// Ignored directories and files
export const IGNORED_PATHS = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  "build/**",
  ".next/**",
  ".nuxt/**",
  ".output/**",
  ".turbo/**",
  ".cache/**",
  "coverage/**",
  "*.log",
  ".env.local",
  ".env.*.local",
  ".DS_Store",
  "Thumbs.db",
];

// Maximum sizes
export const MAX_FILE_SIZE = 1024 * 1024 * 5; // 5MB
export const MAX_PROJECT_NAME_LENGTH = 100;
export const MAX_FILES_PER_PROJECT = 1000;

// WebSocket settings
export const WS_RECONNECT_INTERVAL = 5000; // 5 seconds
export const WS_MAX_RECONNECT_ATTEMPTS = 10;
export const WS_HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Deploy settings
export const DEPLOY_TIMEOUT = 300000; // 5 minutes
export const BUILD_TIMEOUT = 180000; // 3 minutes

// Project templates
export const PROJECT_TEMPLATES = {
  "vite-react": {
    name: "Vite + React",
    description: "Modern React project with Vite",
    buildCommand: "npm run build",
    outputDir: "dist",
  },
  "vite-vue": {
    name: "Vite + Vue",
    description: "Vue.js project with Vite",
    buildCommand: "npm run build",
    outputDir: "dist",
  },
  "next-js": {
    name: "Next.js",
    description: "React framework with SSR",
    buildCommand: "npm run build",
    outputDir: "out",
  },
  "nuxt-js": {
    name: "Nuxt.js",
    description: "Vue.js framework with SSR",
    buildCommand: "npm run build",
    outputDir: ".output/public",
  },
  "vanilla-js": {
    name: "Vanilla JavaScript",
    description: "Simple HTML/CSS/JS project",
    buildCommand: null,
    outputDir: ".",
  },
} as const;

// API endpoints
export const API_ENDPOINTS = {
  PROJECTS: "/api/projects",
  PROJECT_DETAIL: (id: string) => `/api/projects/${id}`,
  PROJECT_VERSIONS: (id: string) => `/api/projects/${id}/versions`,
  PROJECT_DIFF: (id: string) => `/api/projects/${id}/diff`,
  PROJECT_REVERT: (id: string) => `/api/projects/${id}/revert`,
  PROJECT_DOWNLOAD: (id: string) => `/api/projects/${id}/download`,
  PROJECT_DEPLOY: (id: string) => `/api/projects/${id}/deploy`,
} as const;
