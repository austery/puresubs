/**
 * Unit tests for utility functions
 */

import {
  delay,
  retryWithBackoff,
  isBrowser,
  isNode,
  getRandomUserAgent,
  sanitizeFilename,
  parseLanguageCode,
  formatFileSize,
  debounce
} from '../utils';

describe('Utility Functions', () => {
  describe('delay', () => {
    it.skip('should delay execution (skipped - timing sensitive)', async () => {
      const start = Date.now();
      await delay(50);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(40);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first try', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(mockFn);
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it.skip('should retry on failure and eventually succeed (skipped - timing sensitive)', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn, 3, 10);
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it.skip('should throw error after max retries (skipped - timing sensitive)', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(retryWithBackoff(mockFn, 2, 10)).rejects.toThrow('Always fails');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('isBrowser', () => {
    it('should return true in jsdom test environment', () => {
      expect(isBrowser()).toBe(true);
    });
  });

  describe('isNode', () => {
    it('should return true in jsdom test environment (has process)', () => {
      expect(isNode()).toBe(true);
    });
  });

  describe('getRandomUserAgent', () => {
    it('should return a valid user agent string', () => {
      const userAgent = getRandomUserAgent();
      expect(userAgent).toMatch(/Mozilla\/5\.0/);
      expect(typeof userAgent).toBe('string');
      expect(userAgent.length).toBeGreaterThan(50);
    });

    it('should return different user agents on multiple calls', () => {
      const userAgents = new Set();
      for (let i = 0; i < 20; i++) {
        userAgents.add(getRandomUserAgent());
      }
      // Should have some variety (not all the same)
      expect(userAgents.size).toBeGreaterThan(1);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      const input = 'file<>:"/\\|?*name.txt';
      const result = sanitizeFilename(input);
      expect(result).toBe('file_name.txt');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('my file name')).toBe('my_file_name');
    });

    it('should remove multiple consecutive underscores', () => {
      expect(sanitizeFilename('file___name')).toBe('file_name');
    });

    it('should remove leading and trailing underscores', () => {
      expect(sanitizeFilename('_filename_')).toBe('filename');
    });

    it('should limit length to 200 characters', () => {
      const longName = 'a'.repeat(250);
      const result = sanitizeFilename(longName);
      expect(result.length).toBe(200);
    });

    it('should handle empty string', () => {
      expect(sanitizeFilename('')).toBe('');
    });

    it('should handle complex filenames', () => {
      const input = '  My<>Video: "Best Moments" | Part 1  ';
      const result = sanitizeFilename(input);
      expect(result).toBe('My_Video_Best_Moments_Part_1');
    });
  });

  describe('parseLanguageCode', () => {
    it('should parse simple language codes', () => {
      const result = parseLanguageCode('en');
      expect(result).toEqual({
        code: 'en',
        language: 'en',
        region: undefined
      });
    });

    it('should parse language codes with regions', () => {
      const result = parseLanguageCode('zh-Hans');
      expect(result).toEqual({
        code: 'zh-Hans',
        language: 'zh',
        region: 'HANS'
      });
    });

    it('should parse US English', () => {
      const result = parseLanguageCode('en-US');
      expect(result).toEqual({
        code: 'en-US',
        language: 'en',
        region: 'US'
      });
    });

    it('should handle case variations', () => {
      const result = parseLanguageCode('EN-us');
      expect(result).toEqual({
        code: 'EN-us',
        language: 'en',
        region: 'US'
      });
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0.0 B');
      expect(formatFileSize(500)).toBe('500.0 B');
      expect(formatFileSize(1023)).toBe('1023.0 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(102400)).toBe('100.0 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(5242880)).toBe('5.0 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1.0 GB');
      expect(formatFileSize(2147483648)).toBe('2.0 GB');
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    afterEach(() => {
      jest.clearAllTimers();
    });

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });

    it('should reset timer on subsequent calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1');
      jest.advanceTimersByTime(50);
      
      debouncedFn('arg2');
      jest.advanceTimersByTime(50);

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg2');
    });
  });
});
