# Vybcel Vite Plugin

Vite plugin for seamless integration with Vybcel toolbar - providing real-time code syncing, deployment status, and auto-updates.

## Features

- 🔄 **Real-time sync** - Changes are automatically synced to your Vybcel project
- 🚀 **Auto-deploy** - Instant deployments with Netlify integration
- 🛠️ **Developer toolbar** - In-browser controls for save, discard, and preview
- ✨ **Auto-updates** - Plugin updates itself automatically without breaking your workflow
- ⌨️ **Keyboard shortcuts** - Quick actions with Cmd/Ctrl+Shift+[S|D|P|U]

## Installation

```bash
npm install @vybcel/vite-plugin
# or
pnpm add @vybcel/vite-plugin
# or
yarn add @vybcel/vite-plugin
```

## Configuration

### Basic Setup

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import { vybcelPlugin } from "@vybcel/vite-plugin";

export default defineConfig({
  plugins: [
    vybcelPlugin({
      // Optional: custom WebSocket URL
      websocketUrl: "ws://localhost:8080",

      // Optional: enable/disable auto-updates
      autoUpdate: true,

      // Optional: custom update endpoint
      updateEndpoint: "https://api.vybcel.com/v1/toolbar",
    }),
  ],
});
```

### Project Configuration

Create a `vybcel.config.json` file in your project root:

```json
{
  "projectId": "your-project-id",
  "websocketUrl": "ws://localhost:8080",
  "toolbar": {
    "enabled": true,
    "position": "top",
    "autoUpdate": true,
    "updateChannel": "stable"
  }
}
```

## Auto-Update System

The Vybcel plugin includes a sophisticated auto-update system that keeps your toolbar up-to-date without disrupting your development workflow.

### Update Channels

- **`stable`** (default) - Production-ready updates, thoroughly tested
- **`beta`** - Early access to new features, may have minor issues
- **`dev`** - Latest development builds, for testing new functionality

### How Auto-Updates Work

1. **Periodic checks** - Plugin checks for updates every 5 minutes
2. **WebSocket updates** - Server can push critical updates instantly
3. **Hot reloading** - Toolbar updates without refreshing your app
4. **Fallback system** - Always falls back to local version if update fails

### Update Notifications

When updates are available, you'll see:

- 🚀 **Green notification** - Successfully updated to new version
- ⚠️ **Red notification** - Critical update being applied
- 🔄 **Blue notification** - Toolbar reloading

### Configuration Options

```json
{
  "toolbar": {
    "autoUpdate": true, // Enable/disable auto-updates
    "updateChannel": "stable" // Update channel: stable|beta|dev
  }
}
```

### Plugin Options

```typescript
vybcelPlugin({
  autoUpdate: true, // Enable auto-updates
  updateEndpoint: "https://api.vybcel.com/v1/toolbar", // Custom update server
});
```

### Manual Update Check

Force check for updates using the keyboard shortcut:

- **Cmd/Ctrl + Shift + U** - Check for updates manually

## Keyboard Shortcuts

- **Cmd/Ctrl + Shift + S** - Save all pending changes
- **Cmd/Ctrl + Shift + D** - Discard all pending changes
- **Cmd/Ctrl + Shift + P** - Open preview in new tab
- **Cmd/Ctrl + Shift + U** - Check for toolbar updates

## Toolbar States

The toolbar shows real-time status of your project:

- **Green dot** - Connected to Vybcel servers
- **Red dot** - Disconnected (check your connection)
- **Deploy status** - Shows current deployment state:
  - `Ready` - Latest changes are deployed
  - `Building...` - Deployment in progress
  - `Failed` - Build/deployment failed
  - `Pending` - Waiting for deployment

## API Events

The plugin communicates with Vybcel servers via WebSocket and supports these events:

### Client → Server

- `save_all_changes` - Save pending changes
- `discard_all_changes` - Discard pending changes
- `toolbar_check_updates` - Check for updates
- `toolbar_update_acknowledged` - Acknowledge update received

### Server → Client

- `file_change_staged` - File change detected
- `deploy_status_update` - Deployment status changed
- `toolbar_update_available` - New toolbar version available
- `toolbar_force_update` - Critical update required
- `toolbar_reload` - Reload toolbar requested

## Troubleshooting

### Toolbar Not Appearing

1. Check `vybcel.config.json` exists and has valid `projectId`
2. Verify toolbar is enabled: `"toolbar": { "enabled": true }`
3. Check browser console for connection errors

### Connection Issues

1. Verify WebSocket URL is correct in config
2. Check if Vybcel development server is running
3. Ensure no firewall blocking WebSocket connections

### Update Issues

1. Try manual update check: `Cmd/Ctrl + Shift + U`
2. Check browser console for update errors
3. Temporarily disable auto-updates: `"autoUpdate": false`
4. Clear browser cache and reload

### Disabling Auto-Updates

To disable auto-updates completely:

**In vybcel.config.json:**

```json
{
  "toolbar": {
    "autoUpdate": false
  }
}
```

**Or in vite.config.ts:**

```typescript
vybcelPlugin({
  autoUpdate: false,
});
```

**Or via environment variable:**

```bash
VYBCEL_TOOLBAR=false npm run dev
```

## Development

### Building the Plugin

```bash
pnpm install
pnpm build
```

### Testing Auto-Updates

For testing the auto-update system:

1. Build plugin with version bump
2. Deploy to test update server
3. Configure test project to use test update endpoint
4. Trigger update via WebSocket or manual check

## License

MIT
