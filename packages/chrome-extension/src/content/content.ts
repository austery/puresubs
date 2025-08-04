/**
 * Content Script for PureSubs Chrome Extension
 * 
 * This script injects the subtitle download button into YouTube video pages
 * and handles the user interaction for downloading subtitles.
 */

import { getYouTubeData, ExtractOptions } from '@puresubs/core-engine';

// State management
let currentVideoId: string | null = null;
let downloadButton: HTMLElement | null = null;
let isInitialized = false;

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
  if (isInitialized) return;
  
  console.log('[PureSubs] Initializing content script');
  
  // Wait for YouTube to load
  waitForElement('#movie_player').then(() => {
    setupVideoWatcher();
    injectDownloadButton();
    isInitialized = true;
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
 * Download subtitles with user preferences
 */
async function downloadWithPreferences(preferences: UserPreferences): Promise<void> {
  if (!currentVideoId) {
    throw new Error('No video ID available');
  }
  
  const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
  
  const options: ExtractOptions = {
    preferredLanguages: [preferences.preferredLanguage],
    extractSubtitles: true,
    subtitleLanguage: preferences.preferredLanguage,
    includeAutoGenerated: true
  };
  
  // Extract video data using core engine
  const videoData = await getYouTubeData(videoUrl, options);
  
  if (!videoData.subtitles) {
    throw new Error('No subtitles available for this video');
  }
  
  // Prepare download content
  let content = videoData.subtitles[preferences.preferredFormat];
  
  if (preferences.includeDescription && videoData.description) {
    content = `${videoData.description}\n\n--- SUBTITLES ---\n\n${content}`;
  }
  
  // Generate filename
  const filename = generateFilename(videoData.title, preferences.preferredFormat);
  
  // Trigger download
  await triggerDownload(content, filename);
  
  showSuccess('Subtitles downloaded successfully!');
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
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      preferredLanguage: 'en',
      preferredFormat: 'srt',
      includeDescription: false,
      autoDownload: false
    }, (result) => {
      resolve(result as UserPreferences);
    });
  });
}

/**
 * Generate filename for download
 */
function generateFilename(title: string, format: string): string {
  // Sanitize title for filename
  const sanitized = title
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
  
  return `${sanitized}_subtitles.${format}`;
}

/**
 * Trigger file download
 */
async function triggerDownload(content: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      payload: { url, filename }
    }, (response) => {
      URL.revokeObjectURL(url);
      
      if (response && response.success) {
        resolve();
      } else {
        reject(new Error(response?.error || 'Download failed'));
      }
    });
  });
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
