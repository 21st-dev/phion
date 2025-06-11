#!/usr/bin/env node

import { VybcelAgent, AgentConfig } from "./agent.js";
import { checkForUpdates as checkVersionUpdates, getCurrentVersion } from "./version-checker.js";
import fs from "fs";
import path from "path";

// Функция для чтения конфигурации
function loadConfig(): AgentConfig {
  // 1. Пытаемся найти vybcel.config.json
  const configPath = path.join(process.cwd(), "vybcel.config.json");
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return {
        projectId: config.projectId,
        wsUrl: config.wsUrl || process.env.VYBCEL_WS_URL || "ws://localhost:8080",
        debug: config.debug || false,
        toolbar: config.toolbar || {
          enabled: true,
          position: 'top',
          autoOpen: true
        },
      };
    } catch (error) {
      console.error("❌ Error reading vybcel.config.json:", (error as Error).message);
    }
  }

  // 2. Fallback на environment variables или args
  const projectId = process.env.VYBCEL_PROJECT_ID || process.argv[2];
  const wsUrl = process.env.VYBCEL_WS_URL || "ws://localhost:8080";

  if (!projectId || projectId === "__PROJECT_ID__") {
    console.error("❌ Missing project ID!");
    console.log("Add project ID to vybcel.config.json or pass as argument");
    process.exit(1);
  }

  return {
    projectId,
    wsUrl,
    debug: false,
    toolbar: {
      enabled: true,
      position: 'top',
      autoOpen: true
    },
  };
  }

// Проверка версии с оповещением об обновлениях
async function checkForUpdates(wsUrl: string): Promise<void> {
  try {
    const currentVersion = getCurrentVersion();
    console.log(`📦 Vybcel v${currentVersion}`);
    
    // Проверяем обновления
    try {
      const versionInfo = await checkVersionUpdates(wsUrl);
      
      if (versionInfo.hasUpdate && versionInfo.latest) {
        console.log(`🆕 New version ${versionInfo.latest} available!`);
        console.log("📥 Run 'pnpm update vybcel' to update");
        console.log("");
      }
    } catch (updateCheckError) {
      // Не показываем ошибки проверки обновлений пользователю
      if (process.env.DEBUG) {
        console.debug("Update check failed:", updateCheckError);
      }
    }
  } catch (error) {
    // Игнорируем ошибки проверки обновлений
  }
}

async function main() {
  try {
    const config = loadConfig();
    await checkForUpdates(config.wsUrl);
    const agent = new VybcelAgent(config);

    // Graceful shutdown
    const shutdown = () => {
      agent.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Запускаем агент
    await agent.start();

    // Держим процесс живым
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on("data", (key) => {
      // Ctrl+C для выхода
      if (key[0] === 3) {
        shutdown();
      }
    });

  } catch (error) {
    console.error("❌ Failed to start Vybcel Agent:", (error as Error).message);
    process.exit(1);
  }
}

main(); 