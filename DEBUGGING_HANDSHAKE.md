# 🔍 PureSubs 握手信号调试指南

## 📋 问题描述

**现象：** 按钮永远停留在"初始化中..."状态，无法变为可用状态。

**根本原因：** 内容脚本与间谍脚本之间的"握手信号"丢失。

## 🎯 我们的修复

### 1. **修复时序问题** 
- **问题：** 监听器设置得太晚（在脚本注入之后）
- **修复：** 重新调整代码执行顺序，确保先设置监听器，再注入脚本

### 2. **增强日志追踪**
- **问题：** 无法知道信号在哪里中断
- **修复：** 在关键位置添加详细日志

### 3. **双重保险机制**
- **问题：** 单次信号可能在时机不对时丢失
- **修复：** 间谍脚本发送两次就绪信号（100ms 和 500ms）

## 🧪 测试步骤

### 第一步：重新加载扩展
1. 打开 Chrome 扩展管理页面 (`chrome://extensions/`)
2. 找到 PureSubs 扩展
3. 点击 **"重新加载"** 按钮

### 第二步：打开调试工具
1. 打开一个 YouTube 视频页面
2. 按 `F12` 打开开发者工具
3. 切换到 **Console** 标签页
4. 刷新页面

### 第三步：查看日志输出

您应该能按顺序看到以下日志：

#### 📺 **内容脚本启动日志**
```
[PureSubs] Content script loaded and starting initialization
[PureSubs] 🎯 Message listener set up, now injecting spy script...
```

#### 🕵️ **间谍脚本注入日志**
```
[PureSubs Spy] 🕵️ Agent activated in main page context
[PureSubs Spy] ⏰ Setting up ready notification timer...
[PureSubs Spy] ⏰ Timer fired, calling notifyReady()
[PureSubs Spy] 🕵️ Spy is alive and has patched fetch. Sending READY signal now!
[PureSubs Spy] ✅ READY signal has been sent.
```

#### 🎯 **信号接收日志**
```
[PureSubs Content] Received a postMessage event, data: {type: "PURESUBS_SPY_READY", timestamp: 1693123456789}
[PureSubs Content] ✅ SUCCESS! Correct READY signal received. Enabling button...
[PureSubs Content] 🎯 Conditions met, changing button state to ready
[PureSubs Content] ✅ Button state changed and notification sent
```

#### 🎉 **成功指标**
- 页面上会弹出绿色通知："PureSubs 已就绪，可以下载字幕了！"
- 下载按钮从灰色变为蓝色，可以点击

## 🔍 故障排除

### 情况A：完全没有间谍脚本日志
**现象：** 只有内容脚本日志，没有任何 `[PureSubs Spy]` 日志

**可能原因：**
1. 脚本注入失败
2. YouTube 页面的安全策略阻止了脚本

**解决方案：**
1. 检查扩展权限设置
2. 确认在 manifest.json 中有正确的权限声明

### 情况B：间谍脚本启动但没有发送信号
**现象：** 有 `Agent activated` 但没有 `READY signal has been sent`

**可能原因：**
1. 间谍脚本执行中出错
2. `window.postMessage` 函数异常

**解决方案：**
1. 查看 Console 中是否有错误信息
2. 检查 `notifyReady()` 函数是否被调用

### 情况C：信号发送了但没有被接收
**现象：** 有 `READY signal has been sent` 但没有 `SUCCESS! Correct READY signal received`

**可能原因：**
1. 信号类型字符串不匹配
2. 消息监听器设置失败

**解决方案：**
1. 检查信号类型是否完全一致：`PURESUBS_SPY_READY`
2. 确认监听器在脚本注入前设置

### 情况D：信号接收了但按钮状态没变
**现象：** 有 `SUCCESS! Correct READY signal received` 但按钮还是灰色

**可能原因：**
1. 按钮还没创建
2. 按钮状态判断条件不满足

**解决方案：**
1. 查看日志中的条件检查信息
2. 确认按钮已正确注入到页面

## 📊 预期结果

**成功的完整流程应该是：**

```
时间线：
0ms   ├─ 内容脚本加载
1ms   ├─ 设置消息监听器  ✅
2ms   ├─ 注入间谍脚本    ✅
10ms  ├─ 间谍脚本激活    ✅
100ms ├─ 发送第1次就绪信号 ✅
101ms ├─ 内容脚本接收信号   ✅
102ms ├─ 按钮状态变为就绪   ✅
103ms ├─ 显示成功通知      ✅
500ms └─ 发送第2次就绪信号 (备用)
```

## 💡 额外提示

1. **清除缓存：** 如果修改后没有效果，尝试硬刷新页面 (`Ctrl+Shift+R`)

2. **多页面测试：** 在不同的 YouTube 视频页面测试，确保稳定性

3. **时机测试：** 尝试在页面加载完成后再刷新，看是否影响结果

## 🆘 如果问题仍然存在

请提供完整的 Console 日志输出，特别是：
- 是否有错误信息
- 日志停在了哪一步
- 按钮的实际状态（颜色、文本）

这样我们就能精确定位问题所在！
