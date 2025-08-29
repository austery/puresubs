# PureSubs 架构概述

## 整体架构设计原则

### 核心设计理念

PureSubs 采用**模块化、环境无关、用户体验优先**的架构设计：

- **分离关注点**: 数据提取逻辑与用户界面完全解耦
- **环境无关**: 核心引擎可运行在任何 JavaScript 环境
- **可扩展性**: 支持多种客户端和集成方式
- **可测试性**: 每个组件都有明确的接口和测试策略

### 架构分层

```
┌─────────────────────────────────────────┐
│           用户界面层 (UI Layer)           │
├─────────────────────────────────────────┤
│        应用逻辑层 (Application)         │  
├─────────────────────────────────────────┤
│          核心引擎层 (Core)              │
├─────────────────────────────────────────┤
│        数据获取层 (Data Access)         │
└─────────────────────────────────────────┘
```

## 模块架构

### 1. Core Engine (`@puresubs/core-engine`)

**职责**: 环境无关的 YouTube 数据提取和字幕处理

#### 核心组件

```
core-engine/
├── src/
│   ├── index.ts          # 🎯 主 API 接口
│   ├── extractor.ts      # 📡 数据提取引擎
│   ├── parser.ts         # 📝 字幕解析器
│   ├── utils.ts          # 🛠️ 通用工具
│   └── types.ts          # 📋 TypeScript 类型定义
└── tests/                # 🧪 单元测试 (95%+ 覆盖)
```

#### 关键接口

```typescript
// 主要 API
export async function getYouTubeData(
  url: string,
  options: ExtractOptions = {}
): Promise<YouTubeVideoData>

// 核心数据结构
interface YouTubeVideoData {
  title: string;
  description: string;
  availableSubtitles: SubtitleTrack[];
  subtitles?: {
    srt: string;    // SRT 格式
    txt: string;    // 纯文本格式  
    entries: SubtitleEntry[];  // 结构化数据
  };
}
```

#### 数据处理流程

```
URL 输入 → HTML 获取 → PlayerResponse 提取 → 元数据解析 → 字幕获取 → 格式转换 → 结果返回
```

### 2. Chrome Extension (`@puresubs/chrome-extension`)

**职责**: 用户友好的浏览器集成体验

#### 架构组件

```
chrome-extension/
├── src/
│   ├── manifest.json     # 📋 Manifest V3 配置
│   ├── content/          # 🌐 内容脚本
│   │   ├── youtube.ts    # YouTube 页面集成
│   │   └── ui.ts         # UI 组件管理
│   ├── background/       # 🔄 后台服务
│   │   └── service.ts    # 后台处理逻辑
│   └── core/             # 🕵️ 核心注入系统
│       ├── injected-spy.js    # 间谍脚本
│       └── intercept.ts       # 网络拦截
└── dist/                 # 🚀 构建输出
```

#### 通信架构

```
┌─────────────────┐    Messages    ┌──────────────────┐
│   Background    │ ◀──────────── │  Content Script  │
│     Service     │ ──────────▶   │   (youtube.ts)   │
└─────────────────┘                └──────────────────┘
                                           │ 
                                           │ DOM Manipulation
                                           ▼
                                   ┌──────────────────┐
                                   │   Injected Spy   │
                                   │    Script        │
                                   │  (network        │
                                   │  interception)   │
                                   └──────────────────┘
```

#### 关键技术实现

1. **间谍脚本注入**: 向页面注入网络拦截脚本
2. **握手协议**: 确保脚本间通信可靠性  
3. **Prophet Mode**: 预验证字幕可用性
4. **状态管理**: 四层交互反馈系统

### 3. PKM Automation (`@puresubs/pkm-automation`)

**职责**: API 服务，支持自动化和第三方集成

#### 服务架构

```
pkm-automation/
├── src/
│   ├── index.ts          # 🌐 Express 服务器
│   ├── routes/           # 🛤️ API 路由
│   ├── middleware/       # 🔧 中间件
│   └── types.ts          # 📋 API 类型定义
└── dist/                 # 🚀 构建输出
```

#### API 设计

```typescript
// 主要 API 端点
POST /api/v1/subtitle
{
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "options": {
    "preferredLanguages": ["zh-Hans", "en"],
    "extractSubtitles": true
  }
}

// 响应格式
{
  "success": true,
  "data": {
    "title": "视频标题",
    "subtitles": { ... }
  }
}
```

## 数据流架构

### Chrome Extension 数据流

```
用户操作 → 内容脚本 → 间谍脚本 → 网络拦截 → 数据获取 → 核心引擎 → 格式化 → 下载
    ↓         ↓         ↓          ↓         ↓        ↓        ↓       ↓
  点击按钮   注入UI    拦截请求    获取响应   解析数据  格式转换  生成文件  触发下载
```

### API Service 数据流

```
HTTP 请求 → 路由处理 → 参数验证 → 核心引擎调用 → 数据处理 → JSON 响应
    ↓         ↓         ↓         ↓          ↓        ↓
  POST      Express   验证URL    提取字幕    格式化    返回结果
```

## 核心技术决策

### 1. 网络请求拦截技术

**问题**: YouTube 使用动态加载和反解析机制，传统 DOM 解析无法获取字幕数据。

**解决方案**:

- 注入间谍脚本到页面上下文
- 拦截 `fetch` 和 `XMLHttpRequest`
- 捕获字幕请求的原始响应

**技术实现**:

```javascript
// 间谍脚本核心
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const result = originalFetch.apply(this, args);
  
  result.then(response => {
    if (isSubtitleRequest(response.url)) {
      interceptSubtitleResponse(response);
    }
  });
  
  return result;
};
```

### 2. 可靠通信协议

**问题**: 内容脚本与间谍脚本间的消息传递存在时序问题。

**解决方案**:

- 实现握手确认机制
- 消息重试和确认机制
- 状态同步和错误恢复

### 3. Prophet Mode 决策门

**问题**: 在无字幕页面显示下载按钮会造成用户困惑。

**解决方案**:

- 预验证字幕可用性
- 只在确认有字幕时注入 UI
- 实现 100% 用户预期匹配

## 技术栈

### 开发技术栈

| 层级 | 技术选择 | 原因 |
|------|----------|------|
| **语言** | TypeScript | 类型安全、开发效率、生态系统 |
| **构建工具** | pnpm + Rollup/Webpack | Monorepo 支持、构建优化 |
| **测试框架** | Jest + Playwright | 单元测试 + E2E 测试覆盖 |
| **代码质量** | ESLint + Prettier | 代码规范和一致性 |
| **API 框架** | Express.js | 成熟、轻量、易于扩展 |

### 运行时环境

| 组件 | 环境 | 要求 |
|------|------|------|
| **Core Engine** | Universal | Node.js 18+ / Modern Browser |
| **Chrome Extension** | Browser | Chrome 88+ (Manifest V3) |
| **PKM API** | Server | Node.js 18+ |

## 安全考虑

### 1. 内容安全策略 (CSP)

- 间谍脚本使用 `eval` 和动态代码执行
- 通过 Manifest V3 的 `scripting` API 安全注入
- 限制脚本权限和访问范围

### 2. 数据隐私

- 不收集用户个人数据
- 字幕数据仅在本地处理
- 不向外部服务器发送用户数据

### 3. 权限最小化

- 仅请求必要的 Chrome 权限
- `activeTab` 而非 `tabs` 权限
- 限制网络请求范围

## 可扩展性设计

### 1. 插件化架构

核心引擎支持插件化扩展：

```typescript
interface DataExtractor {
  canHandle(url: string): boolean;
  extract(url: string): Promise<VideoData>;
}

// 未来支持其他平台
class BilibiliExtractor implements DataExtractor { ... }
class VimeoExtractor implements DataExtractor { ... }
```

### 2. 多客户端支持

```
                    @puresubs/core-engine
                            │
            ┌───────────────┼───────────────┐
            │               │               │
    Chrome Extension    CLI Tool        Web App
            │               │               │
      浏览器用户           开发者         企业用户
```

### 3. 格式扩展

```typescript
interface SubtitleFormatter {
  format(entries: SubtitleEntry[]): string;
}

// 支持更多格式
class VTTFormatter implements SubtitleFormatter { ... }
class ASSFormatter implements SubtitleFormatter { ... }
```

## 性能优化

### 1. 缓存策略

- **内存缓存**: 已提取的视频数据
- **本地存储**: 用户偏好设置
- **智能失效**: 基于视频 ID 的缓存管理

### 2. 懒加载

- 按需加载核心引擎
- 异步字幕格式转换
- 延迟 UI 组件初始化

### 3. 资源优化

- 最小化打包体积
- Tree-shaking 无用代码
- 分离第三方依赖

## 监控和调试

### 1. 日志分级

- **DEBUG**: 详细的执行流程
- **INFO**: 关键状态变化
- **WARN**: 可恢复的错误
- **ERROR**: 需要处理的异常

### 2. 性能监控

- 字幕提取耗时
- 网络请求延迟
- 内存使用情况

### 3. 错误上报

- 异常捕获和分类
- 用户反馈机制
- 诊断信息收集

---

*"优秀的架构不是一开始就完美的，而是能够优雅地应对变化和增长。"*  
*— PureSubs 架构哲学*
