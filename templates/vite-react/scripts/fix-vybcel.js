#!/usr/bin/env node

import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

console.log("🔧 Vybcel Diagnostic Tool");
console.log("========================\n");

// Read debug mode from config
let DEBUG_MODE = false;
try {
  const configPath = join(process.cwd(), "vybcel.config.json");
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    DEBUG_MODE = config.debug === true;
  }
} catch (error) {
  console.log("⚠️  Could not read vybcel.config.json");
}

async function checkEnvironment() {
  console.log("🔍 Checking environment...");

  // Check if in Cursor
  const cursorDetected = !!(
    process.env.CURSOR_TRACE_ID ||
    process.env.VSCODE_GIT_ASKPASS_NODE?.includes("Cursor.app")
  );

  console.log(`   Cursor detected: ${cursorDetected ? "✅" : "❌"}`);

  if (DEBUG_MODE) {
    console.log("\n🔍 Environment variables:");
    Object.keys(process.env)
      .filter(
        (key) =>
          key.toLowerCase().includes("cursor") ||
          key.toLowerCase().includes("vscode")
      )
      .forEach((key) => {
        console.log(`   ${key}: ${process.env[key]}`);
      });
  }

  // Check for cursor command
  let cursorCommandAvailable = false;
  try {
    await execAsync("cursor --version");
    cursorCommandAvailable = true;
  } catch {
    try {
      await execAsync("code --version");
      cursorCommandAvailable = true;
    } catch {
      // Neither available
    }
  }

  console.log(
    `   Cursor command available: ${cursorCommandAvailable ? "✅" : "❌"}`
  );

  return { cursorDetected, cursorCommandAvailable };
}

async function checkExtension() {
  console.log("\n🔍 Checking browser extension...");

  const extensionDir = join(process.cwd(), "scripts/auto-browser-extension");
  const extensionExists = existsSync(join(extensionDir, "package.json"));

  console.log(`   Extension files exist: ${extensionExists ? "✅" : "❌"}`);

  if (!extensionExists) {
    console.log("   📁 Extension directory:", extensionDir);
    return false;
  }

  // Check if installed in Cursor
  const { homedir } = await import("os");
  const cursorExtensionsDir = join(homedir(), ".cursor", "extensions");
  const installedExtensionDir = join(
    cursorExtensionsDir,
    "vybcel-auto-browser-0.0.5"
  );
  const extensionInstalled = existsSync(installedExtensionDir);

  console.log(
    `   Extension installed in Cursor: ${extensionInstalled ? "✅" : "❌"}`
  );

  if (extensionInstalled) {
    console.log("   📁 Extension location:", installedExtensionDir);
  }

  return extensionInstalled;
}

async function checkDevServer() {
  console.log("\n🔍 Checking development server...");

  // Check if Vite server is running
  let viteRunning = false;
  try {
    const http = await import("http");
    await new Promise((resolve, reject) => {
      const req = http.get("http://localhost:5173", (res) => {
        viteRunning = res.statusCode === 200;
        resolve(null);
      });
      req.on("error", reject);
      req.setTimeout(1000, () => {
        req.destroy();
        reject(new Error("Timeout"));
      });
    });
  } catch {
    viteRunning = false;
  }

  console.log(`   Vite server (localhost:5173): ${viteRunning ? "✅" : "❌"}`);

  // Check if WebSocket server is accessible
  let wsServerRunning = false;
  try {
    const http = await import("http");
    await new Promise((resolve, reject) => {
      const req = http.get("http://localhost:8080", (res) => {
        wsServerRunning = true;
        resolve(null);
      });
      req.on("error", reject);
      req.setTimeout(1000, () => {
        req.destroy();
        reject(new Error("Timeout"));
      });
    });
  } catch {
    wsServerRunning = false;
  }

  console.log(
    `   WebSocket server (localhost:8080): ${wsServerRunning ? "✅" : "❌"}`
  );

  return { viteRunning, wsServerRunning };
}

async function provideSolutions(checks) {
  console.log("\n💡 Solutions:");
  console.log("=============");

  if (!checks.environment.cursorDetected) {
    console.log("\n❌ Cursor not detected:");
    console.log(
      "   • Make sure you're running this from within Cursor terminal"
    );
    console.log("   • Try restarting Cursor completely");
  }

  if (!checks.environment.cursorCommandAvailable) {
    console.log("\n❌ Cursor command not available:");
    console.log("   • Install Cursor command line tools:");
    console.log(
      "   • Press Cmd+Shift+P → 'Shell Command: Install cursor command'"
    );
  }

  if (!checks.extensionInstalled) {
    console.log("\n❌ Extension not installed:");
    console.log("   • Run: node scripts/install-browser-extension.js");
    console.log(
      "   • Then restart Cursor: Cmd+Shift+P → 'Developer: Reload Window'"
    );
  } else {
    console.log("\n⚠️  Extension installed but might need activation:");
    console.log("   • Press Cmd+Shift+P → 'Developer: Reload Window'");
    console.log("   • Try manually: Cmd+Shift+P → 'Vybcel: Open Preview'");
  }

  if (!checks.devServer.viteRunning && !checks.devServer.wsServerRunning) {
    console.log("\n❌ Development servers not running:");
    console.log("   • Stop current process (Ctrl+C)");
    console.log("   • Run: pnpm start");
  } else if (!checks.devServer.viteRunning) {
    console.log("\n❌ Vite server not running:");
    console.log("   • Run: pnpm dev");
  } else if (!checks.devServer.wsServerRunning) {
    console.log("\n❌ WebSocket server not running:");
    console.log("   • Run: pnpm sync");
  }

  console.log("\n🚀 Quick fix command:");
  console.log("   pnpm start && reload Cursor window");
}

async function main() {
  try {
    const environment = await checkEnvironment();
    const extensionInstalled = await checkExtension();
    const devServer = await checkDevServer();

    const checks = {
      environment,
      extensionInstalled,
      devServer,
    };

    await provideSolutions(checks);

    console.log("\n🔧 Diagnostic complete!");
    console.log(
      "If problems persist, check: https://docs.vybcel.com/troubleshooting"
    );
  } catch (error) {
    console.error("❌ Diagnostic failed:", error.message);
    if (DEBUG_MODE) {
      console.error(error);
    }
  }
}

main();
