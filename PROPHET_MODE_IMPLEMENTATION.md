# Prophet Mode Implementation (先知模式)

## 问题背景 Problem Background

用户发现了一个重要的状态污染问题：当从有字幕的视频切换到无字幕的视频时，扩展会下载错误的字幕。这是因为缓存中保留了上一个视频的字幕数据。

## 解决方案 Solution

### 1. 状态污染清理 State Pollution Cleanup

在 `handleVideoChange()` 函数中添加了缓存清理：

```typescript
// Clear cache to prevent state pollution
subtitleCache.clear();
console.log('[PureSubs] Cache cleared for new video');
```

### 2. 先知模式检查 Prophet Mode Check

实现了 `injectDownloadButtonWithProphetMode()` 函数，在创建下载按钮之前主动检查字幕可用性：

```typescript
function injectDownloadButtonWithProphetMode(): void {
  console.log('[PureSubs] Starting prophet mode check...');
  
  // Check if subtitles are available before creating button
  try {
    const playerResponse = extractPlayerResponseFromPage();
    const availableSubtitles = extractSubtitleTracks(playerResponse);
    
    console.log('[PureSubs] Prophet mode check - available subtitles:', availableSubtitles);
    
    if (!availableSubtitles || availableSubtitles.length === 0) {
      console.log('[PureSubs] Prophet mode: No subtitles available for this video, not creating button');
      // Don't create button for videos without subtitles
      return;
    }
    
    console.log('[PureSubs] Prophet mode: Subtitles available, proceeding with button creation');
    injectDownloadButton();
  } catch (error) {
    console.warn('[PureSubs] Prophet mode check failed, falling back to regular injection:', error);
    injectDownloadButton();
  }
}
```

## 功能特点 Key Features

### ✅ 预防性设计 Preventive Design

- **问题**: 用户不知道当前视频是否有字幕就点击下载
- **解决**: 先知模式预先检查 `ytInitialPlayerResponse.captions` 来判断字幕可用性
- **效果**: 无字幕视频不显示下载按钮，避免用户困惑

### ✅ 状态隔离 State Isolation  

- **问题**: 不同视频间的缓存相互污染
- **解决**: 视频切换时清空 `subtitleCache.clear()`
- **效果**: 确保每个视频都有干净的状态起点

### ✅ 优雅降级 Graceful Fallback

- **问题**: 先知模式检查可能失败
- **解决**: try-catch 包装，失败时回退到常规模式
- **效果**: 保证基本功能的健壮性

## 技术实现 Technical Implementation

### 导入依赖 Import Dependencies

```typescript
import { extractPlayerResponseFromPage, extractSubtitleTracks } from '../core/browser-engine';
```

### 修改视频切换逻辑 Modified Video Change Logic

```typescript
// Old: Direct button injection
setTimeout(() => injectDownloadButton(), 1000);

// New: Prophet mode check first
setTimeout(() => injectDownloadButtonWithProphetMode(), 1000);
```

## 测试验证 Testing Verification

- ✅ 所有现有测试通过 (78 tests passed)
- ✅ 类型检查通过，无编译错误
- ✅ 缓存清理逻辑验证通过

## 用户体验改进 UX Improvements

### Before (问题状态)

1. 用户看到下载按钮 → 点击 → 等待 → 收到错误/错误字幕
2. 混乱：为什么有按钮但下载失败？

### After (先知模式)  

1. 有字幕视频：显示按钮 → 用户点击 → 成功下载
2. 无字幕视频：不显示按钮 → 用户知道此视频无字幕可下载

## 代码质量 Code Quality

- **类型安全**: 使用 TypeScript 严格类型检查
- **错误处理**: 完整的 try-catch 包装
- **日志记录**: 详细的调试信息
- **向后兼容**: 保持现有 API 不变

这个实现完美解决了用户提出的状态污染问题，并引入了预防性的用户体验设计。🎯
