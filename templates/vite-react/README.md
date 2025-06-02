# 🚀 Shipvibes Project

Welcome to your new Shipvibes project! This is a Vite + React application with automatic synchronization to Shipvibes.dev.

## 🚀 Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Start development server:**

   ```bash
   npm run dev
   # or
   pnpm dev
   ```

3. **Start Shipvibes sync (in a new terminal):**
   ```bash
   npm run sync
   # or
   pnpm sync
   ```

## ⚙️ Configuration

You can customize the sync behavior with environment variables:

```bash
# Disable auto-save (manual save only with Ctrl+S)
SHIPVIBES_AUTO_SAVE=false pnpm sync

# Change auto-save delay (default: 60000ms = 60 seconds)
SHIPVIBES_AUTO_SAVE_DELAY=30000 pnpm sync

# Custom WebSocket URL
SHIPVIBES_WS_URL=ws://your-server:8080 pnpm sync
```

## 📁 Project Structure

```
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # App styles
│   ├── main.jsx         # Application entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
├── shipvibes-dev.js     # Shipvibes sync agent
└── README.md            # This file
```

## 🔄 How Shipvibes Sync Works

1. The `shipvibes-dev.js` script watches for file changes
2. When you save a file, it automatically syncs to Shipvibes.dev
3. Your changes are versioned and deployed automatically
4. View your live site at the URL provided in your Shipvibes dashboard

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run sync` - Start Shipvibes synchronization

## 📝 Development Tips

- Edit files in the `src/` directory
- Changes are automatically reflected in your browser (HMR)
- The sync agent will upload changes to Shipvibes.dev
- Check your Shipvibes dashboard for deployment status

## 🌐 Deployment

Your project is automatically deployed when you sync changes. No manual deployment needed!

---

Built with ❤️ using [Shipvibes.dev](https://shipvibes.dev)
