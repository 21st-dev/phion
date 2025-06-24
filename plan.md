# Phion Platform: Next.js + Vercel Integration Plan

## Overview

This document outlines the strategy to extend the current Phion architecture from "Vite + Netlify" to support "Next.js + Vercel" while maintaining all existing functionality and architectural principles.

## Current Architecture Summary

- **Template System**: Vite React template with auto-setup
- **Deployment**: Netlify with auto-deploy from GitHub commits
- **Synchronization**: Real-time WebSocket updates for file changes
- **Environment**: `.env` files sync directly to Netlify without commits
- **Tooling**: VS Code extension + toolbar integration via npm package

## Target Architecture

Extend to support:

- **Template Choice**: User selects between Vite or Next.js
- **Deployment Options**: Netlify (Vite) or Vercel (Next.js)
- **Same UX**: Identical workflow regardless of template choice
- **Unified Codebase**: Single platform supporting both stacks

---

## Phase 1: Database Schema Updates

### 1.1 Add Template Type Support

```sql
-- Migration: 014_add_nextjs_support.sql
ALTER TABLE projects ADD COLUMN template_type VARCHAR(20) DEFAULT 'vite';
ALTER TABLE projects ADD COLUMN vercel_project_id VARCHAR(100);
ALTER TABLE projects ADD COLUMN vercel_project_name VARCHAR(100);
ALTER TABLE projects ADD COLUMN vercel_url TEXT;
ALTER TABLE projects ADD COLUMN vercel_deploy_status VARCHAR(20);

-- Update existing projects
UPDATE projects SET template_type = 'vite' WHERE template_type IS NULL;
```

### 1.2 Update Database Types

```typescript
// packages/database/src/types.ts
export interface Project {
  // ... existing fields
  template_type: "vite" | "nextjs"
  vercel_project_id?: string
  vercel_project_name?: string
  vercel_url?: string
  vercel_deploy_status?: "building" | "ready" | "failed"
}
```

---

## Phase 2: Next.js Template Creation

### 2.1 Create Next.js Template

```bash
# Create new template directory
mkdir -p templates/nextjs
cd templates/nextjs

# Initialize Next.js project
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### 2.2 Template Configuration

```json
// templates/nextjs/phion.config.json
{
  "projectId": "__PROJECT_ID__",
  "wsUrl": "__WS_URL__",
  "templateType": "nextjs",
  "devPort": 3000
}
```

### 2.3 Package.json Scripts

```json
// templates/nextjs/package.json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "sync": "phion",
    "phion:start": "pnpm install && node scripts/start-with-browser.js"
  },
  "dependencies": {
    "phion": "latest"
  }
}
```

### 2.4 Next.js Configuration

```javascript
// templates/nextjs/next.config.js
const { withPhionToolbar } = require("phion/plugin-next")

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = withPhionToolbar(nextConfig)
```

### 2.5 VS Code Extension Integration

```javascript
// Copy from vite template
cp -r templates/vite-react/scripts/auto-browser-extension templates/nextjs/scripts/
```

---

## Phase 3: Vercel Service Integration

### 3.1 Create Vercel Service

```typescript
// apps/websocket-server/src/services/vercel.ts
import { fetch } from "node-fetch"

export class VercelService {
  private apiToken: string
  private baseUrl = "https://api.vercel.com"

  constructor() {
    this.apiToken = process.env.VERCEL_API_TOKEN!
  }

  async createProject(repoOwner: string, repoName: string) {
    const response = await fetch(`${this.baseUrl}/v9/projects`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repoName,
        gitRepository: {
          type: "github",
          repo: `${repoOwner}/${repoName}`,
        },
        buildCommand: "pnpm build",
        devCommand: "pnpm dev",
        installCommand: "pnpm install",
        outputDirectory: ".next",
      }),
    })

    return response.json()
  }

  async syncEnvFile(projectId: string, envVars: Record<string, string>) {
    const envArray = Object.entries(envVars).map(([key, value]) => ({
      key,
      value,
      type: "encrypted",
      target: ["production", "preview", "development"],
    }))

    const response = await fetch(`${this.baseUrl}/v9/projects/${projectId}/env`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envArray),
    })

    return response.json()
  }

  async setupWebhook(projectId: string, webhookUrl: string) {
    // Configure deployment webhooks
    const response = await fetch(`${this.baseUrl}/v1/integrations/webhooks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ["deployment.created", "deployment.ready", "deployment.error"],
        projectIds: [projectId],
      }),
    })

    return response.json()
  }
}
```

### 3.2 Update WebSocket Server

```typescript
// apps/websocket-server/src/index.ts
import { VercelService } from "./services/vercel.js"

// Add to project creation flow
socket.on("create_project", async (data) => {
  const { projectId, templateType } = data

  // ... existing GitHub repo creation ...

  if (templateType === "nextjs") {
    // Don't create Vercel project yet - wait for first user commit
    await ProjectQueries.updateProject(projectId, {
      template_type: "nextjs",
      deploy_status: "pending",
    })
  }
})

// Update save_all_changes for Vercel
socket.on("save_all_changes", async (data) => {
  const project = await ProjectQueries.getProjectById(data.projectId)

  // ... existing GitHub commit logic ...

  if (project.template_type === "nextjs" && !project.vercel_project_id) {
    // First commit - create Vercel project
    const vercelService = new VercelService()
    const vercelProject = await vercelService.createProject("phion", project.github_repo_name)

    await ProjectQueries.updateProject(data.projectId, {
      vercel_project_id: vercelProject.id,
      vercel_project_name: vercelProject.name,
      deploy_status: "building",
    })

    // Setup webhook
    await vercelService.setupWebhook(vercelProject.id, `${process.env.WS_URL}/webhooks/vercel`)
  }
})
```

---

## Phase 4: Next.js Toolbar Plugin

### 4.1 Create Next.js Plugin

```typescript
// packages/dev-agent/src/plugin-next.ts
import { NextConfig } from "next"
import path from "path"

export function withPhionToolbar(nextConfig: NextConfig = {}): NextConfig {
  return {
    ...nextConfig,
    webpack: (config, { dev, isServer }) => {
      if (dev && !isServer) {
        // Inject toolbar script
        config.entry = async () => {
          const entries = await config.entry()

          if (entries["main.js"] && !entries["main.js"].includes("./phion-toolbar-inject.js")) {
            entries["main.js"].unshift("./phion-toolbar-inject.js")
          }

          return entries
        }
      }

      // Call the original webpack config if it exists
      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, { dev, isServer })
      }

      return config
    },

    async rewrites() {
      const rewrites = [
        {
          source: "/@phion/:path*",
          destination: "/api/phion/:path*",
        },
      ]

      if (nextConfig.rewrites) {
        const existingRewrites = await nextConfig.rewrites()
        if (Array.isArray(existingRewrites)) {
          return [...rewrites, ...existingRewrites]
        }
        return {
          beforeFiles: rewrites,
          ...existingRewrites,
        }
      }

      return rewrites
    },
  }
}
```

### 4.2 Toolbar API Route

```typescript
// templates/nextjs/src/pages/api/phion/[...path].ts
import { NextApiRequest, NextApiResponse } from "next"
import { createToolbarHandler } from "phion/toolbar-handler"

const handler = createToolbarHandler()

export default function phionApi(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res)
}
```

### 4.3 Toolbar Injection Script

```javascript
// templates/nextjs/phion-toolbar-inject.js
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // Load Phion toolbar
  const script = document.createElement("script")
  script.src = "/@phion/toolbar.js"
  script.async = true
  document.head.appendChild(script)
}
```

---

## Phase 5: VS Code Extension Updates

### 5.1 Template Detection

```typescript
// templates/nextjs/scripts/auto-browser-extension/src/extension.ts
async function detectProjectType(): Promise<"vite" | "nextjs"> {
  try {
    const configPath = path.join(vscode.workspace.rootPath!, "phion.config.json")
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
    return config.templateType || "vite"
  } catch {
    return "vite"
  }
}

async function getDevServerPort(templateType: string): Promise<number> {
  return templateType === "nextjs" ? 3000 : 5173
}
```

### 5.2 Auto-Start Logic

```typescript
// Update startProject command
vscode.commands.registerCommand("phion.startProject", async () => {
  const templateType = await detectProjectType()
  const port = await getDevServerPort(templateType)

  // Check if server is already running
  const isRunning = await checkServerRunning(port)
  if (isRunning) {
    vscode.window.showInformationMessage(
      `${templateType} dev server already running on port ${port}`,
    )
    return
  }

  // Start appropriate command
  const terminal = vscode.window.createTerminal("Phion")
  terminal.sendText("pnpm phion:start")
  terminal.show()

  // Start monitoring
  startServerMonitoring(port)
})
```

---

## Phase 6: Web Application Updates

### 6.1 Project Creation UI

```typescript
// apps/web/components/create-project-dialog.tsx
export function CreateProjectDialog() {
  const [templateType, setTemplateType] = useState<'vite' | 'nextjs'>('vite');

  return (
    <Dialog>
      <DialogContent>
        <div className="space-y-4">
          <div>
            <Label>Template Type</Label>
            <RadioGroup value={templateType} onValueChange={setTemplateType}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vite" id="vite" />
                <Label htmlFor="vite">Vite + React</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nextjs" id="nextjs" />
                <Label htmlFor="nextjs">Next.js</Label>
              </div>
            </RadioGroup>
          </div>
          {/* ... rest of form ... */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.2 Deploy Status Component

```typescript
// apps/web/components/project/deployment-status-card.tsx
export function DeploymentStatusCard({ project }: { project: Project }) {
  const isNextjs = project.template_type === 'nextjs';
  const deployUrl = isNextjs ? project.vercel_url : project.netlify_url;
  const deployStatus = isNextjs ? project.vercel_deploy_status : project.deploy_status;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isNextjs ? <VercelIcon /> : <NetlifyIcon />}
          Deploy Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <StatusBadge status={deployStatus} />
          {deployUrl && (
            <Button asChild variant="outline">
              <a href={deployUrl} target="_blank" rel="noopener noreferrer">
                Open Live Site
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 6.3 Webhook Handler

```typescript
// apps/web/app/api/webhooks/vercel/route.ts
export async function POST(request: Request) {
  const payload = await request.json()

  // Verify webhook signature
  const signature = request.headers.get("x-vercel-signature")
  if (!verifyWebhookSignature(payload, signature)) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { projectId, deploymentId, state, url } = payload

  // Update project status
  await ProjectQueries.updateProject(projectId, {
    vercel_deploy_status: state === "READY" ? "ready" : state === "ERROR" ? "failed" : "building",
    vercel_url: state === "READY" ? url : undefined,
  })

  // Notify via WebSocket
  await notifyDeployStatusChange(projectId, {
    status: state,
    url: state === "READY" ? url : undefined,
  })

  return new Response("OK")
}
```

---

## Phase 7: Environment Sync Updates

### 7.1 Update Environment Sync Logic

```typescript
// apps/websocket-server/src/index.ts
socket.on("env_file_change", async (data) => {
  const { projectId, filePath, content } = data
  const project = await ProjectQueries.getProjectById(projectId)

  if (!project.netlify_site_id && !project.vercel_project_id) {
    socket.emit("env_sync_result", { error: "No deployment service configured" })
    return
  }

  const envVars = parseEnvContent(content)

  try {
    if (project.template_type === "nextjs" && project.vercel_project_id) {
      const vercelService = new VercelService()
      await vercelService.syncEnvFile(project.vercel_project_id, envVars)

      io.to(`project_${projectId}`).emit("env_sync_success", {
        service: "vercel",
        count: Object.keys(envVars).length,
      })
    } else if (project.netlify_site_id) {
      // Existing Netlify logic
      const netlifyService = new NetlifyService()
      await netlifyService.syncEnvFile(project.netlify_site_id, envVars)

      io.to(`project_${projectId}`).emit("env_sync_success", {
        service: "netlify",
        count: Object.keys(envVars).length,
      })
    }
  } catch (error) {
    io.to(`project_${projectId}`).emit("env_sync_error", { error: error.message })
  }
})
```

---

## Phase 8: Package Distribution

### 8.1 Update NPM Package

```typescript
// packages/dev-agent/src/index.ts
export { default as VitePhionPlugin } from "./plugin"
export { withPhionToolbar } from "./plugin-next"
export { createToolbarHandler } from "./toolbar-handler"
```

### 8.2 Package.json Updates

```json
{
  "name": "phion",
  "exports": {
    ".": "./dist/index.js",
    "./plugin": "./dist/plugin.js",
    "./plugin-next": "./dist/plugin-next.js",
    "./toolbar-handler": "./dist/toolbar-handler.js"
  }
}
```

---

## Phase 9: Testing Strategy

### 9.1 Unit Tests

- [ ] Vercel service API integration
- [ ] Next.js plugin webpack configuration
- [ ] Environment variable parsing and sync
- [ ] WebSocket event handling

### 9.2 Integration Tests

- [ ] Complete Next.js project creation flow
- [ ] File change → commit → Vercel deploy cycle
- [ ] Environment sync between local and Vercel
- [ ] VS Code extension auto-start for Next.js projects

### 9.3 E2E Tests

- [ ] Create Next.js project from dashboard
- [ ] Download and setup locally
- [ ] Make changes and save all
- [ ] Verify Vercel deployment
- [ ] Test environment variable sync

---

## Phase 10: Documentation Updates

### 10.1 Architecture Documentation

- [ ] Update architecture diagrams for dual-template support
- [ ] Document Vercel integration patterns
- [ ] Add Next.js specific configuration guide

### 10.2 User Documentation

- [ ] Template selection guide
- [ ] Next.js vs Vite comparison
- [ ] Vercel deployment specifics
- [ ] Environment variable handling differences

---

## Implementation Timeline

### Week 1: Foundation

- [x] Database schema updates (Migration 016)
- [x] Next.js template creation
- [x] Basic Vercel service implementation
- [x] Next.js plugin development
- [x] WebSocket server updates for Next.js support
- [x] Type system updates (shared and database packages)
- [x] All type checks passing

### Week 2: Core Integration

- [x] Frontend template selection UI
- [x] API route updates for project creation (already supported)
- [x] Basic Vercel deployment integration
- [x] Real-time deployment monitoring (Vercel webhook)
- [x] Deployment status component
- [x] VS Code extension updates for Next.js support

### Week 3: Template Finalization

- [x] Next.js template setup scripts (setup.sh, setup.bat)
- [x] Template-aware VS Code extension
- [x] Project type detection and port management
- [x] Documentation and README updates
- [x] All type checks passing

### Week 3: UI and UX

- [ ] Web application updates
- [ ] Webhook handlers
- [ ] Environment sync logic

### Week 4: Testing and Polish

- [ ] Comprehensive testing
- [ ] Documentation updates
- [ ] Performance optimization

---

## Rollout Strategy

### Phase A: Internal Testing

- Deploy to staging environment
- Test with internal projects
- Validate all workflows

### Phase B: Beta Release

- Enable for select users
- Gather feedback
- Fix critical issues

### Phase C: Full Release

- Enable for all users
- Monitor metrics
- Provide user support

---

## Success Metrics

- [ ] Next.js projects can be created successfully
- [ ] File sync works identically to Vite projects
- [ ] Vercel deployments complete automatically
- [ ] Environment variables sync properly
- [ ] VS Code extension works with both templates
- [ ] No regression in existing Vite functionality

This plan maintains the existing architecture's strengths while seamlessly adding Next.js + Vercel support through parallel implementation paths.
