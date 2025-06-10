#!/usr/bin/env node

import { io } from "socket.io-client";
import chokidar from "chokidar";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Конфигурация
const PROJECT_ID = process.env.SHIPVIBES_PROJECT_ID || "__PROJECT_ID__"; // Заменяется при генерации
const WS_URL = process.env.SHIPVIBES_WS_URL || "ws://localhost:8080";
// Убираем автосохранение - все изменения отправляются сразу

class ShipvibesAgent {
  constructor() {
    this.socket = null;
    this.watcher = null;
    this.isConnected = false;
    this.isGitRepo = false;
    // Убираем pending changes - отправляем изменения сразу
  }

  async start() {
    console.log("🚀 Shipvibes Development Agent");
    console.log(`📡 Connecting to: ${WS_URL}`);
    console.log(`🆔 Project ID: ${PROJECT_ID}`);
    console.log("");

    // Проверяем, что мы в git репозитории
    await this.checkGitRepository();

    // Подключаемся к WebSocket
    await this.connectWebSocket();

    // Запускаем file watcher
    this.startFileWatcher();

    console.log("✅ Shipvibes Agent is running!");
    console.log("📝 Edit your files and see changes sync automatically");
    console.log("🌐 Check your Shipvibes dashboard for updates");
    if (this.isGitRepo) {
      console.log("🔄 Git commands available for sync and rollback");
    }
    console.log("");
    console.log("Press Ctrl+C to stop");
  }

  async checkGitRepository() {
    try {
      await execAsync("git rev-parse --git-dir");
      this.isGitRepo = true;
      console.log("✅ Git repository detected");

      // Проверяем remote origin
      try {
        const { stdout } = await execAsync("git remote get-url origin");
        console.log(`🔗 Remote origin: ${stdout.trim()}`);
      } catch (error) {
        console.log("⚠️ No remote origin configured");
      }
    } catch (error) {
      this.isGitRepo = false;
      console.log("⚠️ Not a git repository - git commands will be disabled");
    }
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      this.socket = io(WS_URL, {
        transports: ["websocket"],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });

      this.socket.on("connect", () => {
        console.log("✅ Connected to Shipvibes");

        // Аутентификация
        this.socket.emit("authenticate", {
          projectId: PROJECT_ID,
          clientType: "agent",
        });
      });

      this.socket.on("authenticated", (data) => {
        console.log(`🔐 Authenticated for project: ${data.projectId}`);
        this.isConnected = true;
        resolve();
      });

      // Таймаут для подключения
      setTimeout(() => {
        if (!this.isConnected) {
          console.log("⏰ Connection timeout, but continuing anyway...");
          resolve();
        }
      }, 15000);

      this.socket.on("file_saved", (data) => {
        console.log(`💾 File saved: ${data.filePath}`);
      });

      this.socket.on("file_updated", (data) => {
        console.log(`🔄 File updated by another client: ${data.filePath}`);
      });

      // Новые обработчики для git команд
      this.socket.on("discard_local_changes", async (data) => {
        console.log("🔄 Received discard local changes command");
        await this.discardLocalChanges();
      });

      this.socket.on("git_pull_with_token", async (data) => {
        console.log("📥 Received git pull command with token");
        await this.gitPullWithToken(data.token, data.repoUrl);
      });

      this.socket.on("update_local_files", async (data) => {
        console.log("📄 Received file updates from server");
        await this.updateLocalFiles(data.files);
      });

      this.socket.on("error", (error) => {
        console.error("❌ WebSocket error:", error.message);
      });

      this.socket.on("disconnect", (reason) => {
        console.log(`❌ Disconnected: ${reason}`);
        this.isConnected = false;

        // Попытка переподключения
        setTimeout(() => {
          console.log("🔄 Attempting to reconnect...");
          this.socket.connect();
        }, 5000);
      });

      this.socket.on("connect_error", (error) => {
        console.error("❌ Connection failed:", error.message);
        console.log("🔄 Will retry connection...");
        // Не отклоняем сразу, даем возможность переподключиться
      });
    });
  }

  /**
   * Откат всех локальных изменений через git reset
   */
  async discardLocalChanges() {
    if (!this.isGitRepo) {
      console.log("⚠️ Not a git repository - cannot discard changes");
      this.socket?.emit("git_command_result", {
        projectId: PROJECT_ID,
        command: "discard",
        success: false,
        error: "Not a git repository",
      });
      return;
    }

    try {
      console.log("🔄 Discarding all local changes...");

      // Останавливаем file watcher на время git операций
      if (this.watcher) {
        this.watcher.close();
      }

      // 1. git reset --hard HEAD (откат всех изменений)
      await execAsync("git reset --hard HEAD");
      console.log("✅ Reset to HEAD completed");

      // 2. git clean -fd (удаление untracked файлов)
      await execAsync("git clean -fd");
      console.log("✅ Cleaned untracked files");

      // Уведомляем сервер об успехе
      this.socket?.emit("git_command_result", {
        projectId: PROJECT_ID,
        command: "discard",
        success: true,
      });

      // Перезапускаем file watcher
      this.startFileWatcher();
      console.log("✅ Local changes discarded successfully");
    } catch (error) {
      console.error("❌ Error discarding local changes:", error.message);

      // Уведомляем сервер об ошибке
      this.socket?.emit("git_command_result", {
        projectId: PROJECT_ID,
        command: "discard",
        success: false,
        error: error.message,
      });

      // Перезапускаем file watcher даже при ошибке
      this.startFileWatcher();
    }
  }

  /**
   * Git pull с временным токеном
   */
  async gitPullWithToken(token, repoUrl) {
    if (!this.isGitRepo) {
      console.log("⚠️ Not a git repository - cannot pull");
      this.socket?.emit("git_command_result", {
        projectId: PROJECT_ID,
        command: "pull",
        success: false,
        error: "Not a git repository",
      });
      return;
    }

    try {
      console.log("📥 Pulling latest changes from GitHub...");

      // Останавливаем file watcher на время git операций
      if (this.watcher) {
        this.watcher.close();
      }

      // Формируем URL с токеном для одноразового pull
      const authenticatedUrl = repoUrl.replace(
        "https://github.com/",
        `https://x-access-token:${token}@github.com/`
      );

      // Выполняем git pull с токеном
      await execAsync(`git pull ${authenticatedUrl} main`);
      console.log("✅ Git pull completed successfully");

      // Уведомляем сервер об успехе
      this.socket?.emit("git_command_result", {
        projectId: PROJECT_ID,
        command: "pull",
        success: true,
      });

      // Перезапускаем file watcher
      this.startFileWatcher();
    } catch (error) {
      console.error("❌ Error during git pull:", error.message);

      // Уведомляем сервер об ошибке
      this.socket?.emit("git_command_result", {
        projectId: PROJECT_ID,
        command: "pull",
        success: false,
        error: error.message,
      });

      // Перезапускаем file watcher даже при ошибке
      this.startFileWatcher();
    }
  }

  /**
   * Обновление локальных файлов без git (альтернативный способ)
   */
  async updateLocalFiles(files) {
    try {
      console.log(`📄 Updating ${files.length} local files...`);

      // Останавливаем file watcher на время обновления файлов
      if (this.watcher) {
        this.watcher.close();
      }

      for (const file of files) {
        try {
          // Создаем директории если нужно
          const dir = path.dirname(file.path);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Записываем содержимое файла
          fs.writeFileSync(file.path, file.content, "utf8");
          console.log(`✅ Updated: ${file.path}`);
        } catch (fileError) {
          console.error(
            `❌ Error updating file ${file.path}:`,
            fileError.message
          );
        }
      }

      // Уведомляем сервер об успехе
      this.socket?.emit("git_command_result", {
        projectId: PROJECT_ID,
        command: "update_files",
        success: true,
      });

      // Перезапускаем file watcher
      this.startFileWatcher();
      console.log("✅ Local files updated successfully");
    } catch (error) {
      console.error("❌ Error updating local files:", error.message);

      // Уведомляем сервер об ошибке
      this.socket?.emit("git_command_result", {
        projectId: PROJECT_ID,
        command: "update_files",
        success: false,
        error: error.message,
      });

      // Перезапускаем file watcher даже при ошибке
      this.startFileWatcher();
    }
  }

  startFileWatcher() {
    if (this.watcher) {
      return; // Уже запущен
    }

    console.log("👀 Watching for file changes...");

    this.watcher = chokidar.watch(".", {
      ignored: [
        "node_modules/**",
        ".git/**",
        "dist/**",
        "build/**",
        ".next/**",
        ".turbo/**",
        "*.log",
        "shipvibes-dev.js",
        ".env*",
      ],
      ignoreInitial: true,
      persistent: true,
    });

    this.watcher.on("change", (filePath) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on("add", (filePath) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on("unlink", (filePath) => {
      this.handleFileDelete(filePath);
    });

    this.watcher.on("error", (error) => {
      console.error("❌ File watcher error:", error);
    });
  }

  async handleFileChange(filePath) {
    if (!this.isConnected) {
      console.log(`⏳ Not connected, skipping: ${filePath}`);
      return;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const hash = crypto.createHash("sha256").update(content).digest("hex");

      console.log(`📝 Sending change: ${filePath}`);

      // Отправляем изменение сразу в веб-интерфейс
      this.socket.emit("file_change", {
        projectId: PROJECT_ID,
        filePath: filePath.replace(/\\/g, "/"),
        content: content,
        hash: hash,
        timestamp: Date.now(),
      });

      console.log(`✅ Change sent: ${filePath}`);
    } catch (error) {
      console.error(`❌ Error reading file ${filePath}:`, error.message);
    }
  }

  handleFileDelete(filePath) {
    if (!this.isConnected) {
      console.log(`⏳ Queuing deletion: ${filePath} (not connected)`);
      return;
    }

    console.log(`🗑️ Deleted: ${filePath}`);

    this.socket.emit("file_delete", {
      projectId: PROJECT_ID,
      filePath: filePath.replace(/\\/g, "/"),
      timestamp: Date.now(),
    });
  }

  stop() {
    console.log("\n🛑 Stopping Shipvibes Agent...");

    if (this.watcher) {
      this.watcher.close();
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    console.log("✅ Agent stopped");
  }
}

// Запуск агента
const agent = new ShipvibesAgent();

// Обработчик для ручного сохранения (Ctrl+S в терминале)
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", (key) => {
  // Ctrl+C (ASCII 3) для выхода
  if (key[0] === 3) {
    agent.stop();
    process.exit(0);
  }
});

process.on("SIGINT", () => {
  agent.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  agent.stop();
  process.exit(0);
});

agent.start().catch((error) => {
  console.error("❌ Failed to start agent:", error.message);
  process.exit(1);
});
