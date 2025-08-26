/**
 * Unit tests for parser functions
 */

import {
  convertToTXT,
  formatSRTTimestamp,
  cleanSubtitleText,
  mergeSubtitleEntries
} from '../parser';

import { SubtitleEntry } from '../index';

describe('Parser Functions', () => {
  describe('convertToTXT', () => {
    it('should return empty string for empty array', () => {
      expect(convertToTXT([])).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(convertToTXT(null as any)).toBe('');
      expect(convertToTXT(undefined as any)).toBe('');
    });

    it('should join subtitle text with newlines by default', () => {
      const entries: SubtitleEntry[] = [
        { start: 0, end: 2, text: 'Hello world' },
        { start: 2, end: 4, text: 'This is a test' },
        { start: 4, end: 6, text: 'Final line' }
      ];

      const result = convertToTXT(entries);
      expect(result).toBe('Hello world\nThis is a test\nFinal line');
    });

    it('should use custom separator', () => {
      const entries: SubtitleEntry[] = [
        { start: 0, end: 2, text: 'Hello' },
        { start: 2, end: 4, text: 'World' }
      ];

      const result = convertToTXT(entries, ' | ');
      expect(result).toBe('Hello | World');
    });

    it('should trim whitespace from text', () => {
      const entries: SubtitleEntry[] = [
        { start: 0, end: 2, text: '  Hello world  ' },
        { start: 2, end: 4, text: '\tTest\n' }
      ];

      const result = convertToTXT(entries);
      expect(result).toBe('Hello world\nTest');
    });
  });

  describe('formatSRTTimestamp', () => {
    it('should format whole seconds correctly', () => {
      expect(formatSRTTimestamp(0)).toBe('00:00:00,000');
      expect(formatSRTTimestamp(1)).toBe('00:00:01,000');
      expect(formatSRTTimestamp(60)).toBe('00:01:00,000');
      expect(formatSRTTimestamp(3600)).toBe('01:00:00,000');
    });

    it('should format decimal seconds correctly', () => {
      expect(formatSRTTimestamp(1.5)).toBe('00:00:01,500');
      expect(formatSRTTimestamp(2.123)).toBe('00:00:02,123');
      expect(formatSRTTimestamp(62.750)).toBe('00:01:02,750');
    });

    it('should handle large time values', () => {
      expect(formatSRTTimestamp(7265.999)).toBe('02:01:05,999');
    });

    it('should pad numbers correctly', () => {
      expect(formatSRTTimestamp(5.001)).toBe('00:00:05,001');
      expect(formatSRTTimestamp(65.01)).toBe('00:01:05,010');
    });
  });

  describe('cleanSubtitleText', () => {
    it('should return empty string for falsy input', () => {
      expect(cleanSubtitleText('')).toBe('');
      expect(cleanSubtitleText(null as any)).toBe('');
      expect(cleanSubtitleText(undefined as any)).toBe('');
    });

    it('should remove HTML tags', () => {
      expect(cleanSubtitleText('<b>Hello</b> <i>world</i>')).toBe('Hello world');
      expect(cleanSubtitleText('<span class="test">Text</span>')).toBe('Text');
    });

    it('should decode HTML entities', () => {
      expect(cleanSubtitleText('Tom &amp; Jerry')).toBe('Tom & Jerry');
      expect(cleanSubtitleText('&lt;test&gt;')).toBe('<test>');
      expect(cleanSubtitleText('She said &quot;hello&quot;')).toBe('She said "hello"');
      expect(cleanSubtitleText('It&#39;s working')).toBe("It's working");
    });

    it('should clean up whitespace', () => {
      expect(cleanSubtitleText('  Hello    world  ')).toBe('Hello world');
      expect(cleanSubtitleText('Text\n\nwith\tmultiple\tspaces')).toBe('Text with multiple spaces');
    });

    it('should handle complex cases', () => {
      const input = '  <b>Tom &amp; Jerry</b>   said &quot;Hello&quot;  ';
      const expected = 'Tom & Jerry said "Hello"';
      expect(cleanSubtitleText(input)).toBe(expected);
    });
  });

  describe('mergeSubtitleEntries', () => {
    it('should return empty array for empty input', () => {
      expect(mergeSubtitleEntries([])).toEqual([]);
    });

    it('should return single entry unchanged', () => {
      const entries: SubtitleEntry[] = [
        { start: 0, end: 2, text: 'Hello' }
      ];
      expect(mergeSubtitleEntries(entries)).toEqual(entries);
    });

    it('should merge adjacent entries within gap threshold', () => {
      const entries: SubtitleEntry[] = [
        { start: 0, end: 2, text: 'Hello' },
        { start: 2.05, end: 4, text: 'world' }  // 0.05 second gap
      ];

      const result = mergeSubtitleEntries(entries, 0.1);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        start: 0,
        end: 4,
        text: 'Hello world'
      });
    });

    it('should not merge entries with large gaps', () => {
      const entries: SubtitleEntry[] = [
        { start: 0, end: 2, text: 'Hello' },
        { start: 3, end: 5, text: 'world' }  // 1 second gap
      ];

      const result = mergeSubtitleEntries(entries, 0.1);
      expect(result).toHaveLength(2);
      expect(result).toEqual(entries);
    });

    it('should handle overlapping entries', () => {
      const entries: SubtitleEntry[] = [
        { start: 0, end: 3, text: 'Hello' },
        { start: 2, end: 4, text: 'world' }  // Overlapping
      ];

      const result = mergeSubtitleEntries(entries);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        start: 0,
        end: 4,
        text: 'Hello world'
      });
    });

    it('should sort entries by start time', () => {
      const entries: SubtitleEntry[] = [
        { start: 4, end: 5, text: 'Third' },
        { start: 0, end: 1, text: 'First' },
        { start: 2, end: 3, text: 'Second' }
      ];

      const result = mergeSubtitleEntries(entries, 0);
      expect(result[0].text).toBe('First');
      expect(result[1].text).toBe('Second');
      expect(result[2].text).toBe('Third');
    });

    it('should merge multiple consecutive entries', () => {
      const entries: SubtitleEntry[] = [
        { start: 0, end: 1, text: 'A' },
        { start: 1, end: 2, text: 'B' },
        { start: 2, end: 3, text: 'C' }
      ];

      const result = mergeSubtitleEntries(entries, 0);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        start: 0,
        end: 3,
        text: 'A B C'
      });
    });
  });
});
