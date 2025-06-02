#!/usr/bin/env node

import { io } from "socket.io-client";
import chokidar from "chokidar";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Конфигурация
const PROJECT_ID = process.env.SHIPVIBES_PROJECT_ID || "__PROJECT_ID__"; // Заменяется при генерации
const WS_URL = process.env.SHIPVIBES_WS_URL || "ws://localhost:8080";
const AUTO_SAVE_ENABLED = process.env.SHIPVIBES_AUTO_SAVE !== "false"; // По умолчанию включено
const AUTO_SAVE_DELAY = parseInt(
  process.env.SHIPVIBES_AUTO_SAVE_DELAY || "60000"
); // 60 секунд по умолчанию

class ShipvibesAgent {
  constructor() {
    this.socket = null;
    this.watcher = null;
    this.isConnected = false;
    this.pendingChanges = new Map(); // Хранит ожидающие сохранения изменения
    this.saveTimeouts = new Map(); // Таймауты для автосохранения
  }

  async start() {
    console.log("🚀 Shipvibes Development Agent");
    console.log(`📡 Connecting to: ${WS_URL}`);
    console.log(`🆔 Project ID: ${PROJECT_ID}`);
    console.log("");

    // PROJECT_ID автоматически заменяется при генерации проекта

    // Подключаемся к WebSocket
    await this.connectWebSocket();

    // Запускаем file watcher
    this.startFileWatcher();

    console.log("✅ Shipvibes Agent is running!");
    console.log("📝 Edit your files and see changes sync automatically");

    if (AUTO_SAVE_ENABLED) {
      console.log(
        `💡 Auto-save: ON (${AUTO_SAVE_DELAY / 1000}s after last change)`
      );
    } else {
      console.log("💡 Auto-save: OFF (manual save only)");
    }

    console.log("⌨️  Press Ctrl+S to save immediately, Ctrl+C to exit");
    console.log("🌐 Check your Shipvibes dashboard for updates");
    console.log("");
    console.log("Press Ctrl+C to stop");
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

  startFileWatcher() {
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
      console.log(`⏳ Queuing change: ${filePath} (not connected)`);
      return;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const hash = crypto.createHash("sha256").update(content).digest("hex");

      console.log(`📝 Changed: ${filePath}`);

      // Сохраняем изменение в ожидающие
      this.pendingChanges.set(filePath, {
        content,
        hash,
        timestamp: Date.now(),
      });

      // Отменяем предыдущий таймаут если есть
      if (this.saveTimeouts.has(filePath)) {
        clearTimeout(this.saveTimeouts.get(filePath));
      }

      // Показываем статус ожидающих изменений
      this.showPendingStatus();

      // Устанавливаем новый таймаут для автосохранения (если включено)
      if (AUTO_SAVE_ENABLED) {
        const timeout = setTimeout(() => {
          this.saveFile(filePath);
        }, AUTO_SAVE_DELAY);

        this.saveTimeouts.set(filePath, timeout);
      }
    } catch (error) {
      console.error(`❌ Error reading file ${filePath}:`, error.message);
    }
  }

  saveFile(filePath) {
    const change = this.pendingChanges.get(filePath);
    if (!change) return;

    console.log(`💾 Saving: ${filePath}`);

    this.socket.emit("file_change", {
      projectId: PROJECT_ID,
      filePath: filePath.replace(/\\/g, "/"),
      content: change.content,
      hash: change.hash,
      timestamp: change.timestamp,
    });

    // Удаляем из ожидающих
    this.pendingChanges.delete(filePath);
    this.saveTimeouts.delete(filePath);

    // Показываем обновленный статус
    if (this.pendingChanges.size === 0) {
      console.log(`✅ All changes saved!`);
    } else {
      this.showPendingStatus();
    }
  }

  // Принудительное сохранение всех изменений
  saveAllChanges() {
    console.log(`💾 Saving all pending changes...`);
    for (const filePath of this.pendingChanges.keys()) {
      if (this.saveTimeouts.has(filePath)) {
        clearTimeout(this.saveTimeouts.get(filePath));
      }
      this.saveFile(filePath);
    }
  }

  // Показать статус ожидающих изменений
  showPendingStatus() {
    const pendingCount = this.pendingChanges.size;
    if (pendingCount > 0) {
      const files = Array.from(this.pendingChanges.keys())
        .map((f) => f.split("/").pop())
        .join(", ");

      if (AUTO_SAVE_ENABLED) {
        console.log(
          `⏳ Pending changes (${pendingCount}): ${files} (auto-save in ${
            AUTO_SAVE_DELAY / 1000
          }s, or press Ctrl+S)`
        );
      } else {
        console.log(
          `⏳ Pending changes (${pendingCount}): ${files} (press Ctrl+S to save)`
        );
      }
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
  // Ctrl+S (ASCII 19)
  if (key[0] === 19) {
    agent.saveAllChanges();
  }
  // Ctrl+C (ASCII 3)
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
