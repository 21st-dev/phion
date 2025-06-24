# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0-beta.1] - 2024-12-19

### 🎉 Major Features

#### Next.js Support

- **NEW**: Full Next.js template support alongside existing Vite support
- **NEW**: Automatic project type detection (Vite vs Next.js)
- **NEW**: Next.js plugin with webpack toolbar integration
- **NEW**: Vercel deployment integration for Next.js projects

#### Dual Platform Architecture

- **Enhanced**: Template selection UI with Vite and Next.js options
- **Enhanced**: Platform-aware deployment (Netlify for Vite, Vercel for Next.js)
- **Enhanced**: Real-time deployment monitoring for both platforms
- **Enhanced**: Environment variable sync for both Netlify and Vercel

#### VS Code Extension

- **Enhanced**: Automatic project type detection
- **Enhanced**: Dynamic port management (5173 for Vite, 3000 for Next.js)
- **Enhanced**: Template-aware server monitoring and startup commands
- **Enhanced**: Cross-platform setup scripts

### 🔧 Technical Improvements

#### Database & Types

- **Added**: Migration 016 with Vercel-specific fields
- **Updated**: Type system to support "vite" | "nextjs" templates
- **Enhanced**: Project schema with dual platform support

#### Services & APIs

- **Added**: Complete Vercel API service integration
- **Added**: Vercel webhook handling for deployment status
- **Enhanced**: WebSocket server with dual platform support
- **Enhanced**: Environment synchronization for both platforms

#### Frontend

- **Added**: Beautiful template selection interface
- **Added**: Platform-aware deployment status component
- **Enhanced**: Project settings with template and platform display
- **Enhanced**: Real-time status updates via WebSocket

### 📦 Package Updates

#### New Exports

- `phion/plugin-next` - Next.js webpack plugin
- Enhanced `phion/plugin` - Improved Vite plugin

#### Dependencies

- **Added**: Optional Next.js peer dependency
- **Updated**: Keywords to include Next.js, Vercel, Netlify

### 🐛 Bug Fixes

- **Fixed**: Type checking issues across all packages
- **Fixed**: Template type constraints in database
- **Fixed**: Environment variable parsing and sync

### 📚 Documentation

- **Added**: Comprehensive Next.js template README
- **Added**: Configuration examples and troubleshooting guide
- **Enhanced**: Architecture documentation for dual platform support

---

## [0.0.6] - Previous Version

Previous Vite-only implementation.

---

### Migration Guide

#### For Existing Vite Projects

- No changes required - existing projects continue to work as before
- Template type automatically detected as "vite"

#### For New Next.js Projects

1. Select "Next.js" template when creating project
2. Use `pnpm phion:start` command in VS Code
3. Projects automatically deploy to Vercel

#### For Developers

- Update to `phion@0.1.0-beta.1` in your projects
- VS Code extension automatically updates to v0.1.0
- New exports available: `phion/plugin-next`
