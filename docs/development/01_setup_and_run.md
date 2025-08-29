# 开发环境搭建与运行

## 环境要求

### 系统依赖

- **Node.js**: 18.0.0+
- **pnpm**: 8.0.0+ (包管理器)
- **Chrome**: 88+ (用于扩展测试)

### 开发工具

- **TypeScript**: 5.x
- **Jest**: 测试框架  
- **Playwright**: E2E 测试
- **ESLint + Prettier**: 代码规范

## 快速开始

### 1. 克隆和安装

```bash
# 克隆项目
git clone <repository-url>
cd PureSubs

# 安装所有依赖
pnpm install

# 验证安装
pnpm build
```

### 2. 开发模式启动

```bash
# 启动所有包的开发模式
pnpm dev

# 或分别启动
pnpm --filter @puresubs/core-engine dev
pnpm --filter @puresubs/chrome-extension dev
pnpm --filter @puresubs/pkm-automation dev
```

## 项目结构

```
PureSubs/
├── packages/
│   ├── core-engine/          # 核心引擎
│   ├── chrome-extension/     # Chrome 扩展
│   └── pkm-automation/       # API 服务
├── docs/                     # 文档
├── tools/                    # 开发工具
└── tests/                    # E2E 测试
```

## 核心开发命令

### 构建命令

```bash
pnpm build              # 构建所有包
pnpm build:core         # 只构建核心引擎
pnpm build:extension    # 只构建扩展
```

### 测试命令

```bash
pnpm test               # 运行所有测试
pnpm test:unit          # 单元测试
pnpm test:integration   # 集成测试
pnpm test:e2e           # E2E 测试
pnpm test:coverage      # 覆盖率报告
```

### 代码质量

```bash
pnpm lint               # 代码检查
pnpm lint:fix           # 自动修复
pnpm format             # 代码格式化
pnpm typecheck          # 类型检查
```

## Chrome 扩展开发

### 本地安装扩展

1. **构建扩展**

   ```bash
   cd packages/chrome-extension
   pnpm build:dev
   ```

2. **加载到 Chrome**
   - 打开 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `packages/chrome-extension/dist` 目录

3. **开发调试**

   ```bash
   pnpm dev  # 文件变化时自动重新构建
   ```

### 调试技巧

```javascript
// 内容脚本调试
console.log('[PureSubs Content]', data);

// 后台脚本调试  
chrome.tabs.query({}, (tabs) => {
  console.log('[PureSubs Background]', tabs);
});

// 间谍脚本调试
window.postMessage({
  type: 'PURESUBS_DEBUG',
  data: interceptedData
}, '*');
```

## E2E 测试设置

### Playwright 配置

```bash
# 安装 Playwright 浏览器
npx playwright install

# 运行 E2E 测试
pnpm test:e2e

# 带UI模式运行
pnpm test:e2e --ui
```

### 测试配置文件

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chrome-extension',
      use: { 
        ...devices['Desktop Chrome'],
        args: [
          '--disable-extensions-except=./packages/chrome-extension/dist',
          '--load-extension=./packages/chrome-extension/dist'
        ]
      }
    }
  ]
});
```

## 核心引擎开发

### API 测试

```typescript
// 测试核心引擎
import { getYouTubeData } from '@puresubs/core-engine';

const result = await getYouTubeData('https://youtube.com/watch?v=example', {
  extractSubtitles: true,
  preferredLanguages: ['zh-Hans', 'en']
});

console.log(result.title);
console.log(result.subtitles?.srt);
```

### 构建验证

```bash
cd packages/core-engine
pnpm build
pnpm test

# 检查输出文件
ls dist/
# 应该看到: index.js, index.d.ts, package.json
```

## CI/CD 集成

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install pnpm
        run: npm install -g pnpm
        
      - name: Install dependencies
        run: pnpm install
        
      - name: Build
        run: pnpm build
        
      - name: Test
        run: pnpm test
        
      - name: E2E Test
        run: pnpm test:e2e
```

## 性能监控

### 开发时监控

```bash
# 启用性能监控
PERFORMANCE_MONITORING=true pnpm dev

# 内存使用情况
node --inspect packages/core-engine/dist/index.js
```

### 构建分析

```bash
# 分析打包体积
pnpm build:analyze

# 依赖分析  
pnpm list --depth=0
```

## 常见问题解决

### 构建失败

```bash
# 清理缓存
pnpm clean
rm -rf node_modules
pnpm install

# 检查依赖冲突
pnpm list --depth=0
```

### 扩展加载问题

1. 确认 `manifest.json` 格式正确
2. 检查 CSP 策略配置
3. 查看 Chrome 扩展错误页面

### 测试失败

```bash
# 运行单个测试文件
pnpm test packages/core-engine/tests/parser.test.ts

# 调试模式
pnpm test --inspect-brk
```

## 发布准备

### 预发布检查

```bash
pnpm prerelease      # 运行完整测试套件
pnpm build          # 确保构建成功
pnpm lint           # 代码规范检查
pnpm typecheck      # 类型检查
```

### 版本管理

```bash
# 更新版本号
pnpm changeset
pnpm changeset version

# 发布
pnpm publish --recursive
```

---

*"优秀的开发环境是高质量代码的基础。"*  
*— PureSubs 开发哲学*
