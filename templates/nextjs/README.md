# Phion Next.js Project

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) and integrated with [Phion](https://phion.dev) for real-time development and deployment.

## 🚀 Quick Start

### Automatic Setup (Recommended)

If you're using VS Code with the Phion extension, the project will start automatically when you open this folder.

### Manual Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Start the development server:**

   ```bash
   pnpm run dev
   # or
   pnpm phion:start
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 Phion Features

- **Real-time Sync**: Changes are automatically synced with your team
- **Auto-deployment**: Pushes to Vercel when you save
- **Environment Sync**: `.env` files sync without Git commits
- **Toolbar Integration**: Development toolbar for enhanced workflow

## 📁 Project Structure

```
├── src/
│   ├── app/                # App Router pages
│   ├── components/         # React components
│   └── lib/               # Utilities
├── public/                # Static assets
├── phion.config.json      # Phion configuration
└── next.config.js         # Next.js config with Phion
```

## 🛠️ Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm sync` - Manual Phion sync
- `pnpm phion:start` - Start with browser automation

### Environment Variables

Create a `.env.local` file for environment variables:

```env
NEXT_PUBLIC_API_URL=your_api_url
DATABASE_URL=your_database_url
```

Variables are automatically synced to Vercel through Phion.

## 🚀 Deployment

This project automatically deploys to [Vercel](https://vercel.com) when you save changes through Phion.

### Manual Deployment

```bash
pnpm build
```

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Phion Documentation](https://docs.phion.dev)
- [Vercel Platform](https://vercel.com/new)

## 🔧 Configuration

### Phion Configuration

Edit `phion.config.json` to customize Phion behavior:

```json
{
  "projectId": "your-project-id",
  "wsUrl": "wss://your-websocket-url",
  "templateType": "nextjs",
  "devPort": 3000
}
```

### Next.js Configuration

The `next.config.js` includes Phion toolbar integration:

```javascript
const { withPhionToolbar } = require("phion/plugin-next")

module.exports = withPhionToolbar({
  // Your Next.js config
})
```

## 🐛 Troubleshooting

### Common Issues

1. **Port 3000 already in use:**

   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **Dependencies issues:**

   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

3. **Phion connection issues:**
   - Check `phion.config.json` settings
   - Verify WebSocket URL
   - Restart the development server

### Getting Help

- [Phion Discord](https://discord.gg/phion)
- [GitHub Issues](https://github.com/phion-dev/phion/issues)
- [Documentation](https://docs.phion.dev)

---

Built with ❤️ using [Next.js](https://nextjs.org/) and [Phion](https://phion.dev)
