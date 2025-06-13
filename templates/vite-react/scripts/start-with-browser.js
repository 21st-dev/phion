#!/usr/bin/env node

import { spawn, exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read debug mode from vybcel config
let DEBUG_MODE = false;
try {
  const configPath = join(process.cwd(), "vybcel.config.json");
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    DEBUG_MODE = config.debug === true;
  }
} catch (error) {
  // Config not found or invalid, use default
}

if (DEBUG_MODE) {
  console.log("🚀 Starting Vybcel development environment (DEBUG MODE)...\n");
} else {
  console.log("🚀 Starting your project...\n");
}

// Check if a command exists
async function commandExists(command) {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

// Simple function to ensure vybcel is available
async function ensureVybcel() {
  if (DEBUG_MODE) {
    console.log("✅ Vybcel will be installed/updated by pnpm install");
  }
  // No need to check versions - package.json has "latest" so pnpm install handles it
  return true;
}

// Install Homebrew
async function installHomebrew() {
  if (DEBUG_MODE) {
    console.log("📦 Installing Homebrew...");
  } else {
    console.log("⚙️ Setting up development tools...");
  }
  try {
    await execAsync(
      '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    );
    if (DEBUG_MODE) {
      console.log("✅ Homebrew installed");
    } else {
      console.log("✅ Done!");
    }
    return true;
  } catch (error) {
    if (DEBUG_MODE) {
      console.log("❌ Failed to install Homebrew:", error.message);
    } else {
      console.log("❌ Something went wrong. Please try again.");
    }
    return false;
  }
}

// Install Node.js via Homebrew
async function installNode() {
  if (DEBUG_MODE) {
    console.log("📦 Installing Node.js...");
  } else {
    console.log("⚙️ Setting up runtime environment...");
  }
  try {
    await execAsync("brew install node");
    if (DEBUG_MODE) {
      console.log("✅ Node.js installed");
    } else {
      console.log("✅ Done!");
    }
    return true;
  } catch (error) {
    if (DEBUG_MODE) {
      console.log("❌ Failed to install Node.js:", error.message);
    } else {
      console.log("❌ Something went wrong. Please try again.");
    }
    return false;
  }
}

// Install pnpm
async function installPnpm() {
  if (DEBUG_MODE) {
    console.log("📦 Installing pnpm...");
  } else {
    console.log("⚙️ Installing package manager...");
  }
  try {
    // Try with curl first (more reliable)
    await execAsync("curl -fsSL https://get.pnpm.io/install.sh | sh -");
    if (DEBUG_MODE) {
      console.log("✅ pnpm installed");
    } else {
      console.log("✅ Done!");
    }
    return true;
  } catch (error) {
    try {
      // Fallback to npm
      await execAsync("npm install -g pnpm");
      if (DEBUG_MODE) {
        console.log("✅ pnpm installed via npm");
      } else {
        console.log("✅ Done!");
      }
      return true;
    } catch (fallbackError) {
      if (DEBUG_MODE) {
        console.log("❌ Failed to install pnpm:", fallbackError.message);
      } else {
        console.log("❌ Something went wrong. Please try again.");
      }
      return false;
    }
  }
}

// Check and install development environment
async function ensureDevEnvironment() {
  const checks = [
    { name: "Homebrew", command: "brew", installer: installHomebrew },
    { name: "Node.js", command: "node", installer: installNode },
    { name: "pnpm", command: "pnpm", installer: installPnpm },
  ];

  for (const check of checks) {
    const exists = await commandExists(check.command);
    if (!exists) {
      if (DEBUG_MODE) {
        console.log(`⚠️  ${check.name} not found, installing...`);
      }
      const success = await check.installer();
      if (!success) {
        if (DEBUG_MODE) {
          console.log(
            `❌ Failed to install ${check.name}. Please install manually.`
          );
        } else {
          console.log(`❌ Could not install ${check.name}. Please try again.`);
        }
        return false;
      }
    } else {
      if (DEBUG_MODE) {
        console.log(`✅ ${check.name} found`);
      }
    }
  }
  return true;
}

// Check if extension is already installed and active
async function checkExtensionInstalled() {
  try {
    const cursorExtensionsDir = join(homedir(), ".cursor", "extensions");
    const installedExtensionDir = join(
      cursorExtensionsDir,
      "vybcel-auto-browser-0.0.5"
    );
    return existsSync(installedExtensionDir);
  } catch (error) {
    return false;
  }
}

// Check if extension is active by testing if Vybcel commands are available
async function checkExtensionActive() {
  try {
    // Try to get list of available commands and check if Vybcel commands exist
    const result = await execAsync(
      'cursor --command "workbench.action.showCommands" --args "vybcel"'
    );
    return true;
  } catch (error) {
    return false;
  }
}

// Install browser extension if not installed or not active
async function ensureBrowserExtension() {
  const isInstalled = await checkExtensionInstalled();

  if (isInstalled) {
    if (DEBUG_MODE) {
      console.log("✅ Extension already installed, checking if active...");
    } else {
      console.log("⚙️ Checking browser integration...");
    }

    // Even if installed, we might need to reload if not active
    // For simplicity, we'll skip the active check and just proceed
    return true;
  }

  if (DEBUG_MODE) {
    console.log("🔧 Installing browser extension...");
  } else {
    console.log("⚙️ Setting up browser integration...");
  }

  return new Promise((resolve) => {
    const installProcess = spawn(
      "node",
      ["scripts/install-browser-extension.js"],
      {
        stdio: DEBUG_MODE ? "inherit" : "pipe",
        shell: true,
      }
    );

    installProcess.on("close", (code) => {
      if (code === 0) {
        if (DEBUG_MODE) {
          console.log("✅ Extension ready");
        } else {
          console.log("✅ Ready!");
        }
        resolve(true);
      } else {
        if (DEBUG_MODE) {
          console.log("⚠️  Extension setup failed");
        } else {
          console.log("⚠️  Browser setup failed");
        }
        resolve(false);
      }
    });

    installProcess.on("error", () => {
      resolve(false);
    });
  });
}

// Main startup function
async function main() {
  // Check and install development environment
  const envReady = await ensureDevEnvironment();
  if (!envReady) {
    if (DEBUG_MODE) {
      console.log("\n❌ Development environment setup failed");
    } else {
      console.log("\n❌ Setup failed. Please try again.");
    }
    process.exit(1);
  }

  // Check vybcel availability
  await ensureVybcel();

  // Setup browser extension
  const extensionReady = await ensureBrowserExtension();

  if (DEBUG_MODE) {
    console.log("\n🚀 Starting development servers...");
  } else {
    console.log("\n🚀 Starting your project...");
    if (extensionReady) {
      console.log("🌐 Browser will open automatically when ready!");
    }
  }

  // Start Vite dev server
  const devProcess = spawn("pnpm", ["dev"], {
    stdio: "inherit",
    shell: true,
  });

  // Start sync agent
  const syncProcess = spawn("pnpm", ["sync"], {
    stdio: "inherit",
    shell: true,
  });

  // Show helpful info after a delay
  setTimeout(() => {
    if (!DEBUG_MODE) {
      console.log("\n💡 Browser tips:");
      console.log("   • Browser should open automatically in 10-20 seconds");
      console.log("   • If not: Press Cmd+Shift+P → 'Vybcel: Open Preview'");
      console.log("   • Or visit: http://localhost:5173");
      console.log(
        "   • Need help? Press Cmd+Shift+P → 'Vybcel: Fix Connection Issues'"
      );
    }
  }, 8000);

  // Handle cleanup
  const cleanup = () => {
    if (DEBUG_MODE) {
      console.log("\n🛑 Stopping servers...");
    } else {
      console.log("\n🛑 Stopping...");
    }
    devProcess.kill();
    syncProcess.kill();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  devProcess.on("exit", cleanup);
  syncProcess.on("exit", cleanup);
}

// Run the main function
main().catch(console.error);
