# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PureSubs is a dual-core TypeScript project for extracting YouTube subtitles and metadata:
- **@puresubs/core-engine**: Environment-agnostic data extraction engine
- **@puresubs/chrome-extension**: Chrome browser extension for manual subtitle downloads

This is a pnpm monorepo using workspace structure.

## Common Development Commands

### Root Level Commands
```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run development mode (watches for changes)
pnpm dev

# Lint all packages
pnpm lint

# Fix linting issues
pnpm lint:fix

# Clean all build outputs
pnpm clean
```

### Core Engine Package Commands
```bash
cd packages/core-engine

# Build with rollup in watch mode
pnpm dev

# Build production bundle
pnpm build

# Run Jest tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Lint TypeScript files
pnpm lint
```

### Chrome Extension Package Commands
```bash
cd packages/chrome-extension

# Build extension in development mode with watch
pnpm dev

# Build production extension
pnpm build

# Build development version
pnpm build:dev

# Package extension for Chrome Web Store
pnpm package
```

## Project Architecture

### Monorepo Structure
- Uses pnpm workspaces defined in `pnpm-workspace.yaml`
- Packages are located in `packages/` directory
- Core engine is a library consumed by the Chrome extension via workspace dependency

### Core Engine (`@puresubs/core-engine`)
- **Main Entry**: `src/index.ts` - Exports main API and TypeScript interfaces
- **Key Modules**:
  - `extractor.ts` - YouTube data extraction logic
  - `parser.ts` - Subtitle parsing and format conversion
  - `utils.ts` - Utility functions
- **Build**: Uses Rollup for bundling (config not yet created)
- **Testing**: Jest with coverage targets of 95%+
- **Output**: CommonJS and ESM bundles with TypeScript declarations

### Chrome Extension (`@puresubs/chrome-extension`)
- **Manifest**: Uses Manifest V3 (`src/manifest.json`)
- **Architecture**:
  - `background/` - Service worker scripts
  - `content/` - Content scripts injected into YouTube pages  
  - `popup/` - Extension popup interface (planned)
  - `options/` - Settings page (planned)
- **Build**: Webpack with Chrome extension specific configuration
- **Integration**: Consumes core engine via workspace dependency

## Development Status

The project is in Foundation phase (Phase 1) according to PROJECT_PLAN.md:
- Basic project structure and build system are set up
- Core interfaces are defined but implementation is placeholder
- Chrome extension has Manifest V3 structure but minimal functionality
- Test infrastructure is configured but tests need implementation

## Key Implementation Notes

### Core Engine API
The main function signature is:
```typescript
getYouTubeData(url: string, options: ExtractOptions): Promise<YouTubeVideoData>
```

Key interfaces:
- `YouTubeVideoData` - Main return type with title, description, subtitles
- `SubtitleTrack` - Represents available subtitle languages
- `SubtitleEntry` - Individual subtitle with timing and text
- `ExtractOptions` - Configuration for extraction behavior

### Chrome Extension Integration
- Uses Manifest V3 with service worker background script
- Content scripts inject into YouTube watch pages
- Permissions for activeTab, storage, downloads, and YouTube domains
- Plans for popup UI and options page

## Testing Strategy
- Core engine targets 95%+ test coverage with Jest
- Chrome extension targets 85%+ coverage
- Uses `jest.config.js` in core-engine package
- Mock data files planned for testing edge cases

## Build Tools
- **Package Manager**: pnpm (required version 8+)
- **TypeScript**: Version 5.x across packages
- **Linting**: ESLint with TypeScript plugin
- **Formatting**: Prettier
- **Core Engine Build**: Rollup (configuration pending)
- **Extension Build**: Webpack with Chrome extension plugins

## Language Requirements
- Node.js 18+
- TypeScript 5.x
- Uses conventional commits for version control