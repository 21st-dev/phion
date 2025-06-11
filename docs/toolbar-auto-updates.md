# Toolbar Auto-Update System

The Vybcel toolbar includes a sophisticated auto-update system that allows you to deploy updates to users without requiring them to manually update npm packages.

## Overview

The auto-update system consists of several components:

1. **R2 Storage** - Stores toolbar versions and metadata
2. **API Endpoints** - Check for updates and manage versions
3. **WebSocket Push** - Real-time update notifications
4. **CLI Tools** - Deploy new versions
5. **Admin Interface** - Web UI for managing updates

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Browser  │    │  Vite Plugin    │    │  WebSocket      │
│                 │    │                 │    │  Server         │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Toolbar   │◄├────┤ │ Auto-Update │◄├────┤ │Push Updates │ │
│ │             │ │    │ │   System    │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   API Server    │    │   Admin Panel   │
                       │                 │    │                 │
                       │ ┌─────────────┐ │    │ ┌─────────────┐ │
                       │ │Version Check│ │    │ │Upload/Push  │ │
                       │ │   API       │ │    │ │   Interface │ │
                       │ └─────────────┘ │    │ └─────────────┘ │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Cloudflare R2  │
                       │                 │
                       │ ┌─────────────┐ │
                       │ │Toolbar Files│ │
                       │ │& Metadata   │ │
                       │ └─────────────┘ │
                       └─────────────────┘
```

## Deployment Workflow

### 1. CLI Deployment (Recommended)

```bash
# Deploy stable release
node scripts/deploy-toolbar.js \
  --version 0.2.1 \
  --channel stable \
  --release-notes "Bug fixes and improvements" \
  --broadcast

# Deploy beta with force update
node scripts/deploy-toolbar.js \
  --version 0.3.0-beta.1 \
  --channel beta \
  --force-update \
  --release-notes "New features - please test"

# Deploy to specific project for testing
node scripts/deploy-toolbar.js \
  --version 0.2.2-test.1 \
  --channel dev \
  --push-to abc123-def456-ghi789
```

### 2. Admin Interface

1. Open `/admin/toolbar` in your web app
2. **Upload Tab**: Upload new toolbar versions
3. **Push Tab**: Send updates to users
4. **Versions Tab**: View all available versions

### 3. Manual API Calls

```bash
# Upload new version
curl -X PUT http://localhost:3004/api/toolbar/upload \
  -F "file=@toolbar.js" \
  -F "version=0.2.1" \
  -F "channel=stable" \
  -F "releaseNotes=Bug fixes"

# Broadcast update
curl -X POST http://localhost:8080/api/toolbar/broadcast-update \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.2.1",
    "channel": "stable",
    "forceUpdate": false,
    "releaseNotes": "Bug fixes and improvements"
  }'
```

## Update Channels

### Stable Channel

- **Purpose**: Production-ready releases
- **Frequency**: Weekly/monthly
- **Testing**: Thoroughly tested
- **Auto-update**: Enabled by default
- **Users**: All production users

### Beta Channel

- **Purpose**: Early access to new features
- **Frequency**: Weekly
- **Testing**: Basic testing
- **Auto-update**: Optional
- **Users**: Opt-in beta testers

### Dev Channel

- **Purpose**: Development builds
- **Frequency**: Daily/on-demand
- **Testing**: Minimal
- **Auto-update**: Manual only
- **Users**: Internal developers

## Configuration

### User Configuration (`vybcel.config.json`)

```json
{
  "projectId": "your-project-id",
  "toolbar": {
    "enabled": true,
    "autoUpdate": true,
    "updateChannel": "stable"
  }
}
```

### Plugin Configuration (`vite.config.ts`)

```typescript
import { vybcelPlugin } from "@vybcel/vite-plugin";

export default defineConfig({
  plugins: [
    vybcelPlugin({
      autoUpdate: true,
      updateEndpoint: "http://localhost:3004/api/toolbar",
    }),
  ],
});
```

## Update Flow

### 1. Automatic Updates

1. **Periodic Check**: Every 5 minutes
2. **Version Compare**: Check if newer version available
3. **Download**: Fetch new toolbar code from R2
4. **Hot Reload**: Update toolbar without page refresh
5. **Notification**: Show success message to user

### 2. Push Updates

1. **Admin Trigger**: Admin deploys new version
2. **WebSocket Broadcast**: Real-time notification
3. **Immediate Update**: Users get update instantly
4. **Force Update**: Critical updates require reload

### 3. Force Updates

For critical security fixes or breaking changes:

```bash
node scripts/deploy-toolbar.js \
  --version 0.2.1 \
  --force-update \
  --broadcast \
  --release-notes "Critical security fix"
```

## API Reference

### Check for Updates

```bash
POST /api/toolbar/check
{
  "currentVersion": "0.2.0",
  "channel": "stable",
  "projectId": "abc123"
}
```

Response:

```json
{
  "hasUpdate": true,
  "currentVersion": "0.2.0",
  "latestVersion": {
    "version": "0.2.1",
    "url": "https://shipvibes.r2.dev/toolbar/v0.2.1/index.global.js",
    "checksum": "abc123",
    "releaseNotes": "Bug fixes"
  }
}
```

### Upload Version

```bash
PUT /api/toolbar/upload
Content-Type: multipart/form-data

file: toolbar.js
version: 0.2.1
channel: stable
releaseNotes: Bug fixes
```

### Push Update

```bash
POST http://localhost:8080/api/toolbar/push-update
{
  "projectId": "abc123",
  "version": "0.2.1",
  "forceUpdate": false
}
```

### Broadcast Update

```bash
POST http://localhost:8080/api/toolbar/broadcast-update
{
  "version": "0.2.1",
  "forceUpdate": false,
  "releaseNotes": "Bug fixes"
}
```

## WebSocket Events

### Client → Server

- `toolbar_check_updates` - Manual update check
- `toolbar_update_acknowledged` - Confirm update received
- `toolbar_update_success` - Update completed successfully
- `toolbar_update_error` - Update failed

### Server → Client

- `toolbar_update_available` - New version available
- `toolbar_force_update` - Critical update required
- `toolbar_reload` - Force toolbar reload

## Troubleshooting

### Updates Not Working

1. **Check WebSocket Connection**

   ```bash
   # Test WebSocket server
   curl http://localhost:8080/health
   ```

2. **Verify R2 Configuration**

   ```bash
   # Check environment variables
   echo $R2_ENDPOINT
   echo $R2_ACCESS_KEY_ID
   echo $R2_BUCKET_NAME
   ```

3. **Test Update Endpoint**
   ```bash
   curl http://localhost:3004/api/toolbar/check
   ```

### Manual Fixes

1. **Clear Update Cache**

   ```javascript
   // In browser console
   localStorage.removeItem("vybcel-toolbar-cache");
   location.reload();
   ```

2. **Force Toolbar Reload**
   ```bash
   curl -X POST http://localhost:8080/api/toolbar/force-reload \
     -H "Content-Type: application/json" \
     -d '{"projectId": "abc123"}'
   ```

### Debugging

Enable debug logging:

```javascript
// In browser console
localStorage.setItem("vybcel-debug", "true");
```

Check logs:

- Browser: Developer Console
- Server: WebSocket server logs
- R2: Cloudflare dashboard

## Security Considerations

1. **Checksum Validation**: All files verified before loading
2. **HTTPS Only**: R2 URLs use HTTPS in production
3. **Admin Authentication**: Upload requires admin role
4. **Project Isolation**: Updates scoped to specific projects

## Performance

- **Cache Duration**: 10 minutes for update checks
- **File Size**: Keep toolbar bundles under 500KB
- **Compression**: Files served with gzip compression
- **CDN**: R2 provides global CDN distribution

## Monitoring

Track update metrics:

- Update success rate
- Update latency
- Version adoption
- Error rates

Use the admin interface to monitor active versions and user adoption rates.
