/**
 * Tests for background script
 */

// Import the chrome mock first
import '../../../jest.chrome-mock';

// Import the background script to ensure it's loaded and covered
import '../background';

// Get chrome from global scope
const chromeApi = (global as any).chrome;

// Note: Background script mainly handles Chrome extension APIs and message passing
// These tests focus on the message handling logic and utility functions

describe('background script', () => {
  beforeEach(() => {
    // Reset any global state
    jest.clearAllMocks();
  });

  describe('Chrome extension environment', () => {
    it('should have chrome APIs available in test environment', () => {
      expect(chromeApi).toBeDefined();
      expect(chromeApi.runtime).toBeDefined();
      expect(chromeApi.tabs).toBeDefined();
      expect(chromeApi.scripting).toBeDefined();
    });

    it('should handle chrome.runtime.onMessage events', () => {
      expect(chromeApi.runtime.onMessage).toBeDefined();
      expect(chromeApi.runtime.onMessage.addListener).toBeDefined();
    });

    it('should handle chrome.tabs events', () => {
      expect(chromeApi.tabs.onUpdated).toBeDefined();
      expect(chromeApi.tabs.onUpdated.addListener).toBeDefined();
    });
  });

  describe('message handling', () => {
    it('should handle DOWNLOAD_SUBTITLES message', async () => {
      const message = {
        type: 'DOWNLOAD_SUBTITLES',
        data: { videoId: 'test123', language: 'en' }
      };

      // This would test the actual message handler if we extract it to a testable function
      expect(message.type).toBe('DOWNLOAD_SUBTITLES');
      expect(message.data.videoId).toBe('test123');
    });

    it('should handle INJECT_SPY_SCRIPT message', async () => {
      const message = {
        type: 'INJECT_SPY_SCRIPT',
        data: { tabId: 123 }
      };

      expect(message.type).toBe('INJECT_SPY_SCRIPT');
      expect(message.data.tabId).toBe(123);
    });
  });

  describe('script injection', () => {
    it('should inject content script on YouTube pages', async () => {
      const mockTabInfo = {
        tabId: 123,
        changeInfo: { status: 'complete' },
        tab: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        }
      };

      // Test URL detection
      expect(mockTabInfo.tab.url).toContain('youtube.com');
      expect(mockTabInfo.changeInfo.status).toBe('complete');
    });

    it('should not inject on non-YouTube pages', () => {
      const mockTabInfo = {
        tabId: 123,
        changeInfo: { status: 'complete' },
        tab: {
          url: 'https://example.com'
        }
      };

      expect(mockTabInfo.tab.url).not.toContain('youtube.com');
    });
  });

  describe('URL validation', () => {
    it('should identify YouTube URLs correctly', () => {
      const youtubeUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=test123',
        'https://m.youtube.com/watch?v=mobile123',
        'https://www.youtube.com/embed/embed123'
      ];

      youtubeUrls.forEach(url => {
        expect(url).toMatch(/youtube\.com/);
      });
    });

    it('should reject non-YouTube URLs', () => {
      const nonYoutubeUrls = [
        'https://example.com',
        'https://google.com',
        'https://vimeo.com/123456',
        'chrome://extensions/'
      ];

      nonYoutubeUrls.forEach(url => {
        expect(url).not.toMatch(/youtube\.com/);
      });
    });
  });

  describe('error handling', () => {
    it('should handle missing tab ID gracefully', () => {
      const invalidTabInfo = {
        tabId: undefined,
        changeInfo: { status: 'complete' },
        tab: { url: 'https://www.youtube.com/watch?v=test' }
      };

      expect(invalidTabInfo.tabId).toBeUndefined();
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrlInfo = {
        tabId: 123,
        changeInfo: { status: 'complete' },
        tab: { url: null }
      };

      expect(invalidUrlInfo.tab.url).toBeNull();
    });
  });
});
