import { io, Socket } from "socket.io-client";
import chokidar, { FSWatcher } from "chokidar";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface AgentConfig {
  projectId: string;
  wsUrl: string;
  debug?: boolean;
}

export interface FileChange {
  projectId: string;
  filePath: string;
  content: string;
  hash: string;
  timestamp: number;
}

export interface FileDelete {
  projectId: string;
  filePath: string;
  timestamp: number;
}

// Интерфейсы для данных от сервера
export interface AuthenticatedData {
  projectId: string;
}

export interface FileSavedData {
  filePath: string;
}

export interface FileUpdatedData {
  filePath: string;
}

export interface GitPullData {
  token: string;
  repoUrl: string;
}

export interface UpdateFilesData {
  files: Array<{ path: string; content: string }>;
}

export class VybcelAgent {
  private socket: Socket | null = null;
  private watcher: FSWatcher | null = null;
  private isConnected = false;
  private isGitRepo = false;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    console.log("🚀 Vybcel Agent");
    if (this.config.debug) {
      console.log(`📡 Connecting to: ${this.config.wsUrl}`);
      console.log(`🆔 Project ID: ${this.config.projectId}`);
    }

    // Проверяем, что мы в git репозитории
    await this.checkGitRepository();

    // Подключаемся к WebSocket
    await this.connectWebSocket();

    // Запускаем file watcher
    this.startFileWatcher();

    console.log("✅ Agent running - edit files to sync changes");
    console.log("Press Ctrl+C to stop");
  }

  private async checkGitRepository(): Promise<void> {
    try {
      await execAsync("git rev-parse --git-dir");
      this.isGitRepo = true;
      if (this.config.debug) {
        console.log("✅ Git repository detected");
        
        // Проверяем remote origin
        try {
          const { stdout } = await execAsync("git remote get-url origin");
          console.log(`🔗 Remote origin: ${stdout.trim()}`);
        } catch (error) {
          console.log("⚠️ No remote origin configured");
        }
      }
    } catch (error) {
      // Git репозиторий не найден - инициализируем
      if (this.config.debug) {
        console.log("⚠️ Not a git repository - initializing...");
      }
      await this.initializeGitRepository();
    }
  }

  private async initializeGitRepository(): Promise<void> {
    try {
      if (this.config.debug) {
        console.log("🔧 Initializing git repository...");
      }

      // 1. Инициализируем git
      await execAsync("git init");
      
      // 2. Настраиваем remote origin для GitHub репозитория проекта
      const repoUrl = `https://github.com/vybcel/vybcel-project-${this.config.projectId}.git`;
      await execAsync(`git remote add origin ${repoUrl}`);
      
      // 3. Создаем initial commit если файлы уже есть
      try {
        await execAsync("git add .");
        await execAsync('git commit -m "Initial commit from Vybcel template"');
      } catch (commitError) {
        // Files may be empty
      }

      this.isGitRepo = true;
      if (this.config.debug) {
        console.log("✅ Git repository setup completed");
      }
    } catch (error) {
      console.error("❌ Failed to initialize git repository:", (error as Error).message);
      this.isGitRepo = false;
      if (this.config.debug) {
        console.log("⚠️ Git commands will be disabled");
      }
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve) => {
      this.socket = io(this.config.wsUrl, {
        transports: ["websocket"],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });

      this.socket.on("connect", () => {
        if (this.config.debug) {
          console.log("✅ Connected to Vybcel");
        }
        this.socket!.emit("authenticate", {
          projectId: this.config.projectId,
          clientType: "agent",
        });
      });

      this.socket.on("authenticated", (data: AuthenticatedData) => {
        if (this.config.debug) {
          console.log(`🔐 Authenticated for project: ${data.projectId}`);
        }
        this.isConnected = true;
        resolve();
      });

      // Таймаут для подключения
      setTimeout(() => {
        if (!this.isConnected) {
          if (this.config.debug) {
            console.log("⏰ Connection timeout, but continuing anyway...");
          }
          resolve();
        }
      }, 15000);

      this.setupEventHandlers();
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on("file_saved", (data: FileSavedData) => {
      if (this.config.debug) {
        console.log(`💾 File saved: ${data.filePath}`);
      }
    });

    this.socket.on("file_updated", (data: FileUpdatedData) => {
      if (this.config.debug) {
        console.log(`🔄 File updated by another client: ${data.filePath}`);
      }
    });

    this.socket.on("discard_local_changes", async () => {
      console.log("🔄 Discarding local changes...");
      await this.discardLocalChanges();
    });

    this.socket.on("git_pull_with_token", async (data: GitPullData) => {
      console.log("📥 Syncing with latest changes...");
      await this.gitPullWithToken(data.token, data.repoUrl);
    });

    this.socket.on("update_local_files", async (data: UpdateFilesData) => {
      console.log("📄 Updating local files...");
      await this.updateLocalFiles(data.files);
    });

    this.socket.on("error", (error: Error) => {
      console.error("❌ WebSocket error:", error.message);
    });

    this.socket.on("disconnect", (reason: string) => {
      console.log(`❌ Disconnected: ${reason}`);
      this.isConnected = false;

      setTimeout(() => {
        console.log("🔄 Attempting to reconnect...");
        this.socket?.connect();
      }, 5000);
    });

    this.socket.on("connect_error", (error: Error) => {
      console.error("❌ Connection failed:", error.message);
      console.log("🔄 Will retry connection...");
    });
  }

  private async discardLocalChanges(): Promise<void> {
    if (!this.isGitRepo) {
      if (this.config.debug) {
        console.log("⚠️ Not a git repository - cannot discard changes");
      }
      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "discard",
        success: false,
        error: "Not a git repository",
      });
      return;
    }

    try {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
      }

      await execAsync("git reset --hard HEAD");
      await execAsync("git clean -fd");

      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "discard",
        success: true,
      });

      this.startFileWatcher();
      console.log("✅ Changes discarded");
    } catch (error) {
      console.error("❌ Error discarding changes:", (error as Error).message);
      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "discard",
        success: false,
        error: (error as Error).message,
      });
      this.startFileWatcher();
    }
  }

  private async gitPullWithToken(token: string, repoUrl: string): Promise<void> {
    if (!this.isGitRepo) {
      if (this.config.debug) {
        console.log("⚠️ Not a git repository - cannot pull");
      }
      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "pull",
        success: false,
        error: "Not a git repository",
      });
      return;
    }

    try {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
      }

      const authenticatedUrl = repoUrl.replace(
        "https://github.com/",
        `https://x-access-token:${token}@github.com/`
      );

      await execAsync(`git fetch ${authenticatedUrl} main`);
      await execAsync(`git reset --hard FETCH_HEAD`);
      
      console.log("✅ Synced with latest changes");

      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "pull",
        success: true,
      });

      this.startFileWatcher();
    } catch (error) {
      console.error("❌ Error syncing:", (error as Error).message);
      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "pull",
        success: false,
        error: (error as Error).message,
      });
      this.startFileWatcher();
    }
  }

  private async updateLocalFiles(files: Array<{ path: string; content: string }>): Promise<void> {
    try {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
      }

      for (const file of files) {
        try {
          const dir = path.dirname(file.path);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(file.path, file.content, "utf8");
          if (this.config.debug) {
            console.log(`✅ Updated: ${file.path}`);
          }
        } catch (fileError) {
          console.error(`❌ Error updating file ${file.path}:`, (fileError as Error).message);
        }
      }

      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "update_files",
        success: true,
      });

      this.startFileWatcher();
      console.log("✅ Files updated");
    } catch (error) {
      console.error("❌ Error updating files:", (error as Error).message);
      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "update_files",
        success: false,
        error: (error as Error).message,
      });
      this.startFileWatcher();
    }
  }

  private startFileWatcher(): void {
    if (this.watcher) {
      return;
    }

    if (this.config.debug) {
      console.log("👀 Watching for file changes...");
    }

    this.watcher = chokidar.watch(".", {
      ignored: [
        "node_modules/**",
        ".git/**",
        "dist/**",
        "build/**",
        ".next/**",
        ".turbo/**",
        "*.log",
        "vybcel.js",
        ".env*",
      ],
      ignoreInitial: true,
      persistent: true,
    });

    this.watcher.on("change", (filePath: string) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on("add", (filePath: string) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on("unlink", (filePath: string) => {
      this.handleFileDelete(filePath);
    });

    this.watcher.on("error", (error: Error) => {
      console.error("❌ File watcher error:", error);
    });
  }

  private async handleFileChange(filePath: string): Promise<void> {
    if (!this.isConnected) {
      if (this.config.debug) {
        console.log(`⏳ Not connected, skipping: ${filePath}`);
      }
      return;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const hash = crypto.createHash("sha256").update(content).digest("hex");

      if (this.config.debug) {
        console.log(`📝 Syncing: ${filePath}`);
      }

      const fileChange: FileChange = {
        projectId: this.config.projectId,
        filePath: filePath.replace(/\\/g, "/"),
        content: content,
        hash: hash,
        timestamp: Date.now(),
      };

      this.socket?.emit("file_change", fileChange);
    } catch (error) {
      console.error(`❌ Error reading file ${filePath}:`, (error as Error).message);
    }
  }

  private handleFileDelete(filePath: string): void {
    if (!this.isConnected) {
      if (this.config.debug) {
        console.log(`⏳ Queuing deletion: ${filePath} (not connected)`);
      }
      return;
    }

    if (this.config.debug) {
      console.log(`🗑️ Deleted: ${filePath}`);
    }

    const fileDelete: FileDelete = {
      projectId: this.config.projectId,
      filePath: filePath.replace(/\\/g, "/"),
      timestamp: Date.now(),
    };

    this.socket?.emit("file_delete", fileDelete);
  }

  stop(): void {
    console.log("🛑 Stopping agent...");

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    console.log("✅ Stopped");
  }
} 