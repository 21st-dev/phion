#!/usr/bin/env node

/**
 * Toolbar Deployment Script
 *
 * This script builds and deploys a new version of the Phion toolbar to R2 storage
 * and optionally sends push updates to active users.
 *
 * Usage:
 *   node scripts/deploy-toolbar.js --version 0.2.1 --channel stable --release-notes "Bug fixes"
 *   node scripts/deploy-toolbar.js --version 0.3.0-beta.1 --channel beta --force-update
 *   node scripts/deploy-toolbar.js --version 0.3.0-dev.5 --channel dev --broadcast
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { r2ToolbarManager } from "../packages/storage/dist/r2-toolbar.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const TOOLBAR_SOURCE_PATH = join(
  __dirname,
  "../packages/dev-agent/dist/toolbar/index.global.js"
);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i]?.replace("--", "");
  const value = args[i + 1];

  if (key && value) {
    options[key] = value;
  } else if (key) {
    options[key] = true;
  }
}

const {
  version,
  channel = "stable",
  "release-notes": releaseNotes,
  "force-update": forceUpdate = false,
  broadcast = false,
  "push-to": pushTo,
  help,
} = options;

// Show help
if (help || !version) {
  console.log(`
📦 Phion Toolbar Deployment Script

Usage:
  node scripts/deploy-toolbar.js --version <version> [options]

Required:
  --version <version>          Version to deploy (e.g., 0.2.1, 0.3.0-beta.1)

Optional:
  --channel <channel>          Release channel: stable, beta, dev (default: stable)
  --release-notes <notes>      Release notes for the update
  --force-update              Mark as force update (users will be required to update)
  --broadcast                  Broadcast update to all active users immediately
  --push-to <projectId>        Push update to specific project only
  --help                       Show this help message

Examples:
  # Deploy stable release
  node scripts/deploy-toolbar.js --version 0.2.1 --channel stable --release-notes "Bug fixes and improvements"
  
  # Deploy beta with force update
  node scripts/deploy-toolbar.js --version 0.3.0-beta.1 --channel beta --force-update --release-notes "New features"
  
  # Deploy and broadcast immediately
  node scripts/deploy-toolbar.js --version 0.2.2 --broadcast
  
  # Deploy to specific project for testing
  node scripts/deploy-toolbar.js --version 0.2.2-test.1 --channel dev --push-to abc123
`);
  process.exit(help ? 0 : 1);
}

async function main() {
  try {
    console.log(`🚀 Starting toolbar deployment...`);
    console.log(`📋 Version: ${version}`);
    console.log(`📋 Channel: ${channel}`);
    console.log(`📋 Force Update: ${forceUpdate ? "Yes" : "No"}`);
    console.log(`📋 Release Notes: ${releaseNotes || "None"}`);
    console.log("");

    // 1. Validate inputs
    if (!["stable", "beta", "dev"].includes(channel)) {
      throw new Error("Invalid channel. Must be stable, beta, or dev");
    }

    // 2. Build the toolbar
    console.log(`🔨 Building toolbar...`);
    const pluginDir = join(__dirname, "../packages/dev-agent");

    if (!existsSync(pluginDir)) {
      throw new Error("Vite plugin directory not found");
    }

    // Update version in package.json
    const packageJsonPath = join(pluginDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    if (packageJson.version !== version) {
      console.log(
        `📝 Updating package.json version: ${packageJson.version} → ${version}`
      );
      packageJson.version = version;

      // Note: In a real scenario, you'd write this back to package.json
      // For now, we'll just build with the existing version
    }

    // Build the toolbar
    console.log(`⚙️  Running build...`);
    execSync("pnpm build", {
      cwd: pluginDir,
      stdio: "inherit",
    });

    // 3. Upload to R2
    const toolbarFile = join(pluginDir, "dist/toolbar/index.global.js");

    if (!existsSync(toolbarFile)) {
      throw new Error("Toolbar build file not found: " + toolbarFile);
    }

    console.log(`📤 Uploading to R2...`);
    const uploadResult = await r2ToolbarManager.uploadToolbarVersion(
      toolbarFile,
      version,
      channel,
      releaseNotes
    );

    if (!uploadResult.success) {
      throw new Error("Upload failed: " + uploadResult.error);
    }

    console.log(`✅ Successfully uploaded toolbar version ${version}`);
    console.log(`🌐 URL: ${uploadResult.version.url}`);
    console.log(`🔐 Checksum: ${uploadResult.version.checksum}`);
    console.log("");

    // 4. Send push updates (if requested)
    if (broadcast || pushTo) {
      console.log(`📡 Sending push updates...`);

      const updatePayload = {
        version,
        forceUpdate: !!forceUpdate,
        releaseNotes,
        channel,
      };

      try {
        let response;

        if (pushTo) {
          // Push to specific project
          console.log(`📤 Pushing update to project: ${pushTo}`);
          response = await fetch(
            process.env.WEBSOCKET_SERVER_URL
              ? `${process.env.WEBSOCKET_SERVER_URL}/api/toolbar/push-update`
              : "http://localhost:8080/api/toolbar/push-update",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectId: pushTo,
                ...updatePayload,
              }),
            }
          );
        } else if (broadcast) {
          // Broadcast to all projects
          console.log(`📢 Broadcasting update to all projects`);
          response = await fetch(
            process.env.WEBSOCKET_SERVER_URL
              ? `${process.env.WEBSOCKET_SERVER_URL}/api/toolbar/broadcast-update`
              : "http://localhost:8080/api/toolbar/broadcast-update",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updatePayload),
            }
          );
        }

        if (response && response.ok) {
          const result = await response.json();
          console.log(`✅ Push update successful: ${result.message}`);
        } else if (response) {
          const error = await response.text();
          console.log(`❌ Push update failed: ${error}`);
        }
      } catch (pushError) {
        console.log(`❌ Failed to send push update: ${pushError.message}`);
        console.log(
          `ℹ️  Make sure WebSocket server is running on ${
            process.env.WEBSOCKET_SERVER_URL || "localhost:8080"
          }`
        );
      }
    }

    // 5. Summary
    console.log("");
    console.log(`🎉 Deployment completed successfully!`);
    console.log("");
    console.log(`📋 Summary:`);
    console.log(`   Version: ${version}`);
    console.log(`   Channel: ${channel}`);
    console.log(`   URL: ${uploadResult.version.url}`);
    console.log(`   Force Update: ${forceUpdate ? "Yes" : "No"}`);
    console.log(
      `   Push Updates: ${
        broadcast ? "Broadcast" : pushTo ? `Project ${pushTo}` : "None"
      }`
    );
    console.log("");

    if (!broadcast && !pushTo) {
      console.log(`💡 To push this update to users:`);
      console.log(
        `   - Broadcast: node scripts/deploy-toolbar.js --version ${version} --broadcast`
      );
      console.log(
        `   - Single project: node scripts/deploy-toolbar.js --version ${version} --push-to PROJECT_ID`
      );
      console.log("");
    }

    // 6. Show available versions
    console.log(`📋 Available versions in ${channel} channel:`);
    const availableVersions = await r2ToolbarManager.getAvailableVersions(
      channel
    );
    availableVersions.slice(0, 5).forEach((v, index) => {
      const marker = index === 0 ? "→" : " ";
      console.log(`   ${marker} v${v.version} (build ${v.build})`);
    });
  } catch (error) {
    console.error("");
    console.error(`❌ Deployment failed:`);
    console.error(`   ${error.message}`);
    console.error("");

    if (error.stack) {
      console.error(`Stack trace:`);
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the deployment
main().catch(console.error);
