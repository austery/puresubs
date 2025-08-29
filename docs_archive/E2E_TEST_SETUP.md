# 🎪 E2E测试配置：Playwright + Chrome扩展

## 安装和配置

### 1. 安装依赖
```bash
cd packages/chrome-extension
pnpm add -D @playwright/test playwright-chromium
npx playwright install chromium
```

### 2. 创建E2E配置文件
```javascript
// playwright.config.js
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'https://www.youtube.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-extension',
      use: { 
        ...devices['Desktop Chrome'],
        // 添加扩展路径
        args: [
          `--disable-extensions-except=${path.join(__dirname, 'dist')}`,
          `--load-extension=${path.join(__dirname, 'dist')}`,
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ],
      },
    },
  ],
});
```

### 3. E2E测试用例
```javascript
// e2e/puresubs-extension.spec.js
import { test, expect } from '@playwright/test';

test.describe('PureSubs Chrome Extension', () => {
  test.beforeEach(async ({ page }) => {
    // 等待扩展加载
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);
  });

  test('应该在有字幕的视频页面显示下载按钮', async ({ page }) => {
    // 访问已知有字幕的视频
    await page.goto('/watch?v=jNQXAC9IVRw');
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 等待PureSubs按钮出现
    const downloadButton = page.locator('#puresubs-download-btn');
    await expect(downloadButton).toBeVisible({ timeout: 15000 });
    
    // 验证按钮可点击（不是禁用状态）
    await expect(downloadButton).toBeEnabled();
    
    // 验证按钮文字
    await expect(downloadButton).toContainText(['下载字幕', 'Download', 'PureSubs']);
  });

  test('应该在无字幕的视频页面不显示按钮', async ({ page }) => {
    // 访问已知无字幕的视频（需要找一个确定无字幕的视频）
    await page.goto('/watch?v=no-subtitles-video-id');
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // 验证PureSubs按钮不存在
    const downloadButton = page.locator('#puresubs-download-btn');
    await expect(downloadButton).not.toBeVisible();
  });

  test('应该成功下载字幕文件', async ({ page }) => {
    // 访问有字幕的视频
    await page.goto('/watch?v=jNQXAC9IVRw');
    await page.waitForLoadState('networkidle');
    
    // 等待并点击下载按钮
    const downloadButton = page.locator('#puresubs-download-btn');
    await expect(downloadButton).toBeVisible({ timeout: 15000 });
    await expect(downloadButton).toBeEnabled();
    
    // 设置下载事件监听
    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    
    // 验证下载开始
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(srt|txt)$/);
    
    // 验证下载内容不为空
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('应该正确处理语言选择', async ({ page }) => {
    await page.goto('/watch?v=multilingual-video-id');
    await page.waitForLoadState('networkidle');
    
    const downloadButton = page.locator('#puresubs-download-btn');
    await expect(downloadButton).toBeVisible({ timeout: 15000 });
    
    // 如果有语言选择功能，测试语言切换
    const languageSelector = page.locator('#puresubs-language-selector');
    if (await languageSelector.isVisible()) {
      await languageSelector.selectOption('zh-Hans');
      await downloadButton.click();
      
      const download = await page.waitForEvent('download');
      expect(download.suggestedFilename()).toContain('zh-Hans');
    }
  });

  test('应该正确显示错误消息', async ({ page }) => {
    // 模拟网络错误或其他错误情况
    await page.route('**/*', route => {
      if (route.request().url().includes('timedtext')) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    await page.goto('/watch?v=jNQXAC9IVRw');
    await page.waitForLoadState('networkidle');
    
    const downloadButton = page.locator('#puresubs-download-btn');
    await expect(downloadButton).toBeVisible({ timeout: 15000 });
    await downloadButton.click();
    
    // 验证错误消息显示
    const errorMessage = page.locator('#puresubs-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(['错误', 'Error', '失败']);
  });
});
```

### 4. 性能监控测试
```javascript
// e2e/performance.spec.js
import { test, expect } from '@playwright/test';

test.describe('PureSubs性能监控', () => {
  test('应该监控间谍脚本注入次数', async ({ page }) => {
    let spyInjectionCount = 0;
    
    // 监听Console消息
    page.on('console', msg => {
      if (msg.text().includes('injectSpyScript')) {
        spyInjectionCount++;
      }
    });
    
    await page.goto('/watch?v=jNQXAC9IVRw');
    await page.waitForLoadState('networkidle');
    
    // 等待扩展初始化完成
    await page.waitForTimeout(5000);
    
    // 验证间谍脚本只注入一次
    expect(spyInjectionCount).toBeLessThanOrEqual(1);
  });

  test('应该监控页面性能影响', async ({ page }) => {
    // 开始性能监控
    await page.goto('/watch?v=jNQXAC9IVRw');
    
    const metrics = await page.evaluate(() => {
      return JSON.stringify(performance.getEntriesByType('navigation')[0]);
    });
    
    const navigation = JSON.parse(metrics);
    
    // 验证页面加载时间不会因扩展而显著增加
    expect(navigation.loadEventEnd - navigation.loadEventStart).toBeLessThan(3000);
  });
});
```

### 5. CI/CD集成
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'pnpm'
    
    - name: Install dependencies
      run: pnpm install
    
    - name: Build extension
      run: |
        cd packages/chrome-extension
        pnpm build
    
    - name: Install Playwright
      run: |
        cd packages/chrome-extension
        npx playwright install chromium
    
    - name: Run E2E tests
      run: |
        cd packages/chrome-extension
        npx playwright test
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: playwright-report
        path: packages/chrome-extension/playwright-report/
```

## 🎯 测试执行策略

### 开发阶段
```bash
# 只运行快速单元测试
pnpm test

# 运行特定的集成测试
pnpm test spy-injection.test.ts

# 本地E2E测试（慢但全面）
npx playwright test --headed
```

### CI/CD阶段
```bash
# 所有测试类型
pnpm test              # 单元测试
npx playwright test    # E2E测试
```

这样的多层次测试策略可以：
1. **快速反馈**：单元测试发现逻辑错误
2. **集成验证**：确保组件正确交互
3. **真实验证**：E2E测试发现环境特定问题
4. **回归防护**：防止类似的初始化冲突再次发生
