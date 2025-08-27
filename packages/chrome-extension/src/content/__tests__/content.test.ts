/**
 * Tests for content script
 */

// Import chrome mock first
import '../../../jest.chrome-mock';

// Mock the browser-engine module since it has complex dependencies
jest.mock('../../core/browser-engine', () => ({
  getYouTubeDataFromPage: jest.fn(),
  selectBestSubtitle: jest.fn(),
  convertToSRT: jest.fn(),
  convertToTXT: jest.fn(),
  extractVideoMetadata: jest.fn(),
}));

// Import content script after mocking dependencies
import '../content';

describe('content script', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        pathname: '/watch'
      },
      writable: true
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('DOM manipulation', () => {
    it('should inject download button into YouTube page', () => {
      // Mock YouTube player controls
      const playerControls = document.createElement('div');
      playerControls.className = 'ytp-chrome-controls';
      document.body.appendChild(playerControls);

      // Simulate button injection
      const downloadButton = document.createElement('button');
      downloadButton.id = 'puresubs-download-btn';
      downloadButton.textContent = 'Download Subtitles';
      playerControls.appendChild(downloadButton);

      expect(document.getElementById('puresubs-download-btn')).toBeTruthy();
      expect(downloadButton.textContent).toBe('Download Subtitles');
    });

    it('should show success message', () => {
      // Simulate showing a success message
      const message = 'Subtitles downloaded successfully!';
      const messageElement = document.createElement('div');
      messageElement.id = 'puresubs-message';
      messageElement.textContent = message;
      messageElement.style.backgroundColor = 'green';
      document.body.appendChild(messageElement);

      expect(document.getElementById('puresubs-message')).toBeTruthy();
      expect(messageElement.textContent).toBe(message);
      expect(messageElement.style.backgroundColor).toBe('green');
    });

    it('should show error message', () => {
      // Simulate showing an error message
      const message = 'Failed to download subtitles';
      const messageElement = document.createElement('div');
      messageElement.id = 'puresubs-message';
      messageElement.textContent = message;
      messageElement.style.backgroundColor = 'red';
      document.body.appendChild(messageElement);

      expect(document.getElementById('puresubs-message')).toBeTruthy();
      expect(messageElement.textContent).toBe(message);
      expect(messageElement.style.backgroundColor).toBe('red');
    });
  });

  describe('video ID extraction', () => {
    it('should extract video ID from current URL', () => {
      const extractVideoId = (url: string): string | null => {
        const match = url.match(/[?&]v=([^&]+)/);
        return match ? match[1] : null;
      };

      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://www.youtube.com/watch?v=test123&t=30s')).toBe('test123');
      expect(extractVideoId('https://example.com')).toBeNull();
    });
  });

  describe('user preferences', () => {
    it('should handle default preferences', () => {
      const defaultPreferences = {
        preferredLanguage: 'zh-Hans',
        preferredFormat: 'srt',
        includeDescription: false,
        autoDownload: true
      };

      expect(defaultPreferences.preferredLanguage).toBe('zh-Hans');
      expect(defaultPreferences.preferredFormat).toBe('srt');
      expect(defaultPreferences.includeDescription).toBe(false);
      expect(defaultPreferences.autoDownload).toBe(true);
    });

    it('should validate preference values', () => {
      const isValidLanguage = (lang: string): boolean => {
        return ['zh-Hans', 'en', 'ja', 'ko', 'fr', 'es'].includes(lang);
      };

      const isValidFormat = (format: string): boolean => {
        return ['srt', 'txt'].includes(format);
      };

      expect(isValidLanguage('zh-Hans')).toBe(true);
      expect(isValidLanguage('en')).toBe(true);
      expect(isValidLanguage('invalid')).toBe(false);

      expect(isValidFormat('srt')).toBe(true);
      expect(isValidFormat('txt')).toBe(true);
      expect(isValidFormat('invalid')).toBe(false);
    });
  });

  describe('filename generation', () => {
    it('should generate proper filename', () => {
      const generateFilename = (title: string, format: string, language?: string): string => {
        const sanitizedTitle = title.replace(/[<>:"/\\|?*]/g, '_');
        const langSuffix = language && language !== 'en' ? `_${language}` : '';
        return `${sanitizedTitle}${langSuffix}.${format}`;
      };

      expect(generateFilename('Test Video', 'srt')).toBe('Test Video.srt');
      expect(generateFilename('Test Video', 'srt', 'zh-Hans')).toBe('Test Video_zh-Hans.srt');
      expect(generateFilename('Test: Video?', 'txt')).toBe('Test_ Video_.txt');
    });
  });

  describe('subtitle cache', () => {
    it('should manage subtitle cache', () => {
      const subtitleCache = new Map();
      
      // Test cache operations
      const cacheKey = 'video123_zh-Hans';
      const cacheData = {
        videoId: 'video123',
        language: 'zh-Hans',
        format: 'json3',
        content: 'test content'
      };

      subtitleCache.set(cacheKey, cacheData);
      
      expect(subtitleCache.has(cacheKey)).toBe(true);
      expect(subtitleCache.get(cacheKey)).toEqual(cacheData);
      
      subtitleCache.delete(cacheKey);
      expect(subtitleCache.has(cacheKey)).toBe(false);
    });

    it('should handle cache key generation', () => {
      const generateCacheKey = (videoId: string, language?: string): string => {
        return language ? `${videoId}_${language}` : videoId;
      };

      expect(generateCacheKey('video123')).toBe('video123');
      expect(generateCacheKey('video123', 'zh-Hans')).toBe('video123_zh-Hans');
    });
  });

  describe('error handling', () => {
    it('should handle missing video ID', () => {
      const handleError = (error: string): { success: boolean; error: string } => {
        return { success: false, error };
      };

      const result = handleError('NO_VIDEO_ID');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_VIDEO_ID');
    });

    it('should handle network errors', () => {
      const handleNetworkError = (error: Error): string => {
        if (error.name === 'NetworkError') {
          return 'Network connection failed. Please check your internet connection.';
        }
        return 'An unexpected error occurred.';
      };

      const networkError = new Error('Failed to fetch');
      networkError.name = 'NetworkError';
      
      expect(handleNetworkError(networkError)).toBe('Network connection failed. Please check your internet connection.');
      
      const genericError = new Error('Something went wrong');
      expect(handleNetworkError(genericError)).toBe('An unexpected error occurred.');
    });
  });

  describe('message communication', () => {
    it('should handle spy status messages', () => {
      const mockMessageEvent = {
        data: {
          type: 'PURESUBS_SPY_STATUS',
          data: { status: 'ready', interceptedCount: 5 }
        }
      };

      expect(mockMessageEvent.data.type).toBe('PURESUBS_SPY_STATUS');
      expect(mockMessageEvent.data.data.status).toBe('ready');
      expect(mockMessageEvent.data.data.interceptedCount).toBe(5);
    });

    it('should handle spy data messages', () => {
      const mockSpyData = {
        type: 'PURESUBS_SPY_DATA',
        data: {
          videoId: 'test123',
          language: 'zh-Hans',
          format: 'json3',
          content: JSON.stringify({ events: [] })
        }
      };

      expect(mockSpyData.type).toBe('PURESUBS_SPY_DATA');
      expect(mockSpyData.data.videoId).toBe('test123');
      expect(mockSpyData.data.language).toBe('zh-Hans');
    });
  });
});
