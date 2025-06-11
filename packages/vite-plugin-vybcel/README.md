# @vybcel/vite-plugin

Vite plugin for Vybcel toolbar integration. Automatically injects a development toolbar into your Vite project with Save/Discard/Preview functionality.

## Features

- 🔧 **Auto-injection**: Automatically adds toolbar to your development build
- 🔄 **Real-time sync**: WebSocket connection to Vybcel cloud platform
- ⌨️ **Keyboard shortcuts**: Ctrl/Cmd+Shift+S (Save), Ctrl/Cmd+Shift+D (Discard), Ctrl/Cmd+Shift+P (Preview)
- 📱 **Responsive**: Adapts to different screen sizes
- 🎨 **Non-intrusive**: Scoped styles prevent conflicts with your app

## Installation

```bash
pnpm add @vybcel/vite-plugin
```

## Usage

Add the plugin to your `vite.config.js`:

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vybcelPlugin } from "@vybcel/vite-plugin";

export default defineConfig({
  plugins: [react(), vybcelPlugin()],
});
```

## Configuration

Create a `vybcel.config.json` file in your project root:

```json
{
  "projectId": "your-project-id",
  "toolbar": {
    "enabled": true,
    "position": "top",
    "autoOpen": true
  }
}
```

### Options

- `enabled` (boolean): Enable/disable toolbar injection (default: `true`)
- `position` ('top' | 'bottom'): Toolbar position (default: `'top'`)
- `autoOpen` (boolean): Auto-open VS Code preview (default: `true`)

## Environment Variables

- `VYBCEL_TOOLBAR=false`: Disable toolbar via environment variable

## How it works

1. The plugin reads your `vybcel.config.json` configuration
2. During development, it injects toolbar scripts into your `index.html`
3. The toolbar connects to Vybcel WebSocket server for real-time updates
4. Provides Save/Discard/Preview functionality directly in your app

## Development

```bash
# Install dependencies
pnpm install

# Build plugin
pnpm build

# Type check
pnpm type-check
```

## License

MIT
