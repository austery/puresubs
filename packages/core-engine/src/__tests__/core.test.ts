/**
 * Unit tests for YouTube data extraction functionality
 */

import {
  getYouTubeData,
  extractSubtitleTracks,
  parseSubtitleXML,
  convertToSRT,
  convertToTXT
} from '../index';

import {
  isValidYouTubeURL,
  extractVideoId,
  extractPlayerResponse,
  extractVideoMetadata
} from '../extractor';

describe('Core Engine - Main Functions', () => {
  describe('getYouTubeData', () => {
    it('should throw error for invalid URL', async () => {
      await expect(getYouTubeData('invalid-url')).rejects.toThrow();
    });

    it('should fail to extract data without network request', async () => {
      await expect(getYouTubeData('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
        .rejects.toThrow('Failed to extract YouTube data');
    });
  });

  describe('extractSubtitleTracks', () => {
    it('should return empty array for empty player response', () => {
      const result = extractSubtitleTracks({});
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('parseSubtitleXML', () => {
    it('should return empty array for invalid XML', () => {
      const result = parseSubtitleXML('<xml></xml>');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty XML', () => {
      const result = parseSubtitleXML('');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('convertToSRT', () => {
    it('should return empty string for empty array', () => {
      const result = convertToSRT([]);
      expect(result).toBe('');
    });
  });

  describe('convertToTXT', () => {
    it('should return empty string for empty array', () => {
      const result = convertToTXT([]);
      expect(result).toBe('');
    });
  });
});

describe('Core Engine - Extractor Functions', () => {
  describe('isValidYouTubeURL', () => {
    it('should return true for valid YouTube URLs', () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'http://youtu.be/dQw4w9WgXcQ'
      ];

      validUrls.forEach(url => {
        expect(isValidYouTubeURL(url)).toBe(true);
      });
    });

    it('should return false for invalid URLs', () => {
      const invalidUrls = [
        'https://vimeo.com/123456',
        'https://example.com',
        'not-a-url',
        'https://youtube.com/video123',
        'https://www.youtube.com/playlist?list=PLrAXtmRdnEQy'
      ];

      invalidUrls.forEach(url => {
        expect(isValidYouTubeURL(url)).toBe(false);
      });
    });
  });

  describe('extractVideoId', () => {
    it('should extract video ID from various YouTube URL formats', () => {
      const testCases = [
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
        { url: 'https://youtu.be/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s', expected: 'dQw4w9WgXcQ' }
      ];

      testCases.forEach(({ url, expected }) => {
        expect(extractVideoId(url)).toBe(expected);
      });
    });

    it('should return null for invalid URLs', () => {
      const invalidUrls = [
        'https://example.com',
        'not-a-url',
        'https://youtube.com/playlist'
      ];

      invalidUrls.forEach(url => {
        expect(extractVideoId(url)).toBeNull();
      });
    });
  });

  describe('extractPlayerResponse', () => {
    it('should throw error for empty HTML', () => {
      expect(() => extractPlayerResponse('<html></html>')).toThrow();
    });

    it('should throw error for invalid HTML', () => {
      expect(() => extractPlayerResponse('')).toThrow();
    });
  });

  describe('extractVideoMetadata', () => {
    it('should throw error for empty player response', () => {
      expect(() => extractVideoMetadata({})).toThrow('Failed to extract video metadata');
    });
  });
});

// TODO: Add more comprehensive tests as implementation progresses
// - Test with real YouTube page HTML samples
// - Test subtitle XML parsing with sample data
// - Test SRT and TXT format conversion
// - Test error handling and edge cases
// - Test with different language subtitles
// - Test with auto-generated vs manual subtitles
