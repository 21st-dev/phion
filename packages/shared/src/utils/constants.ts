// Константы для проекта

// Поддерживаемые расширения файлов для синхронизации
export const ALLOWED_FILE_EXTENSIONS = [
  // Web файлы
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
  // Конфигурационные файлы
  "json",
  "yaml",
  "yml",
  "toml",
  "ini",
  // Markdown и документация
  "md",
  "mdx",
  "txt",
  // Изображения (для веб)
  "svg",
  "ico",
  // Другие
  "env",
  "gitignore",
  "gitkeep",
]

// Игнорируемые директории и файлы
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
]

// Максимальные размеры
export const MAX_FILE_SIZE = 1024 * 1024 * 5 // 5MB
export const MAX_PROJECT_NAME_LENGTH = 100
export const MAX_FILES_PER_PROJECT = 1000

// WebSocket настройки
export const WS_RECONNECT_INTERVAL = 5000 // 5 секунд
export const WS_MAX_RECONNECT_ATTEMPTS = 10
export const WS_HEARTBEAT_INTERVAL = 30000 // 30 секунд

// Деплой настройки
export const DEPLOY_TIMEOUT = 300000 // 5 минут
export const BUILD_TIMEOUT = 180000 // 3 минуты

// Шаблоны проектов
export const PROJECT_TEMPLATES = {
  vite: {
    name: "Vite + React",
    description: "Modern React development with Vite",
    buildCommand: "npm run build",
    outputDir: "dist",
    platform: "netlify",
    icon: "⚡",
  },
  nextjs: {
    name: "Next.js",
    description: "Full-stack React framework with SSR",
    buildCommand: "npm run build",
    outputDir: ".next",
    platform: "vercel",
    icon: "▲",
  },
} as const

// API endpoints
export const API_ENDPOINTS = {
  PROJECTS: "/api/projects",
  PROJECT_DETAIL: (id: string) => `/api/projects/${id}`,
  PROJECT_VERSIONS: (id: string) => `/api/projects/${id}/versions`,
  PROJECT_DIFF: (id: string) => `/api/projects/${id}/diff`,
  PROJECT_REVERT: (id: string) => `/api/projects/${id}/revert`,
  PROJECT_DOWNLOAD: (id: string) => `/api/projects/${id}/download`,
  PROJECT_DEPLOY: (id: string) => `/api/projects/${id}/deploy`,
} as const
