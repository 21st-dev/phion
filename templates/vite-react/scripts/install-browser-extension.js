#!/usr/bin/env node

import { spawn } from "child_process";
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  statSync,
  rmSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { exec } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("📦 Installing Vybcel Auto Browser Extension for Cursor...");

const extensionDir = join(__dirname, "auto-browser-extension");
const packageJsonPath = join(extensionDir, "package.json");
const extensionJsPath = join(extensionDir, "extension.js");

// Check if extension files exist
if (!existsSync(packageJsonPath) || !existsSync(extensionJsPath)) {
  console.log("❌ Extension files not found.");
  process.exit(1);
}

// Function to copy directory recursively
function copyDir(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const files = readdirSync(src);

  for (const file of files) {
    const srcPath = join(src, file);
    const destPath = join(dest, file);

    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

try {
  // Find Cursor extensions directory
  const homeDir = homedir();
  const cursorExtensionsDir = join(homeDir, ".cursor", "extensions");

  if (!existsSync(cursorExtensionsDir)) {
    console.log("❌ Cursor extensions directory not found");
    console.log(
      "💡 Make sure Cursor is installed and has been run at least once"
    );
    process.exit(1);
  }

  // Create extension directory in Cursor extensions
  const targetExtensionDir = join(
    cursorExtensionsDir,
    "vybcel-auto-browser-0.0.3"
  );

  console.log("🔄 Copying extension to Cursor extensions directory...");
  console.log(`📁 Target: ${targetExtensionDir}`);

  // Remove old versions if they exist
  const oldVersionDirs = [
    join(cursorExtensionsDir, "vybcel-auto-browser-0.0.1"),
    join(cursorExtensionsDir, "vybcel-auto-browser-0.0.2"),
  ];

  for (const oldVersionDir of oldVersionDirs) {
    if (existsSync(oldVersionDir)) {
      console.log(`🗑️  Removing old version: ${oldVersionDir}...`);
      rmSync(oldVersionDir, { recursive: true, force: true });
    }
  }

  // Copy extension files
  copyDir(extensionDir, targetExtensionDir);

  console.log("✅ Extension installed successfully in Cursor!");
  console.log("");
  console.log(
    "🔄 IMPORTANT: Please reload Cursor window to activate the extension:"
  );
  console.log("   1. Press Cmd+Shift+P (or Ctrl+Shift+P on Windows/Linux)");
  console.log("   2. Type: 'Developer: Reload Window'");
  console.log("   3. Press Enter");
  console.log("");
  console.log(
    "🎉 After reload, the browser will auto-open when you run 'pnpm start'!"
  );
  console.log("");
  console.log("💡 Manual usage:");
  console.log("   • Cmd+Shift+P → 'Vybcel: Start Project'");
  console.log("   • Cmd+Shift+P → 'Vybcel: Open Preview'");
  console.log("");

  // Check if we can try to reload Cursor programmatically
  console.log("🤖 Attempting to reload Cursor automatically...");

  setTimeout(() => {
    // Try to signal Cursor to reload (this might not work in all cases)
    exec("osascript -e 'tell application \"Cursor\" to activate'", (err) => {
      if (!err) {
        console.log("✨ Cursor window focused - you can now manually reload!");
      }
    });
  }, 1000);
} catch (error) {
  console.log("❌ Failed to install extension:", error.message);
  console.log("");
  console.log("💡 Manual installation alternative:");
  console.log("   1. Open Cursor");
  console.log("   2. Press Cmd+Shift+P (or Ctrl+Shift+P)");
  console.log("   3. Type 'Developer: Reload Window' and press Enter");
  console.log("   4. Try running 'pnpm start' again");
  console.log("");
  console.log("🆘 If issues persist:");
  console.log("   • Restart Cursor completely");
  console.log("   • Verify the extension directory exists");
  console.log("   • Check Cursor's Extensions panel");
}
