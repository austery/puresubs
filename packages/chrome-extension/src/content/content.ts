/**
 * Content Script for PureSubs Chrome Extension
 * 
 * This script injects the subtitle download button into YouTube video pages
 * and handles the user interaction for downloading subtitles.
 */

import { extractPlayerResponseFromPage, extractSubtitleTracks } from '../core/browser-engine';

console.log('[PureSubs] Content script loaded and starting initialization');
console.log('[PureSubs] Current URL:', location.href);
console.log('[PureSubs] Document ready state:', document.readyState);

// 🕵️ 情报缓存系统 - 存储间谍拦截的字幕数据
interface SpyData {
  url: string;
  content: string;
  videoId: string;
  language: string;
  format: string;
  timestamp: number;
}

// 全局情报缓存 - 以videoId_language为key
const subtitleCache = new Map<string, SpyData>();

// 🎯 Promise唤醒机制 - 解决竞争状态问题
interface PendingRequest {
  resolve: (data: SpyData) => void;
  reject: (error: Error) => void;
  videoId: string;
  language: string;
  timestamp: number;
}

// 存储等待中的Promise resolve函数
const pendingRequests = new Map<string, PendingRequest>();

// 创建等待特定字幕数据的Promise
function createWaitingPromise(videoId: string, language: string, timeoutMs: number = 10000): Promise<SpyData> {
  const key = getCacheKey(videoId, language);
  
  return new Promise<SpyData>((resolve, reject) => {
    // 存储resolve和reject函数，等待消息监听器唤醒
    pendingRequests.set(key, {
      resolve,
      reject, 
      videoId,
      language,
      timestamp: Date.now()
    });
    
    // 设置超时
    setTimeout(() => {
      if (pendingRequests.has(key)) {
        pendingRequests.delete(key);
        reject(new Error(`Waiting for subtitle data timeout: ${videoId}_${language}`));
      }
    }, timeoutMs);
  });
}

// 唤醒等待中的Promise（当新数据到达时调用）
function wakeUpWaitingPromise(videoId: string, language: string, data: SpyData): void {
  const key = getCacheKey(videoId, language);
  const pending = pendingRequests.get(key);
  
  if (pending) {
    console.log('[PureSubs] 🎉 Waking up waiting promise for:', key);
    pendingRequests.delete(key);
    pending.resolve(data);
  }
}

// 🌐 暴露给browser-engine使用的全局接口
// 提供给其他脚本的公共接口
(window as unknown as Record<string, unknown>).puresubsContentScript = {
  // 获取缓存数据
  getCachedSubtitleData: (videoId: string, language?: string) => {
    if (language) {
      const key = getCacheKey(videoId, language);
      return subtitleCache.get(key);
    } else {
      // 返回任意语言的缓存数据
      for (const [, data] of subtitleCache.entries()) {
        if (data.videoId === videoId) {
          return data;
        }
      }
      return null;
    }
  },
  
  // 等待间谍数据的Promise接口
  waitForSpyData: (videoId: string, language: string, timeoutMs: number = 10000) => {
    // 先检查缓存
    // 从 window 对象获取缓存数据（类型安全的访问）
    const windowAny = window as unknown as Record<string, unknown>;
    const contentScript = windowAny.puresubsContentScript as { getCachedSubtitleData?: (videoId: string, language?: string) => unknown };
    const cached = contentScript?.getCachedSubtitleData?.(videoId, language);
    if (cached) {
      console.log('[PureSubs] 🎯 Found cached data, returning immediately');
      return Promise.resolve(cached);
    }
    
    // 如果缓存中没有，创建等待Promise
    console.log('[PureSubs] 📡 Creating waiting promise for:', videoId, language);
    return createWaitingPromise(videoId, language, timeoutMs);
  }
};

// 清理过期缓存的函数
function cleanExpiredCache() {
  const now = Date.now();
  const expireTime = 5 * 60 * 1000; // 5分钟过期
  
  for (const [key, data] of subtitleCache.entries()) {
    if (now - data.timestamp > expireTime) {
      subtitleCache.delete(key);
      console.log('[PureSubs] 🗑️ Cleaned expired cache for:', key);
    }
  }
}

// 获取缓存key
function getCacheKey(videoId: string, language: string): string {
  return `${videoId}_${language}`;
}

import { 
  getYouTubeDataFromPage, 
  selectBestSubtitle 
} from '../core/browser-engine';

// 🎯 按钮状态管理 - 实现用户预期管理系统
type ButtonState = 'disabled' | 'ready' | 'loading' | 'success' | 'error';

// State management
let currentVideoId: string | null = null;
let downloadButton: HTMLElement | null = null;
let isInitialized = false;
let buttonState: ButtonState = 'disabled';
let spyScriptReady = false;

// 🎯 按钮状态管理函数
function setButtonState(newState: ButtonState, message?: string): void {
  if (!downloadButton) return;
  
  buttonState = newState;
  
  // 清除所有状态类
  downloadButton.classList.remove('disabled', 'ready', 'loading', 'success', 'error');
  
  // 添加新状态类
  downloadButton.classList.add(newState);
  
  // 根据状态更新按钮内容和行为
  switch (newState) {
    case 'disabled':
      updateButtonContent('waiting', '初始化中...');
      break;
    case 'ready':
      updateButtonContent('ready', 'Download Subtitles');
      break;
    case 'loading':
      updateButtonContent('loading', message || 'Processing...');
      break;
    case 'success':
      updateButtonContent('success', message || 'Success!');
      // 2秒后回到就绪状态
      setTimeout(() => setButtonState('ready'), 2000);
      break;
    case 'error':
      updateButtonContent('error', message || 'Error');
      // 3秒后回到就绪状态
      setTimeout(() => setButtonState('ready'), 3000);
      break;
  }
}

// 🎯 更新按钮显示内容
function updateButtonContent(type: string, text: string): void {
  if (!downloadButton) return;
  
  const icons = {
    waiting: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="pulse">
      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" />
    </svg>`,
    ready: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="status-icon ready">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>`,
    loading: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="spinner">
      <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
    </svg>`,
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z" />
    </svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,7A1.5,1.5 0 0,0 10.5,8.5V13A1.5,1.5 0 0,0 12,14.5A1.5,1.5 0 0,0 13.5,13V8.5A1.5,1.5 0 0,0 12,7M12,17.5A1.5,1.5 0 0,0 10.5,19A1.5,1.5 0 0,0 12,20.5A1.5,1.5 0 0,0 13.5,19A1.5,1.5 0 0,0 12,17.5Z" />
    </svg>`
  };
  
  downloadButton.innerHTML = `
    ${icons[type as keyof typeof icons] || icons.ready}
    <span>${text}</span>
  `;
}

// 监听来自间谍脚本的字幕数据和就绪状态
window.addEventListener('message', (event) => {
  // 🔍 广撒网式日志 - 捕获所有传入的消息
  console.log('[PureSubs Content] Received a postMessage event, data:', event.data);
  
  // 只处理来自同一窗口的消息
  if (event.source !== window) {
    console.log('[PureSubs Content] ❌ Message source is not window, ignoring');
    return;
  }
  
  // 🎯 处理间谍脚本就绪通知
  if (event.data?.type === 'PURESUBS_SPY_READY') {
    console.log('[PureSubs Content] ✅ SUCCESS! Correct READY signal received. Enabling button...');
    console.log('[PureSubs Content] 🔍 Current button state before change:', buttonState);
    console.log('[PureSubs Content] 🔍 Button element exists:', !!downloadButton);
    
    spyScriptReady = true;
    
    // 如果按钮已创建但还在禁用状态，现在启用它
    if (downloadButton && buttonState === 'disabled') {
      console.log('[PureSubs Content] 🎯 Conditions met, changing button state to ready');
      setButtonState('ready');
      showInfo('PureSubs 已就绪，可以下载字幕了！');
      console.log('[PureSubs Content] ✅ Button state changed and notification sent');
    } else {
      console.log('[PureSubs Content] ⚠️ Button conditions not met:', {
        buttonExists: !!downloadButton,
        currentState: buttonState,
        expectedState: 'disabled'
      });
    }
    return;
  }
  
  if (event.data?.type === 'PURESUBS_SUBTITLE_INTERCEPTED') {
    const spyData: SpyData = event.data.data;
    console.log('[PureSubs] 🎉 Received subtitle data from spy:', `${spyData.videoId} (${spyData.language})`);
    console.log('[PureSubs] 📊 Data length:', spyData.content.length);
    
    // 🗃️ 存入情报缓存
    const cacheKey = getCacheKey(spyData.videoId, spyData.language);
    subtitleCache.set(cacheKey, spyData);
    
    console.log('[PureSubs] 💾 Cached subtitle data for:', cacheKey);
    console.log('[PureSubs] 📋 Current cache size:', subtitleCache.size);
    
    // 🎯 【关键修复】唤醒等待中的Promise
    wakeUpWaitingPromise(spyData.videoId, spyData.language, spyData);
    
    // 定期清理过期缓存
    cleanExpiredCache();
    
    // 触发自定义事件通知其他组件
    const customEvent = new CustomEvent('puresubs-subtitle-available', {
      detail: spyData
    });
    document.dispatchEvent(customEvent);
  }
  
  if (event.data?.type === 'PURESUBS_SPY_STATUS') {
    console.log('[PureSubs] 📊 Spy status:', event.data.data);
  }
});

// 🎯 重要：在设置好消息监听器之后，再注入间谍脚本
console.log('[PureSubs] 🎯 Message listener set up, now injecting spy script...');
injectSpyScript();

/**
 * 🔑 使用官方API注入间谍脚本到主页面上下文 (Manifest V3)
 */
async function injectSpyScript(): Promise<void> {
  try {
    console.log('[PureSubs] 🕵️ Injecting spy script using chrome.scripting API...');
    
    // 向后台脚本发送注入请求
    const response = await chrome.runtime.sendMessage({
      type: 'INJECT_SPY_SCRIPT',
      url: window.location.href
    });
    
    if (response && response.success) {
      console.log('[PureSubs] ✅ Spy script injected successfully via API!');
    } else {
      throw new Error(response?.error || 'Unknown injection error');
    }
    
  } catch (error) {
    console.error('[PureSubs] ❌ Failed to inject spy script via API:', error);
    
    // 回退到传统方法（虽然可能被CSP阻止）
    console.log('[PureSubs] 🔄 Falling back to traditional injection method...');
    await injectSpyScriptTraditional();
  }
}

/**
 * 传统的脚本注入方法（回退方案）
 */
async function injectSpyScriptTraditional(): Promise<void> {
  try {
    const scriptURL = chrome.runtime.getURL('core/injected-spy.js');
    
    const script = document.createElement('script');
    script.src = scriptURL;
    script.onload = () => {
      console.log('[PureSubs] ✅ Traditional spy script loaded');
      script.remove();
    };
    script.onerror = (error) => {
      console.error('[PureSubs] ❌ Traditional injection failed:', error);
      script.remove();
    };
    
    (document.head || document.documentElement).appendChild(script);
    
  } catch (error) {
    console.error('[PureSubs] ❌ Traditional injection error:', error);
  }
}

/**
 * 🗃️ 从缓存获取拦截的字幕数据
 */
function getInterceptedSubtitleData(videoId: string, language?: string): SpyData | null {
  // 清理过期缓存
  cleanExpiredCache();
  
  if (language) {
    // 查找特定语言的字幕
    const cacheKey = getCacheKey(videoId, language);
    const data = subtitleCache.get(cacheKey);
    if (data) {
      console.log('[PureSubs] 🎯 Found cached subtitle for:', cacheKey);
      return data;
    }
  }
  
  // 如果没有指定语言，或者没找到特定语言，返回该视频的任意语言字幕
  for (const [key, data] of subtitleCache.entries()) {
    if (data.videoId === videoId) {
      console.log('[PureSubs] 📝 Found cached subtitle (any language):', key);
      return data;
    }
  }
  
  console.log('[PureSubs] ❌ No cached subtitle found for video:', videoId);
  return null;
}

// Configuration
interface UserPreferences {
  preferredLanguage: string;
  preferredFormat: 'srt' | 'txt';
  includeDescription: boolean;
  autoDownload: boolean;
}

/**
 * Initialize the content script
 */
function init(): void {
  if (isInitialized) {
    console.log('[PureSubs] Content script already initialized, skipping');
    return;
  }
  
  console.log('[PureSubs] Initializing content script...');
  console.log('[PureSubs] Looking for #movie_player element...');
  
  // Wait for YouTube to load
  waitForElement('#movie_player').then((element) => {
    console.log('[PureSubs] Found #movie_player element:', element);
    console.log('[PureSubs] Setting up video watcher and applying prophet mode decision gate...');
    setupVideoWatcher();
    prophetModeDecisionGate(); // 🔮 使用统一的决策门逻辑
    isInitialized = true;
    console.log('[PureSubs] Initialization completed successfully');
  }).catch((error) => {
    console.error('[PureSubs] Failed to initialize - #movie_player not found:', error);
    console.log('[PureSubs] Retrying initialization in 3 seconds...');
    setTimeout(() => {
      isInitialized = false;
      init();
    }, 3000);
  });
}

/**
 * Wait for an element to appear in the DOM
 */
function waitForElement(selector: string, timeout = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Setup watcher for video changes (YouTube SPA navigation)
 */
function setupVideoWatcher(): void {
  let lastUrl = location.href;
  
  const observer = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      handleVideoChange();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Initial setup
  handleVideoChange();
}

/**
 * Handle video page changes with Prophet Mode as Decision Gate
 */
function handleVideoChange(): void {
  const videoId = extractVideoIdFromUrl(location.href);
  
  if (videoId && videoId !== currentVideoId) {
    currentVideoId = videoId;
    console.log('[PureSubs] Video changed:', videoId);
    
    // Clear cache to prevent state pollution
    subtitleCache.clear();
    console.log('[PureSubs] Cache cleared for new video');
    
    // Remove existing button
    if (downloadButton) {
      downloadButton.remove();
      downloadButton = null;
    }
    
    // =========================================================
    // 🔮 PROPHET MODE: Decision Gate - Check before any UI injection
    // =========================================================
    setTimeout(() => prophetModeDecisionGate(), 1000);
  }
}

/**
 * Prophet Mode Decision Gate - The Gatekeeper of User Experience
 * Only creates UI if subtitles are 100% confirmed to be available
 */
function prophetModeDecisionGate(): void {
  console.log('[PureSubs] 🔮 Prophet Mode: Starting decision gate...');
  
  try {
    // Step 1: Silent background check for subtitle availability
    const playerResponse = extractPlayerResponseFromPage();
    const availableSubtitles = extractSubtitleTracks(playerResponse);
    
    console.log('[PureSubs] 🔮 Prophet Mode: Subtitle availability check completed');
    console.log('[PureSubs] 🔮 Available subtitles:', availableSubtitles);
    
    // Step 2: Decision Gate - The Critical UX Moment
    if (!availableSubtitles || availableSubtitles.length === 0) {
      console.info('[PureSubs] 🔮 Prophet Mode: No subtitles detected. Maintaining clean UI - no button injection.');
      console.info('[PureSubs] 🔮 Prophet Mode: User will see a clean page without false promises.');
      // CRITICAL: Exit here. No UI injection. Clean, honest user experience.
      return;
    }
    
    // Step 3: Proceed with UI injection only for videos with confirmed subtitles
    console.log('[PureSubs] 🔮 Prophet Mode: Subtitles confirmed! Proceeding with button injection.');
    injectDownloadButton();
    
  } catch (error) {
    console.error('[PureSubs] 🔮 Prophet Mode: Decision gate failed:', error);
    console.info('[PureSubs] 🔮 Prophet Mode: Choosing conservative approach - no button injection to ensure consistency.');
    // Conservative approach: when in doubt, don't inject to maintain clean UX
    return;
  }
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoIdFromUrl(url: string): string | null {
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

/**
 * Inject the download button into YouTube's UI
 */
async function injectDownloadButton(): Promise<void> {
  try {
    // Wait for the action buttons container
    const actionsContainer = await waitForElement('#actions-inner, .ytd-menu-renderer', 5000);
    
    if (!actionsContainer || downloadButton) {
      return;
    }
    
    // Create download button (initially disabled)
    downloadButton = createDownloadButton();
    
    // Insert button into the actions container
    const firstChild = actionsContainer.firstElementChild;
    if (firstChild) {
      actionsContainer.insertBefore(downloadButton, firstChild);
    } else {
      actionsContainer.appendChild(downloadButton);
    }
    
    console.log('[PureSubs] Download button injected');
    
    // 🎯 检查间谍脚本是否已经就绪
    if (spyScriptReady) {
      console.log('[PureSubs] Spy script was already ready, enabling button');
      setButtonState('ready');
    } else {
      console.log('[PureSubs] Waiting for spy script to be ready...');
      setButtonState('disabled');
      // 可选：显示等待提示
      showInfo('正在初始化字幕拦截系统...');
    }
    
  } catch (error) {
    console.error('[PureSubs] Failed to inject download button:', error);
  }
}

/**
 * Create the download button element with initial disabled state
 */
function createDownloadButton(): HTMLElement {
  const button = document.createElement('button');
  button.className = 'puresubs-download-btn disabled'; // 🚫 初始状态为禁用
  
  // 🎯 使用状态管理系统设置初始状态
  downloadButton = button;
  setButtonState('disabled');
  
  button.addEventListener('click', handleDownloadClick);
  
  return button;
}

/**
 * Handle download button click with improved state management
 */
async function handleDownloadClick(event: Event): Promise<void> {
  event.preventDefault();
  event.stopPropagation();
  
  // 🚫 防范性检查：只有在就绪状态才允许操作
  if (buttonState !== 'ready') {
    console.log('[PureSubs] Button not ready, ignoring click. Current state:', buttonState);
    return;
  }
  
  try {
    // 🔄 设置为加载状态
    setButtonState('loading', '正在获取字幕...');
    
    // Get user preferences
    const preferences = await getUserPreferences();
    
    // Check if auto-download is enabled
    if (preferences.autoDownload) {
      await downloadWithPreferences(preferences);
    } else {
      await showLanguageSelector();
    }
    
    // 🎉 设置为成功状态
    setButtonState('success', '下载完成！');
    
  } catch (error) {
    console.error('[PureSubs] Download failed:', error);
    setButtonState('error', '下载失败，请重试');
    showError('Failed to download subtitles. Please try again.');
  }
}

/**
 * Smart subtitle download with intelligent language selection
 * Priority: Chinese -> English -> Show "No subtitles available"
 */
interface SmartDownloadResult {
  success: boolean;
  content?: string;
  title?: string;
  description?: string;
  actualLanguage?: string;
  isAutoGenerated?: boolean;
  error?: string;
}

async function smartDownloadSubtitles(preferences: UserPreferences): Promise<SmartDownloadResult> {
  try {
    // 🔍 第一步：检查缓存中是否有可用的字幕数据
    console.log('[PureSubs] 🔍 Checking subtitle cache first...');
    
    // 🔄 进度反馈：设置为搜索缓存状态
    if (downloadButton) setButtonState('loading', '正在搜索缓存字幕...');
    
    const videoId = currentVideoId;
    if (!videoId) {
      return { success: false, error: 'NO_VIDEO_ID' };
    }
    
    // 尝试从缓存获取字幕数据
    let cachedData = getInterceptedSubtitleData(videoId, preferences.preferredLanguage);
    if (!cachedData) {
      // 尝试获取任意语言的缓存数据
      cachedData = getInterceptedSubtitleData(videoId);
    }
    
    if (cachedData) {
      console.log('[PureSubs] 🎉 Found cached subtitle data! Using cached version.');
      console.log('[PureSubs] 📋 Language:', cachedData.language, 'Format:', cachedData.format);
      
      // 解析缓存的字幕数据
      const interceptorModule = await import('../core/subtitle-interceptor');
      const engineModule = await import('../core/browser-engine');
      
      const { parseJSON3Subtitles } = interceptorModule;
      const { parseSubtitleXML, convertToSRT, convertToTXT } = engineModule;
      
      let entries: Array<{ start: number; end: number; text: string; dur?: number }> = [];
      
      if (cachedData.format === 'json3' || cachedData.content.includes('"events"')) {
        entries = parseJSON3Subtitles(cachedData.content);
      } else if (cachedData.content.includes('<transcript>') || cachedData.content.includes('<text')) {
        entries = parseSubtitleXML(cachedData.content);
      } else {
        // 尝试作为JSON解析
        try {
          const jsonData = JSON.parse(cachedData.content);
          if (jsonData.events) {
            entries = parseJSON3Subtitles(cachedData.content);
          }
        } catch {
          console.warn('[PureSubs] ⚠️ Unknown subtitle format, treating as plain text');
          entries = [{
            start: 0,
            end: 10,
            text: cachedData.content
          }];
        }
      }
      
      if (entries.length > 0) {
        let content = '';
        if (preferences.preferredFormat === 'srt') {
          content = convertToSRT(entries);
        } else {
          content = convertToTXT(entries);
        }
        
        return {
          success: true,
          content: content,
          title: `YouTube Video ${videoId}`,
          actualLanguage: cachedData.language,
          isAutoGenerated: false
        };
      }
    }
    
    // 🔄 第二步：如果缓存中没有数据，使用原有逻辑获取
    console.log('[PureSubs] 📡 No cached data found, fetching from YouTube...');
    
    // Step 1: Get all available subtitles (without extracting content yet)
    const videoData = await getYouTubeDataFromPage({
      extractSubtitles: false,
      includeAutoGenerated: true
    });

    if (!videoData.availableSubtitles || videoData.availableSubtitles.length === 0) {
      return { success: false, error: 'NO_SUBTITLES' };
    }

    // Step 2: Smart language selection
    const selectedSubtitle = selectBestSubtitle(videoData.availableSubtitles);
    
    if (!selectedSubtitle) {
      return { success: false, error: 'NO_SUBTITLES' };
    }

    // Step 3: Extract subtitle content for selected language
    const subtitleData = await getYouTubeDataFromPage({
      extractSubtitles: true,
      subtitleLanguage: selectedSubtitle.language,
      includeAutoGenerated: true
    });

    if (!subtitleData.subtitles) {
      return { success: false, error: 'EXTRACTION_FAILED' };
    }

    return {
      success: true,
      content: subtitleData.subtitles[preferences.preferredFormat],
      title: videoData.title,
      description: videoData.description,
      actualLanguage: selectedSubtitle.language,
      isAutoGenerated: selectedSubtitle.isAutoGenerated
    };

  } catch (error) {
    console.error('[PureSubs] Smart download failed:', error);
    return { success: false, error: String(error) };
  }
}


/**
 * Download subtitles with user preferences
 */
async function downloadWithPreferences(preferences: UserPreferences): Promise<void> {
  if (!currentVideoId) {
    throw new Error('No video ID available');
  }
  
  // 智能语言选择逻辑：中文 -> 英文 -> 提示无字幕
  const result = await smartDownloadSubtitles(preferences);
  
  if (!result.success) {
    if (result.error === 'NO_SUBTITLES') {
      showError('This video has no available subtitles (neither manual nor auto-generated).');
      return;
    }
    throw new Error(result.error);
  }
  
  // Prepare download content
  let content = result.content || '';
  
  if (preferences.includeDescription && result.description) {
    content = `${result.description}\n\n--- SUBTITLES ---\n\n${content}`;
  }
  
  // Generate filename with language info
  const filename = generateFilename(result.title || 'video', preferences.preferredFormat, result.actualLanguage);
  
  // Trigger download
  await triggerDownload(content, filename);
  
  // Show success message with language info
  const languageInfo = result.actualLanguage !== 'en' && result.actualLanguage !== 'zh-Hans' ? ` (${result.actualLanguage})` : '';
  const autoGenInfo = result.isAutoGenerated ? ' (Auto-generated)' : '';
  showSuccess(`Subtitles downloaded successfully${languageInfo}${autoGenInfo}!`);
}

/**
 * Show language selector modal
 */
async function showLanguageSelector(): Promise<void> {
  // This will be implemented in the next milestone
  // For now, use default preferences
  const preferences = await getUserPreferences();
  await downloadWithPreferences(preferences);
}

/**
 * Get user preferences from storage
 */
async function getUserPreferences(): Promise<UserPreferences> {
  return new Promise((resolve, _reject) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        console.error('[PureSubs] Chrome storage API not available');
        resolve({
          preferredLanguage: 'zh-Hans',
          preferredFormat: 'srt',
          includeDescription: false,
          autoDownload: true
        });
        return;
      }

      chrome.storage.sync.get({
        preferredLanguage: 'zh-Hans', // 默认偏好中文
        preferredFormat: 'srt',
        includeDescription: false,
        autoDownload: true // 启用智能自动下载
      }, (result) => {
        if (chrome.runtime.lastError) {
          console.error('[PureSubs] Storage error:', chrome.runtime.lastError);
          resolve({
            preferredLanguage: 'zh-Hans',
            preferredFormat: 'srt',
            includeDescription: false,
            autoDownload: true
          });
        } else {
          console.log('[PureSubs] Retrieved preferences:', result);
          resolve(result as UserPreferences);
        }
      });
    } catch (error) {
      console.error('[PureSubs] Error in getUserPreferences:', error);
      resolve({
        preferredLanguage: 'zh-Hans',
        preferredFormat: 'srt',
        includeDescription: false,
        autoDownload: true
      });
    }
  });
}

/**
 * Generate filename for download
 */
function generateFilename(title: string, format: string, language?: string): string {
  // Sanitize title for filename
  const sanitized = title
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
  
  // Add language suffix if available and not English
  const langSuffix = (language && language !== 'en') ? `_${language}` : '';
  
  return `${sanitized}_subtitles${langSuffix}.${format}`;
}

/**
 * Trigger file download
 */
/**
 * 🔧 黄金标准：发送下载消息给后台脚本
 */
async function sendDownloadMessage(filename: string, content: string): Promise<void> {
  console.log('[PureSubs] 📤 Sending download message to background script');
  console.log('[PureSubs] 📁 Filename:', filename);
  console.log('[PureSubs] � Content length:', content.length);
  
  try {
    // Step 1: Create the Blob in the content script (where DOM APIs are available)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });

    // Step 2: Convert the Blob to a data: URL using FileReader
    const reader = new FileReader();
    reader.readAsDataURL(blob);

    // Step 3: Wait for FileReader to complete (Promise wrapper)
    const dataUrl = await new Promise<string>((resolve) => {
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
    });

    console.log('[PureSubs] 📦 Created data URL for download:', dataUrl.substring(0, 50) + '...');

    // Step 4: Send the DATA URL to the background script (not raw content)
    const response = await chrome.runtime.sendMessage({
      action: "downloadSubtitleFile",
      filename: filename,
      url: dataUrl // Send the URL, not the content
    });

    if (response && response.success) {
      console.log('[PureSubs] ✅ Download initiated successfully by background script.', response);
    } else {
      // 捕获后台脚本发回的错误
      console.error('[PureSubs] ❌ Background script reported a download error:', response?.error);
      throw new Error(response?.error || 'Unknown download error');
    }
  } catch (error) {
    // 捕获"端口关闭"错误或其他通信错误
    console.error('[PureSubs] ❌ Download communication failed:', error);
    throw error;
  }
}

/**
 * Trigger file download - 简化版本，使用新的通信模式
 */
async function triggerDownload(content: string, filename: string): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      throw new Error('Chrome extension APIs not available');
    }

    // 🔧 使用黄金标准通信模式
    await sendDownloadMessage(filename, content);
    
    console.log('[PureSubs] ✅ Download process completed successfully');
    
  } catch (error) {
    console.error('[PureSubs] ❌ Error in triggerDownload:', error);
    throw error;
  }
}

/**
 * Show success message with green notification
 */
function showSuccess(message: string): void {
  showNotification(message, 'success');
}

/**
 * Show error message with red notification
 */
function showError(message: string): void {
  showNotification(message, 'error');
}

/**
 * Show info message with blue notification
 */
function showInfo(message: string): void {
  showNotification(message, 'info');
}

/**
 * Show notification to user with enhanced visual feedback
 */
function showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
  const notification = document.createElement('div');
  notification.className = `puresubs-notification puresubs-notification--${type}`;
  
  // 选择合适的图标
  const icons = {
    success: `<svg class="puresubs-notification-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z" />
    </svg>`,
    error: `<svg class="puresubs-notification-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,7A1.5,1.5 0 0,0 10.5,8.5V13A1.5,1.5 0 0,0 12,14.5A1.5,1.5 0 0,0 13.5,13V8.5A1.5,1.5 0 0,0 12,7M12,17.5A1.5,1.5 0 0,0 10.5,19A1.5,1.5 0 0,0 12,20.5A1.5,1.5 0 0,0 13.5,19A1.5,1.5 0 0,0 12,17.5Z" />
    </svg>`,
    info: `<svg class="puresubs-notification-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,7A1.5,1.5 0 0,0 10.5,8.5A1.5,1.5 0 0,0 12,10A1.5,1.5 0 0,0 13.5,8.5A1.5,1.5 0 0,0 12,7M10.5,12A1.5,1.5 0 0,0 12,13.5A1.5,1.5 0 0,0 13.5,12A1.5,1.5 0 0,0 12,10.5A1.5,1.5 0 0,0 10.5,12Z" />
    </svg>`,
    warning: `<svg class="puresubs-notification-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16" />
    </svg>`
  };
  
  notification.innerHTML = `
    ${icons[type]}
    <span>${message}</span>
  `;
  
  document.body.appendChild(notification);
  
  // 优雅的退出动画
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Initialize when DOM is ready
console.log('[PureSubs] Setting up initialization trigger...');
if (document.readyState === 'loading') {
  console.log('[PureSubs] Document still loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[PureSubs] DOMContentLoaded event fired, calling init()');
    init();
  });
} else {
  console.log('[PureSubs] Document already loaded, calling init() immediately');
  init();
}
