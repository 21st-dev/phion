# Environment Variables Configuration

This document describes all environment variables used in the Shipvibes platform to avoid hardcoded URLs and enable deployment flexibility.

## Core Environment Variables

### WebSocket Server

```bash
# WebSocket server configuration
WEBSOCKET_PORT=8080
WEBSOCKET_SERVER_URL=http://localhost:8080
```

### Next.js Web App

```bash
# Next.js app URLs
NEXT_PUBLIC_APP_URL=http://localhost:3004
NEXT_PUBLIC_API_URL=http://localhost:3004
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

### Toolbar Auto-Update System

```bash
# Toolbar update endpoints
TOOLBAR_UPDATE_ENDPOINT=http://localhost:3004/api/toolbar
NEXT_PUBLIC_TOOLBAR_UPDATE_ENDPOINT=http://localhost:3004/api/toolbar
```

## Production Configuration

For production environments (Railway, Vercel, etc.), update the URLs:

```bash
# Production URLs
NEXT_PUBLIC_APP_URL=https://your-app.railway.app
NEXT_PUBLIC_API_URL=https://your-app.railway.app
WEBSOCKET_SERVER_URL=https://your-ws-server.railway.app
NEXT_PUBLIC_WS_URL=wss://your-ws-server.railway.app
TOOLBAR_UPDATE_ENDPOINT=https://your-app.railway.app/api/toolbar
NEXT_PUBLIC_TOOLBAR_UPDATE_ENDPOINT=https://your-app.railway.app/api/toolbar
```

## How to Set Up

### 1. Copy Environment File

```bash
cp env.example .env.local
```

### 2. Update Variables

Edit `.env.local` with your URLs:

**For Local Development:**

- Keep localhost URLs as they are
- Ensure ports match your running services

**For Production:**

- Replace localhost with your actual domain/deployment URLs
- Use `https://` and `wss://` for production
- Update API endpoints accordingly

### 3. Restart Services

After changing environment variables:

```bash
# Restart WebSocket server
cd apps/websocket-server && pnpm dev

# Restart Next.js app
cd apps/web && pnpm dev
```

## Environment-Specific Files

### Root Level

- `env.example` - Template with all variables
- `.env.local` - Your local configuration (not committed)

### Package Level

- `packages/dev-agent/env.template` - Agent configuration
- `packages/vite-plugin-vybcel/env.template` - Plugin configuration

## Components Using Environment Variables

### 1. WebSocket Server (`apps/websocket-server/`)

- `NEXT_PUBLIC_APP_URL` - CORS origin
- Used in `src/index.ts` for CORS configuration

### 2. Next.js App (`apps/web/`)

- `WEBSOCKET_SERVER_URL` - Backend WebSocket URL
- `NEXT_PUBLIC_WS_URL` - Frontend WebSocket URL
- Used in API routes and hooks

### 3. Vite Plugin (`packages/vite-plugin-vybcel/`)

- `TOOLBAR_UPDATE_ENDPOINT` - Auto-update API endpoint
- Used in toolbar auto-update system

### 4. CLI Scripts (`scripts/`)

- `WEBSOCKET_SERVER_URL` - Push update endpoints
- Used in `deploy-toolbar.js`

### 5. Admin Interface (`apps/web/app/admin/`)

- `WEBSOCKET_SERVER_URL` - Admin toolbar controls
- Used for push updates and force reload

## Common Issues

### Port Conflicts

If ports are in use, update the environment variables:

```bash
# Change WebSocket port
WEBSOCKET_PORT=8081
WEBSOCKET_SERVER_URL=http://localhost:8081
NEXT_PUBLIC_WS_URL=ws://localhost:8081
```

### SSL/TLS in Production

Always use secure protocols in production:

```bash
# Wrong - insecure
NEXT_PUBLIC_WS_URL=ws://your-domain.com

# Correct - secure
NEXT_PUBLIC_WS_URL=wss://your-domain.com
```

### Cross-Origin Issues

Ensure CORS origins match your app URL:

```bash
# WebSocket server uses this for CORS
NEXT_PUBLIC_APP_URL=https://your-frontend-domain.com
```

## Template System

The template system automatically substitutes variables:

- `__WS_URL__` → Replaced with actual WebSocket URL
- `__PROJECT_ID__` → Replaced with project ID
- `__API_URL__` → Replaced with API base URL

These are handled automatically when users download projects.

## Testing Environment Variables

Use the test script to verify configuration:

```bash
node test-env.js
```

This will check if all required variables are set and accessible.

## Security Notes

- Never commit `.env.local` or `.env` files
- Use different tokens/keys for development and production
- Rotate secrets regularly in production
- Use environment-specific Supabase projects
