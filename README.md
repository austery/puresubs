# PureSubs - YouTube Subtitle Downloader

A powerful, dual-core project for extracting YouTube subtitles and metadata with both programmatic and user-friendly interfaces.

## 🎯 Project Overview

PureSubs consists of two main components:

1. **Core Engine** (`@puresubs/core-engine`) - A robust, environment-agnostic data extraction engine
2. **Chrome Extension** (`@puresubs/chrome-extension`) - A lightweight browser extension for manual subtitle downloads

## 🏗️ Architecture

```
PureSubs/
├── packages/
│   ├── core-engine/          # Core data extraction engine
│   └── chrome-extension/     # Chrome browser extension
├── tools/
│   └── n8n-node/            # Future: n8n automation node
└── docs/                     # Project documentation
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm 8+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd PureSubs

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Development

```bash
# Start development mode (watches for changes)
pnpm dev

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix
```

## 📦 Packages

### Core Engine

The heart of PureSubs - a TypeScript module that extracts YouTube video data:

```typescript
import { getYouTubeData } from '@puresubs/core-engine';

const videoData = await getYouTubeData('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
  preferredLanguages: ['en', 'zh-Hans'],
  extractSubtitles: true,
  subtitleLanguage: 'en'
});

console.log(videoData.title);
console.log(videoData.subtitles.srt);
```

### Chrome Extension

A user-friendly browser extension that provides:
- Seamless UI integration with YouTube
- One-click subtitle downloads
- Multiple format support (SRT, TXT)
- User preference management

## 🛣️ Development Roadmap

### Phase 1: Foundation (Current)
- [x] Project structure and build system
- [x] Core engine interface design
- [x] Chrome extension framework
- [x] Testing infrastructure
- [ ] Core data extraction implementation
- [ ] Basic Chrome extension functionality

### Phase 2: Core Features
- [ ] YouTube data parsing
- [ ] Subtitle format conversion
- [ ] Error handling and edge cases
- [ ] Chrome extension UI
- [ ] User preferences system

### Phase 3: Polish & Distribution
- [ ] Performance optimization
- [ ] Chrome Web Store submission
- [ ] Documentation and examples
- [ ] n8n node integration

## 🧪 Testing

We maintain high test coverage standards:

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific package tests
cd packages/core-engine && pnpm test
```

Current coverage targets:
- Core Engine: 95%+ coverage
- Chrome Extension: 85%+ coverage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Maintain test coverage above 90%
- Use conventional commit messages
- Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- YouTube for providing the platform
- The open-source community for inspiration and tools
- Contributors and users of PureSubs

---

**Built with ❤️ for content creators, researchers, and language learners worldwide.**
