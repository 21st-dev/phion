# vybcel

Vybcel Development Agent for file synchronization between your local project and Vybcel platform.

## Installation

```bash
pnpm add vybcel
```

## Usage

### Using config file (recommended)

Create `vybcel.config.json` in your project root:

```json
{
  "projectId": "your-project-id",
  "wsUrl": "ws://localhost:8080",
  "debug": false
}
```

Then run the agent:

```bash
vybcel
```

### Using command line arguments

```bash
vybcel your-project-id
```

### Using environment variables

```bash
export VYBCEL_PROJECT_ID=your-project-id
export VYBCEL_WS_URL=ws://localhost:8080
vybcel
```

## Configuration

### vybcel.config.json

- `projectId` (required) - Your Vybcel project ID
- `wsUrl` (optional) - WebSocket server URL (default: `ws://localhost:8080`)
- `debug` (optional) - Debug mode (default: `false`)

### Environment variables

- `VYBCEL_PROJECT_ID` - Project ID
- `VYBCEL_WS_URL` - WebSocket server URL

## Auto Updates

To get the latest agent updates, regularly update the package:

```bash
pnpm update vybcel
```

## Features

- 🔄 **Real-time sync** of files with Vybcel platform
- 🔗 **Git integration** for rolling back changes and syncing with GitHub
- 📁 **Smart file watching** with automatic exclusion of build folders
- 🚀 **Auto-reconnection** when connection is lost
- ⚙️ **Flexible configuration** via file, environment variables, or arguments

## System Requirements

- Node.js 18+
- Git (for git commands)

## Support

If you experience issues with the agent:

1. Check your internet connection
2. Make sure WebSocket server is running
3. Verify your Project ID is correct
4. Restart agent: `Ctrl+C` and run `vybcel` again

---

Made with ❤️ by [21st Labs](https://21st.dev) | [Vybcel.com](https://vybcel.com)
