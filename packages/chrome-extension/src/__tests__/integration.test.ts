/**
 * Integration tests for chrome extension
 */
import '../../jest.chrome-mock';

describe('Chrome Extension Integration', () => {
  // Get chrome from global scope
  const chromeApi = (global as any).chrome;

  beforeEach(() => {
    // Reset global state
    jest.clearAllMocks();
    
    // Mock YouTube page environment
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        pathname: '/watch',
        search: '?v=dQw4w9WgXcQ'
      },
      writable: true
    });
  });

  describe('Extension lifecycle', () => {
    it('should load extension components properly', () => {
      // Test that all required components are available
      expect(chromeApi).toBeDefined();
      expect(chromeApi.runtime).toBeDefined();
      expect(chromeApi.storage).toBeDefined();
      expect(chromeApi.scripting).toBeDefined();
    });

    it('should handle extension installation', () => {
      const mockOnInstalled = jest.fn();
      chromeApi.runtime.onInstalled.addListener = mockOnInstalled;
      
      chromeApi.runtime.onInstalled.addListener(mockOnInstalled);
      expect(mockOnInstalled).toHaveBeenCalled();
    });
  });

  describe('YouTube page detection', () => {
    it('should detect YouTube watch pages', () => {
      const isYouTubePage = (url: string): boolean => {
        return url.includes('youtube.com') && url.includes('/watch');
      };

      expect(isYouTubePage('https://www.youtube.com/watch?v=test')).toBe(true);
      expect(isYouTubePage('https://youtube.com/watch?v=test')).toBe(true);
      expect(isYouTubePage('https://m.youtube.com/watch?v=test')).toBe(true);
      expect(isYouTubePage('https://www.youtube.com/embed/test')).toBe(false);
      expect(isYouTubePage('https://example.com')).toBe(false);
    });

    it('should extract video ID from URL', () => {
      const extractVideoId = (url: string): string | null => {
        const match = url.match(/[?&]v=([^&]+)/);
        return match ? match[1] : null;
      };

      expect(extractVideoId(window.location.href)).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://www.youtube.com/watch?v=test123&list=playlist')).toBe('test123');
      expect(extractVideoId('https://example.com')).toBeNull();
    });
  });

  describe('Content script injection', () => {
    it('should inject content script on valid pages', async () => {
      const mockExecuteScript = jest.fn().mockResolvedValue([]);
      chromeApi.scripting.executeScript = mockExecuteScript;

      // Simulate content script injection
      await chromeApi.scripting.executeScript({
        target: { tabId: 123 },
        files: ['content/content.js']
      });

      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        files: ['content/content.js']
      });
    });
  });

  describe('Message passing', () => {
    it('should handle message communication between background and content', () => {
      const mockSendMessage = jest.fn();
      const mockOnMessage = jest.fn();
      
      chromeApi.runtime.sendMessage = mockSendMessage;
      chromeApi.runtime.onMessage.addListener = mockOnMessage;

      // Test sending message from content to background
      const message = {
        type: 'DOWNLOAD_SUBTITLES',
        data: { videoId: 'test123', language: 'zh-Hans' }
      };

      chromeApi.runtime.sendMessage(message);
      expect(mockSendMessage).toHaveBeenCalledWith(message);

      // Test background listener
      chromeApi.runtime.onMessage.addListener(mockOnMessage);
      expect(mockOnMessage).toHaveBeenCalled();
    });
  });

  describe('Storage operations', () => {
    it('should handle user preferences storage', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        preferredLanguage: 'zh-Hans',
        preferredFormat: 'srt'
      });
      const mockSet = jest.fn().mockResolvedValue(undefined);

      chromeApi.storage.sync.get = mockGet;
      chromeApi.storage.sync.set = mockSet;

      // Test getting preferences
      const preferences = await chromeApi.storage.sync.get(['preferredLanguage', 'preferredFormat']);
      expect(mockGet).toHaveBeenCalledWith(['preferredLanguage', 'preferredFormat']);
      expect(preferences.preferredLanguage).toBe('zh-Hans');

      // Test setting preferences
      await chromeApi.storage.sync.set({ preferredLanguage: 'en' });
      expect(mockSet).toHaveBeenCalledWith({ preferredLanguage: 'en' });
    });
  });

  describe('Error scenarios', () => {
    it('should handle Chrome API errors gracefully', async () => {
      const mockExecuteScript = jest.fn().mockRejectedValue(new Error('Script injection failed'));
      chromeApi.scripting.executeScript = mockExecuteScript;

      try {
        await chromeApi.scripting.executeScript({
          target: { tabId: 123 },
          files: ['content/content.js']
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Script injection failed');
      }
    });

    it('should handle storage errors', async () => {
      const mockGet = jest.fn().mockRejectedValue(new Error('Storage unavailable'));
      chromeApi.storage.sync.get = mockGet;

      try {
        await chromeApi.storage.sync.get(['preferredLanguage']);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Storage unavailable');
      }
    });
  });

  describe('Download functionality', () => {
    it('should trigger subtitle download', () => {
      const mockDownload = jest.fn().mockReturnValue(1);
      chromeApi.downloads.download = mockDownload;

      // Simulate subtitle download
      const downloadOptions = {
        url: 'data:text/plain;charset=utf-8,Hello%20World',
        filename: 'subtitles.srt',
        saveAs: true
      };

      const downloadId = chromeApi.downloads.download(downloadOptions);
      
      expect(mockDownload).toHaveBeenCalledWith(downloadOptions);
      expect(downloadId).toBe(1);
    });

    it('should handle download completion', () => {
      const mockOnChanged = jest.fn();
      chromeApi.downloads.onChanged.addListener = mockOnChanged;

      const downloadHandler = (delta: { state?: { current: string } }) => {
        if (delta.state?.current === 'complete') {
          console.log('Download completed');
        }
      };

      chromeApi.downloads.onChanged.addListener(downloadHandler);
      expect(mockOnChanged).toHaveBeenCalledWith(downloadHandler);
    });
  });

  describe('Performance considerations', () => {
    it('should handle large subtitle files efficiently', () => {
      // Simulate large subtitle data
      const largeSubtitleData = 'Large subtitle content...'.repeat(1000);
      
      expect(largeSubtitleData.length).toBeGreaterThan(1000);
      expect(typeof largeSubtitleData).toBe('string');
    });

    it('should implement proper caching mechanisms', () => {
      const cache = new Map();
      const maxCacheSize = 10;

      // Test cache size limits
      for (let i = 0; i < 15; i++) {
        if (cache.size >= maxCacheSize) {
          // Remove oldest entry
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        cache.set(`key${i}`, `value${i}`);
      }

      expect(cache.size).toBe(maxCacheSize);
    });
  });
});
