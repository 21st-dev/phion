# 🚀 Phion v0.1.0-beta.1 - Next.js Support Release

## 🎉 Major New Features

### ✨ Next.js Template Support
- **Full Next.js 15 support** alongside existing Vite support
- **Automatic project detection** - choose between Vite or Next.js templates
- **Webpack integration** with toolbar injection for Next.js projects
- **Vercel deployment** for Next.js projects (Netlify for Vite projects)

### 🔄 Dual Platform Architecture
- **Template Selection UI** - beautiful interface to choose between Vite and Next.js
- **Platform-aware deployments** - Netlify for Vite, Vercel for Next.js
- **Real-time monitoring** for both deployment platforms
- **Environment sync** for both Netlify and Vercel

### 🛠 Enhanced VS Code Extension (v0.1.0)
- **Smart project detection** - automatically detects Vite vs Next.js projects
- **Dynamic port management** - 5173 for Vite, 3000 for Next.js
- **Template-aware commands** - correct startup commands for each project type
- **Cross-platform setup scripts** - works on Windows, macOS, and Linux

## 📦 Installation

### For New Projects
```bash
# Install the beta version
npm install -g phion@beta

# Create a new project (you'll be able to choose Vite or Next.js)
phion create my-app
```

### For Existing Projects
```bash
# Update to beta version
npm install phion@beta

# For Next.js projects, use the new plugin
// next.config.js
import { withPhionToolbar } from 'phion/plugin-next'

export default withPhionToolbar({
  // your existing Next.js config
})
```

## 🔧 Technical Improvements

### Database & Types
- ✅ Migration 016 with Vercel-specific fields
- ✅ Updated type system to support `"vite" | "nextjs"` templates
- ✅ Enhanced project schema with dual platform support

### Services & APIs
- ✅ Complete Vercel API service integration
- ✅ Vercel webhook handling for deployment status
- ✅ Enhanced WebSocket server with dual platform support
- ✅ Environment synchronization for both platforms

### Frontend Updates
- ✅ Beautiful template selection interface
- ✅ Platform-aware deployment status component
- ✅ Enhanced project settings with template and platform display
- ✅ Real-time status updates via WebSocket

## 🎯 New Package Exports

```typescript
// For Vite projects (existing)
import { phionPlugin } from 'phion/plugin'

// For Next.js projects (NEW!)
import { withPhionToolbar, createToolbarHandler } from 'phion/plugin-next'
```

## 🔄 Migration Guide

### Existing Vite Projects
- ✅ **No changes required** - existing projects continue to work as before
- ✅ Template type automatically detected as "vite"
- ✅ All existing functionality preserved

### New Next.js Projects
1. Select "Next.js" template when creating project
2. Use `pnpm phion:start` command in VS Code
3. Projects automatically deploy to Vercel
4. Real-time sync and environment management works the same

### For Developers
- Update to `phion@0.1.0-beta.1` in your projects
- VS Code extension automatically updates to v0.1.0
- New exports available: `phion/plugin-next`

## 🐛 Bug Fixes
- Fixed type checking issues across all packages
- Fixed template type constraints in database
- Fixed environment variable parsing and sync
- Enhanced error handling for both platforms

## 📚 Documentation
- Comprehensive Next.js template README
- Configuration examples and troubleshooting guide
- Enhanced architecture documentation for dual platform support

## ⚠️ Beta Notice

This is a **beta release** for testing the new Next.js integration. Please report any issues you encounter:

- **GitHub Issues**: [Report bugs and feedback](https://github.com/phion-dev/phion/issues)
- **Discord**: Join our community for real-time support

## 🔗 Quick Links

- **NPM Package**: [`phion@0.1.0-beta.1`](https://www.npmjs.com/package/phion/v/0.1.0-beta.1)
- **VS Code Extension**: Phion Dev Tools v0.1.0
- **Documentation**: [Getting Started Guide](https://docs.phion.dev)

---

**Ready to test?** Install with `npm install -g phion@beta` and create your first Next.js project! 🚀 