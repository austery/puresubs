/**
 * Content Script for PureSubs Chrome Extension
 * 
 * This script injects the subtitle download button into YouTube video pages
 * and handles the user interaction for downloading subtitles.
 */

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

// 🕵️ 第一步：立即注入间谍脚本到页面环境
injectSpyScript();

import { 
  getYouTubeDataFromPage, 
  ExtractOptions, 
  YouTubeVideoData,
  selectBestSubtitle 
} from '../core/browser-engine';

// State management
let currentVideoId: string | null = null;
let downloadButton: HTMLElement | null = null;
let isInitialized = false;

// 监听来自间谍脚本的字幕数据
window.addEventListener('message', (event) => {
  // 只处理来自同一窗口的消息
  if (event.source !== window) return;
  
  if (event.data?.type === 'PURESUBS_SUBTITLE_INTERCEPTED') {
    const spyData: SpyData = event.data.data;
    console.log('[PureSubs] 🎉 Received subtitle data from spy:', `${spyData.videoId} (${spyData.language})`);
    console.log('[PureSubs] 📊 Data length:', spyData.content.length);
    
    // 🗃️ 存入情报缓存
    const cacheKey = getCacheKey(spyData.videoId, spyData.language);
    subtitleCache.set(cacheKey, spyData);
    
    console.log('[PureSubs] 💾 Cached subtitle data for:', cacheKey);
    console.log('[PureSubs] 📋 Current cache size:', subtitleCache.size);
    
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
    console.log('[PureSubs] Setting up video watcher and injecting button...');
    setupVideoWatcher();
    injectDownloadButton();
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
 * Handle video page changes
 */
function handleVideoChange(): void {
  const videoId = extractVideoIdFromUrl(location.href);
  
  if (videoId && videoId !== currentVideoId) {
    currentVideoId = videoId;
    console.log('[PureSubs] Video changed:', videoId);
    
    // Remove existing button
    if (downloadButton) {
      downloadButton.remove();
      downloadButton = null;
    }
    
    // Inject new button
    setTimeout(() => injectDownloadButton(), 1000);
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
    
    // Create download button
    downloadButton = createDownloadButton();
    
    // Insert button into the actions container
    const firstChild = actionsContainer.firstElementChild;
    if (firstChild) {
      actionsContainer.insertBefore(downloadButton, firstChild);
    } else {
      actionsContainer.appendChild(downloadButton);
    }
    
    console.log('[PureSubs] Download button injected');
    
  } catch (error) {
    console.error('[PureSubs] Failed to inject download button:', error);
  }
}

/**
 * Create the download button element
 */
function createDownloadButton(): HTMLElement {
  const button = document.createElement('button');
  button.className = 'puresubs-download-btn';
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
    <span>Download Subtitles</span>
  `;
  
  button.addEventListener('click', handleDownloadClick);
  
  return button;
}

/**
 * Handle download button click
 */
async function handleDownloadClick(event: Event): Promise<void> {
  event.preventDefault();
  event.stopPropagation();
  
  const button = event.currentTarget as HTMLElement;
  
  try {
    // Show loading state
    button.classList.add('loading');
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="spinning">
        <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
      </svg>
      <span>Loading...</span>
    `;
    
    // Get user preferences
    const preferences = await getUserPreferences();
    
    // Check if auto-download is enabled
    if (preferences.autoDownload) {
      await downloadWithPreferences(preferences);
    } else {
      await showLanguageSelector();
    }
    
  } catch (error) {
    console.error('[PureSubs] Download failed:', error);
    showError('Failed to download subtitles. Please try again.');
  } finally {
    // Reset button state
    button.classList.remove('loading');
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
      </svg>
      <span>Download Subtitles</span>
    `;
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
      
      let entries: any[] = [];
      
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
  
  const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
  
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
  return new Promise((resolve, reject) => {
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
 * Show success message
 */
function showSuccess(message: string): void {
  showNotification(message, 'success');
}

/**
 * Show error message
 */
function showError(message: string): void {
  showNotification(message, 'error');
}

/**
 * Show notification to user
 */
function showNotification(message: string, type: 'success' | 'error'): void {
  const notification = document.createElement('div');
  notification.className = `puresubs-notification puresubs-notification--${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.remove();
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
