# PureSubs 测试策略

## 测试哲学：多层次防护体系

### 核心认识：单元测试的局限性

单元测试虽然重要，但**不能独当一面**。Chrome 扩展开发中的许多问题属于：

- **运行时初始化冲突**：只在真实浏览器环境中显现
- **时序依赖问题**：涉及脚本加载顺序和异步操作  
- **环境特定行为**：Chrome 扩展 API、DOM 操作、消息传递

**实际案例**：我们的重复间谍脚本注入问题无法被单元测试发现，因为：

```typescript
// ❌ 单元测试中的模拟环境
jest.mock('chrome', () => ({
  scripting: { executeScript: jest.fn() }
}));

// ✅ 真实环境中的复杂交互
chrome.scripting.executeScript({
  target: { tabId: activeTab.id },
  files: ['core/injected-spy.js']
}).then(() => {
  // 实际的脚本注入和初始化过程
});
```

## 四层测试策略

### 第一层：单元测试 (Unit Testing)

**目标**：验证纯函数逻辑和状态管理

**覆盖率目标**：95%+  
**测试框架**：Jest + TypeScript  
**测试重点**：

- 数据解析逻辑
- 字幕格式转换
- 状态管理函数
- 工具函数

**实施示例**：

```typescript
// core-engine/src/__tests__/parser.test.ts
describe('字幕解析', () => {
  it('应该正确解析 YouTube XML 字幕', () => {
    const xmlContent = `
      <transcript>
        <text start="0" dur="2.5">Hello World</text>
      </transcript>
    `;
    
    const result = parseSubtitleXML(xmlContent);
    
    expect(result).toEqual([{
      start: 0,
      end: 2.5,
      text: 'Hello World'
    }]);
  });
});
```

**局限性认知**：
- ❌ 无法检测环境特定问题
- ❌ 无法验证组件间交互  
- ❌ 无法发现异步时序问题

### 第二层：集成测试 (Integration Testing)

**目标**：验证组件间交互和消息传递

**覆盖率目标**：80%+  
**测试范围**：

- Content Script ↔ Background Script 通信
- 间谍脚本 ↔ 内容脚本交互  
- 核心引擎与扩展的集成
- Chrome API 调用序列

**实施示例**：

```javascript
// chrome-extension/tests/integration/spy-communication.test.js
describe('间谍脚本通信集成测试', () => {
  it('应该正确处理间谍脚本就绪通知', async () => {
    const contentScript = new ContentScript();
    
    // 模拟间谍脚本发送就绪消息
    const spyMessage = {
      type: 'PURESUBS_SPY_READY',
      data: { status: 'ready', timestamp: Date.now() }
    };
    
    // 验证消息处理
    await contentScript.handleMessage(spyMessage);
    expect(contentScript.spyScriptReady).toBe(true);
    expect(contentScript.buttonState).toBe('ready');
  });

  it('应该防止重复间谍脚本注入', async () => {
    const injectionTracker = new InjectionTracker();
    
    // 第一次注入
    await injectionTracker.injectSpyScript(tabId);
    expect(injectionTracker.getInjectionCount(tabId)).toBe(1);
    
    // 尝试重复注入
    await injectionTracker.injectSpyScript(tabId);
    expect(injectionTracker.getInjectionCount(tabId)).toBe(1); // 应该被防止
  });
});
```

### 第三层：端到端测试 (E2E Testing)

**目标**：验证完整用户流程和真实环境行为

**覆盖率目标**：关键流程 100%  
**测试框架**：Playwright  
**测试环境**：真实 Chrome 浏览器 + 已加载扩展

**关键测试场景**：

```javascript
// tests/e2e/extension-workflow.spec.js
const { test, expect, chromium } = require('@playwright/test');

test.describe('PureSubs 扩展完整流程', () => {
  let context;
  let page;

  test.beforeAll(async () => {
    // 启动带扩展的浏览器
    const pathToExtension = path.join(__dirname, '../../packages/chrome-extension/dist');
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run'
      ]
    });
    
    page = await context.newPage();
  });

  test('完整字幕下载流程', async () => {
    // 1. 访问有字幕的 YouTube 视频
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    // 2. 等待扩展初始化
    await page.waitForFunction(() => {
      const button = document.querySelector('#puresubs-download-btn');
      return button && !button.classList.contains('disabled');
    }, { timeout: 15000 });
    
    // 3. 验证按钮状态
    const downloadButton = page.locator('#puresubs-download-btn');
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toHaveClass(/ready/);
    
    // 4. 点击下载按钮
    await downloadButton.click();
    
    // 5. 验证加载状态
    await expect(downloadButton).toHaveClass(/loading/);
    
    // 6. 等待下载完成
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    
    // 7. 验证文件
    expect(download.suggestedFilename()).toMatch(/.*\.(srt|txt)$/);
    
    // 8. 验证按钮恢复就绪状态
    await expect(downloadButton).toHaveClass(/ready/);
  });

  test('错误处理和恢复', async () => {
    // 访问无字幕视频
    await page.goto('https://www.youtube.com/watch?v=invalid');
    
    await page.waitForSelector('#puresubs-download-btn');
    const button = page.locator('#puresubs-download-btn');
    
    await button.click();
    
    // 验证错误状态
    await expect(button).toHaveClass(/error/);
    
    // 验证错误通知
    const errorNotification = page.locator('.puresubs-toast.error');
    await expect(errorNotification).toBeVisible();
    await expect(errorNotification).toContainText('字幕获取失败');
    
    // 验证自动恢复
    await page.waitForTimeout(3500);
    await expect(button).toHaveClass(/ready/);
  });
});
```

**环境特定测试**：

```javascript
test('间谍脚本注入防重复机制', async () => {
  // 模拟快速页面导航
  await page.goto('https://www.youtube.com/watch?v=video1');
  await page.waitForTimeout(1000);
  
  await page.goto('https://www.youtube.com/watch?v=video2');
  await page.waitForTimeout(1000);
  
  // 验证没有重复注入
  const spyScriptCount = await page.evaluate(() => {
    return document.querySelectorAll('script[data-puresubs-spy]').length;
  });
  
  expect(spyScriptCount).toBe(1);
});
```

### 第四层：性能测试 (Performance Testing)

**目标**：确保扩展不影响用户体验

**监控指标**：
- 内存使用量
- CPU 占用率  
- 页面加载时间影响
- 间谍脚本注入频率

**实施示例**：

```javascript
// tests/performance/resource-usage.spec.js
test('性能影响监控', async () => {
  const metricsCollector = new PerformanceMetrics();
  
  // 记录基准性能
  await page.goto('https://www.youtube.com/');
  const baselineMetrics = await page.evaluate(() => performance.getEntriesByType('navigation')[0]);
  
  // 启用扩展后测量
  await page.reload();
  const withExtensionMetrics = await page.evaluate(() => performance.getEntriesByType('navigation')[0]);
  
  // 验证性能影响在可接受范围内
  const loadTimeIncrease = withExtensionMetrics.loadEventEnd - baselineMetrics.loadEventEnd;
  expect(loadTimeIncrease).toBeLessThan(500); // 增加不超过500ms
});

test('内存泄漏检测', async () => {
  const initialMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
  
  // 模拟大量操作
  for (let i = 0; i < 10; i++) {
    await page.goto(`https://www.youtube.com/watch?v=test${i}`);
    await page.waitForTimeout(1000);
  }
  
  // 强制垃圾回收
  await page.evaluate(() => {
    if (window.gc) window.gc();
  });
  
  const finalMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
  const memoryIncrease = finalMemory - initialMemory;
  
  // 验证内存增长在合理范围内
  expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 小于10MB
});
```

## 测试基础设施

### CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Comprehensive Testing

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:unit
      - run: pnpm test:coverage

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - run: npx playwright install
      - run: pnpm test:e2e
```

### 测试数据管理

```typescript
// tests/fixtures/youtube-samples.ts
export const YOUTUBE_TEST_VIDEOS = {
  WITH_CHINESE_SUBTITLES: 'https://www.youtube.com/watch?v=example1',
  WITH_ENGLISH_ONLY: 'https://www.youtube.com/watch?v=example2',
  NO_SUBTITLES: 'https://www.youtube.com/watch?v=example3',
  LIVE_STREAM: 'https://www.youtube.com/watch?v=example4'
};

export const MOCK_SUBTITLE_DATA = {
  chineseXML: `<?xml version="1.0" encoding="utf-8" ?>
    <transcript>
      <text start="0" dur="2.5">你好世界</text>
    </transcript>`,
  englishXML: `<?xml version="1.0" encoding="utf-8" ?>
    <transcript>
      <text start="0" dur="2.5">Hello World</text>
    </transcript>`
};
```

## 实施时间线

### Phase 1: 基础建设 (1-2 周)
- ✅ 增强单元测试覆盖率
- ✅ 设置 Jest 配置
- 🔄 建立测试数据和 Mock 策略

### Phase 2: 集成测试 (2-3 周)
- 🚀 Content Script 通信测试
- 🚀 间谍脚本集成测试  
- 🚀 Chrome API 调用序列测试

### Phase 3: E2E 框架 (2-3 周)  
- 🎯 Playwright 环境配置
- 🎯 关键用户流程覆盖
- 🎯 错误场景和边界测试

### Phase 4: 性能监控 (1-2 周)
- 📊 性能基准建立
- 📊 持续监控集成
- 📊 回归测试自动化

## 测试最佳实践

### 命名约定

```
/tests
  /unit           # 单元测试
    /core-engine
    /chrome-extension
  /integration    # 集成测试
    /messaging
    /api-calls  
  /e2e            # 端到端测试
    /user-flows
    /error-scenarios
  /performance    # 性能测试
  /fixtures       # 测试数据
```

### 测试策略矩阵

| 测试类型 | 速度 | 成本 | 环境真实度 | 问题发现能力 | 主要用途 |
|---------|------|------|-----------|-------------|----------|
| 单元测试 | 快 | 低 | 低 | 逻辑错误 | 快速反馈 |
| 集成测试 | 中 | 中 | 中 | 接口问题 | 组件协作 |
| E2E 测试 | 慢 | 高 | 高 | 用户体验 | 完整流程 |
| 性能测试 | 慢 | 高 | 高 | 性能回归 | 质量保证 |

## 质量门禁

### 代码提交要求
- 单元测试覆盖率 ≥ 95%
- 集成测试覆盖率 ≥ 80%
- 所有 E2E 关键流程通过
- 性能回归检查通过

### 发布前检查清单
- [ ] 全套测试通过
- [ ] 性能指标达标
- [ ] 错误场景验证
- [ ] 多浏览器版本兼容
- [ ] 安全性检查完成

## 总结

这套**四层测试策略**确保：

✅ **快速反馈** - 单元测试提供即时验证  
✅ **组件质量** - 集成测试确保协作正常  
✅ **用户体验** - E2E 测试验证完整流程  
✅ **性能保证** - 性能测试防止回归  

**核心理念**：不同层次的测试解决不同层次的问题，**组合使用才能构建可靠的软件**。

---

*"测试不是成本，是投资。每一个测试用例都是对未来稳定性的投资。"*  
*— PureSubs 测试哲学*