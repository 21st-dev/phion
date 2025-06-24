# phion

Phion Development Agent with Vite and Next.js support for seamless code sync and auto-deploy.

> 🚀 **NEW**: Beta support for Next.js + Vercel! Try `npm install -g phion@beta`

## Installation

### Stable Version (Vite only)

```bash
npm install -g phion
# or
pnpm add phion
```

### Beta Version (Vite + Next.js)

```bash
npm install -g phion@beta
# or
pnpm add phion@beta
```

## Usage

### For Vite Projects

### Using config file (recommended)

Create `phion.config.json` in your project root:

```json
{
  "projectId": "your-project-id",
  "wsUrl": "ws://localhost:8080",
  "debug": false
}
```

Then run the agent:

```bash
phion
```

### For Next.js Projects (Beta)

Add to your `next.config.js`:

```javascript
import { withPhionToolbar } from "phion/plugin-next"

export default withPhionToolbar({
  // your existing Next.js config
})
```

Create API route at `pages/api/phion/[...path].ts` or `app/api/phion/[...path]/route.ts`:

```typescript
import { createToolbarHandler } from "phion/plugin-next"

export default createToolbarHandler()
// or for app router:
export const GET = createToolbarHandler()
export const POST = createToolbarHandler()
```

### Using command line arguments

```bash
phion your-project-id
```

### Using environment variables

```bash
export PHION_PROJECT_ID=your-project-id
export PHION_WS_URL=ws://localhost:8080
phion
```

## Configuration

### phion.config.json

- `projectId` (required) - Your Phion project ID
- `wsUrl` (optional) - WebSocket server URL (default: `ws://localhost:8080`)
- `debug` (optional) - Debug mode (default: `false`)

### Environment variables

- `PHION_PROJECT_ID` - Project ID
- `PHION_WS_URL` - WebSocket server URL

## Auto Updates

To get the latest agent updates, regularly update the package:

```bash
pnpm update phion
```

## Features

- 🔄 **Real-time sync** of files with Phion platform
- 🔗 **Git integration** for rolling back changes and syncing with GitHub
- 📁 **Smart file watching** with automatic exclusion of build folders
- 🚀 **Auto-reconnection** when connection is lost
- ⚙️ **Flexible configuration** via file, environment variables, or arguments
- ✨ **Dual template support** - Vite + Netlify and Next.js + Vercel (beta)
- 🎯 **Platform-aware deployments** with real-time monitoring
- 🛠 **VS Code integration** with automatic project detection

## System Requirements

- Node.js 18+
- Git (for git commands)

## Support

If you experience issues with the agent:

1. Check your internet connection
2. Make sure WebSocket server is running
3. Verify your Project ID is correct
4. Restart agent: `Ctrl+C` and run `phion` again

---

Made with ❤️ by [21st Labs](https://21st.dev) | [Phion.dev](https://phion.dev)
