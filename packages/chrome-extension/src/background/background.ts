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

// Handle extension icon click (when not on YouTube)
chrome.action.onClicked.addListener((tab) => {
  console.log('[PureSubs] Extension icon clicked');
  
  // Check if we're on YouTube
  if (tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be/'))) {
    // Already on YouTube - content script should handle this
    return;
  }
  
  // Not on YouTube - show popup or redirect
  chrome.tabs.create({
    url: 'https://www.youtube.com',
    active: true
  });
});

// Utility function to check if URL is YouTube video
function isYouTubeVideoUrl(url: string): boolean {
  return /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(url);
}

// Context menu integration (optional - for future features)
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for YouTube videos
  chrome.contextMenus.create({
    id: 'puresubs-download',
    title: 'Download subtitles with PureSubs',
    contexts: ['page'],
    documentUrlPatterns: [
      'https://www.youtube.com/watch*',
      'https://youtube.com/watch*'
    ]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'puresubs-download' && tab?.id) {
    // Send message to content script to trigger download
    chrome.tabs.sendMessage(tab.id, {
      type: 'TRIGGER_DOWNLOAD'
    });
  }
});
