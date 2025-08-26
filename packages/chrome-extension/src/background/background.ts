/**
 * Background Service Worker for PureSubs Chrome Extension
 * 
 * Handles file downloads and background tasks for the extension.
 */

// Extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[PureSubs] Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Set default preferences on first install
    chrome.storage.sync.set({
      preferredLanguage: 'zh-Hans', // 默认偏好中文
      preferredFormat: 'srt',
      includeDescription: false,
      autoDownload: true // 启用智能自动下载
    });
  }
});

// Message handling from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[PureSubs] Background received message:', request.type);
  
  switch (request.type) {
    case 'DOWNLOAD_FILE':
      handleFileDownload(request.payload, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'GET_PREFERENCES':
      handleGetPreferences(sendResponse);
      return true;
      
    case 'SET_PREFERENCES':
      handleSetPreferences(request.payload, sendResponse);
      return true;
      
    case 'FETCH_SUBTITLE_XML':
      handleFetchSubtitleXml(request.payload, sendResponse);
      return true; // Keep message channel open for async response
      
    default:
      console.warn('[PureSubs] Unknown message type:', request.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

/**
 * Handle file download requests from content script
 */
function handleFileDownload(payload: { url: string; filename: string }, sendResponse: (response: any) => void): void {
  const { url, filename } = payload;
  
  if (!url || !filename) {
    sendResponse({ success: false, error: 'Missing URL or filename' });
    return;
  }
  
  // Use Chrome downloads API
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false // Auto-download to default location
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[PureSubs] Download failed:', chrome.runtime.lastError);
      sendResponse({ 
        success: false, 
        error: chrome.runtime.lastError.message 
      });
    } else {
      console.log('[PureSubs] Download started:', downloadId);
      sendResponse({ success: true, downloadId });
    }
  });
}

/**
 * Handle get preferences requests
 */
function handleGetPreferences(sendResponse: (response: any) => void): void {
  chrome.storage.sync.get({
    preferredLanguage: 'zh-Hans', // 默认偏好中文
    preferredFormat: 'srt',
    includeDescription: false,
    autoDownload: true // 启用智能自动下载
  }, (result) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      sendResponse({ success: true, preferences: result });
    }
  });
}

/**
 * Handle set preferences requests
 */
function handleSetPreferences(preferences: any, sendResponse: (response: any) => void): void {
  chrome.storage.sync.set(preferences, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      sendResponse({ success: true });
    }
  });
}

// Monitor download progress (optional - for future features)
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    console.log('[PureSubs] Download completed:', downloadDelta.id);
  }
  
  if (downloadDelta.error) {
    console.error('[PureSubs] Download error:', downloadDelta.error);
  }
});

// Extension icon behavior is handled by content scripts only
// No popup or click handler needed for this version

// Utility function to check if URL is YouTube video
function isYouTubeVideoUrl(url: string): boolean {
  return /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(url);
}

/**
 * Handle subtitle XML fetch requests from content script
 * This uses background script to make requests with proper headers
 */
async function handleFetchSubtitleXml(payload: { url: string }, sendResponse: (response: any) => void): Promise<void> {
  const { url } = payload;
  console.log('[PureSubs BG] Received request to fetch XML from:', url);

  try {
    // 在这里，我们使用带有自定义请求头的 fetch
    // 添加更多的请求头来模拟真实的浏览器请求
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/xml,text/xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        // 添加Referer头，这很重要
        'Referer': 'https://www.youtube.com/',
        // 使用最新的Chrome User-Agent
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      // 添加credentials以确保包含cookies
      credentials: 'include',
      // 设置referrer策略
      referrerPolicy: 'strict-origin-when-cross-origin'
    });

    console.log(`[PureSubs BG] Response status: ${response.status} ${response.statusText}`);
    console.log(`[PureSubs BG] Response content-type:`, response.headers.get('content-type'));
    console.log(`[PureSubs BG] Response content-length:`, response.headers.get('content-length'));

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const xmlContent = await response.text();
    console.log(`[PureSubs BG] Fetched XML content length: ${xmlContent.length}`);
    
    if (xmlContent.length === 0) {
      console.warn('[PureSubs BG] WARNING: YouTube API returned empty content');
      console.warn('[PureSubs BG] This is likely due to YouTube API access restrictions since 2023');
      console.warn('[PureSubs BG] The extension may need to use alternative methods');
    } else {
      console.log(`[PureSubs BG] Content preview:`, xmlContent.substring(0, 500));
    }
    
    sendResponse({ success: true, content: xmlContent });

  } catch (error) {
    console.error('[PureSubs BG] Failed to fetch subtitle XML:', error);
    sendResponse({ success: false, error: (error as Error).message });
  }
}

// Context menus disabled for MVP version
// All functionality is handled through injected buttons
