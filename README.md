# 🚀 Phion.dev

Platform for frontend code editing with automatic synchronization and deployment.

## 🛠️ Local Development

### Environment Setup

1. Copy `env.example` to `.env.local`:

```bash
cp env.example .env.local
```

2. Make sure `.env.local` contains:

```bash
NODE_ENV=development
```

3. Start the platform:

```bash
pnpm run dev:all
```

### Testing with Projects

When you create a project through the web interface:

- **Local development**: `phion.config.json` will contain `ws://localhost:8080`
- **Production**: `phion.config.json` will contain `wss://api.phion.com`

URL is automatically determined based on `NODE_ENV`.

### Project Structure

```
phion/
├── apps/
│   ├── web/                 # Next.js web application (port 3004)
│   └── websocket-server/    # WebSocket server (port 8080)
├── packages/
│   ├── database/           # Supabase integration
│   ├── dev-agent/          # phion npm package for synchronization
│   ├── shared/             # Shared types and utilities
│   └── storage/            # Cloudflare R2 (deprecated)
└── templates/
    └── vite-react/         # Project template for users
```

## 🔧 Technologies

- **Frontend**: Next.js 15, React 18, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, Socket.IO
- **Database**: Supabase (PostgreSQL)
- **File Storage**: GitHub (via GitHub App)
- **Deploy**: Netlify
- **Sync**: WebSocket + File Watcher (chokidar)

## 📋 Workflow

1. **Project Creation**: User creates project in web interface
2. **Download**: Gets ZIP with configured template
3. **Local Development**: Runs `pnpm start` (dev server + sync agent)
4. **Synchronization**: Changes automatically sent to cloud
5. **Deploy**: Automatic deployment to Netlify

## 🚀 Getting Started

```bash
# Install dependencies
pnpm install

# Copy configuration
cp env.example .env.local

# Start all services
pnpm run dev:all
```

After startup:

- Web interface: http://localhost:3004
- WebSocket server: ws://localhost:8080

## 📦 Packages

### `phion` (dev-agent)

npm package for file synchronization between local project and cloud.

**Installation:**

```bash
pnpm add phion
```

**Usage:**

```bash
phion  # reads phion.config.json
```

**Configuration `phion.config.json`:**

```json
{
  "projectId": "project-uuid",
  "wsUrl": "ws://localhost:8080", // local
  "debug": false
}
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License
