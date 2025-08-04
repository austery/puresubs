# PureSubs 项目实施计划

## 项目概述

PureSubs 是一个双核心项目，包含：

1. **核心数据引擎** (Core Engine) - 从YouTube视频URL提取结构化元数据和字幕
2. **Chrome浏览器扩展** (Chrome Extension) - 为用户提供手动下载字幕的体验

## 项目架构

```
PureSubs/
├── packages/
│   ├── core-engine/          # 核心引擎 (环境无关)
│   │   ├── src/
│   │   │   ├── index.ts      # 主入口函数
│   │   │   ├── extractor.ts  # YouTube数据提取
│   │   │   ├── parser.ts     # 字幕解析和格式化
│   │   │   └── utils.ts      # 工具函数
│   │   ├── tests/            # 单元测试
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── chrome-extension/     # Chrome扩展
│       ├── src/
│       │   ├── manifest.json # Manifest V3配置
│       │   ├── content/      # 内容脚本
│       │   ├── background/   # 后台脚本
│       │   ├── popup/        # 弹窗界面
│       │   └── options/      # 配置页面
│       ├── dist/             # 构建输出
│       └── package.json
│
├── tools/
│   └── n8n-node/            # 未来的n8n节点
│
├── docs/                     # 项目文档
├── examples/                 # 使用示例
└── package.json              # 根package.json (monorepo)
```

## 分阶段实施计划

### 第一阶段：核心引擎开发 (Foundation) - 2-3周

#### Milestone 1.1: 项目基础设施搭建

- [ ] 创建monorepo项目结构
- [ ] 配置TypeScript + Jest测试环境
- [ ] 设置Linting和代码格式化
- [ ] 创建CI/CD流水线配置

#### Milestone 1.2: 数据获取与解析 (M1.1)

- [ ] 实现 `getYouTubeData(url)` 主函数
- [ ] 模拟浏览器请求获取YouTube页面HTML
- [ ] 提取 `ytInitialPlayerResponse` JSON对象
- [ ] **验收标准**: 输入URL能打印提取的JSON对象

#### Milestone 1.3: 字幕与元数据提取 (M1.2)

- [ ] 解析视频标题、描述信息
- [ ] 提取可用字幕语言列表
- [ ] 获取和解析字幕XML文件
- [ ] 转换为中间数据结构
- [ ] **验收标准**: 能打印标题、描述和指定语言的字幕数组

#### Milestone 1.4: 格式化与输出 (M1.3)

- [ ] 实现SRT格式转换函数
- [ ] 实现TXT格式转换函数
- [ ] 整合完整的返回JSON结构
- [ ] **验收标准**: 返回包含所有数据的完整JSON对象

#### Milestone 1.5: 测试覆盖 (M1.4)

- [ ] 编写全面的单元测试
- [ ] 创建模拟数据文件
- [ ] 覆盖边界情况（无字幕、多语言等）
- [ ] **验收标准**: 测试覆盖率95%+，所有测试通过

### 第二阶段：Chrome扩展开发 (Application) - 2-3周

#### Milestone 2.1: 扩展MVP (M2.1)

- [ ] 创建Manifest V3基础配置
- [ ] 实现UI按钮注入到YouTube页面
- [ ] 集成核心引擎
- [ ] 实现基础下载功能
- [ ] **验收标准**: 点击按钮能下载英文SRT文件

#### Milestone 2.2: 完整功能实现 (M2.2)

- [ ] 开发语言/格式选择UI界面
- [ ] 实现用户配置页面
- [ ] 集成chrome.storage保存偏好
- [ ] 添加视频描述下载选项
- [ ] 实现一键下载功能
- [ ] **验收标准**: 实现PRD中所有定义功能

#### Milestone 2.3: 用户体验优化

- [ ] 美化UI界面，保持与YouTube一致
- [ ] 添加加载状态和错误处理
- [ ] 实现离线缓存机制
- [ ] 性能优化和代码压缩

### 第三阶段：自动化工具集成 (Automation) - 1-2周

#### Milestone 3.1: Node.js模块化 (M3.1)

- [ ] 将核心引擎打包为npm模块
- [ ] 创建n8n自定义节点
- [ ] 编写自动化脚本示例
- [ ] **验收标准**: 自动化流程成功运行

## 技术栈选择

### 核心引擎

- **语言**: TypeScript
- **测试**: Jest + @testing-library
- **构建**: Rollup/Webpack
- **网络请求**: Fetch API (浏览器) / node-fetch (Node.js)

### Chrome扩展

- **框架**: Vanilla JS/TS (轻量化)
- **UI**: Web Components + CSS
- **构建**: Webpack + Chrome Extension特定配置
- **存储**: chrome.storage API

### 工具链

- **包管理**: pnpm (monorepo支持)
- **代码质量**: ESLint + Prettier
- **版本控制**: Conventional Commits
- **CI/CD**: GitHub Actions

## 成功指标

### 技术指标

- [ ] 核心引擎单元测试覆盖率 ≥ 95%
- [ ] Chrome扩展包大小 ≤ 500KB
- [ ] 数据提取成功率 ≥ 98%
- [ ] 平均响应时间 ≤ 3秒

### 用户指标

- [ ] Chrome网上应用店评分 ≥ 4.5星
- [ ] 用户反馈问题解决率 ≥ 90%
- [ ] 每周活跃用户持续增长

## 风险评估与应对

### 技术风险

1. **YouTube API变化**: 维护多个备用提取策略
2. **CORS限制**: 使用代理服务或扩展权限
3. **反爬虫机制**: 实现请求频率控制和UA轮换

### 合规风险

1. **版权问题**: 明确用户责任，仅提供工具
2. **隐私保护**: 本地处理，不上传用户数据
3. **平台政策**: 严格遵循Chrome网上应用店政策

## 下一步行动

1. **立即开始**: 创建项目基础结构
2. **第一周**: 完成开发环境搭建和核心引擎框架
3. **第二周**: 实现数据提取核心功能
4. **第三周**: 完成测试覆盖和功能验证

---

*此计划将根据开发进度和用户反馈持续调整优化*
