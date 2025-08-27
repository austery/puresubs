/**
 * Tests for subtitle-interceptor module
 */
import { parseJSON3Subtitles, YouTubeSubtitleInterceptor } from '../subtitle-interceptor';

// Mock window and fetch for testing
const mockFetch = jest.fn();
const mockXMLHttpRequest = jest.fn();

(global as any).window = {
  fetch: mockFetch,
  XMLHttpRequest: mockXMLHttpRequest,
  addEventListener: jest.fn(),
  location: {
    href: 'https://www.youtube.com/watch?v=test123'
  }
};

describe('subtitle-interceptor', () => {
  describe('YouTubeSubtitleInterceptor', () => {
    let interceptor: YouTubeSubtitleInterceptor;

    beforeEach(() => {
      jest.clearAllMocks();
      interceptor = new YouTubeSubtitleInterceptor();
      
      // Reset window.fetch to original mock
      (global as any).window.fetch = mockFetch;
    });

    describe('constructor', () => {
      it('should create interceptor instance', () => {
        expect(interceptor).toBeInstanceOf(YouTubeSubtitleInterceptor);
      });
    });

    describe('startListening', () => {
      it('should start listening for requests', () => {
        const originalFetch = (global as any).window.fetch;
        
        interceptor.startListening();
        
        // Should have modified window.fetch
        expect((global as any).window.fetch).not.toBe(originalFetch);
      });

      it('should not start listening twice', () => {
        interceptor.startListening();
        const modifiedFetch = (global as any).window.fetch;
        
        interceptor.startListening();
        
        // Should be the same modified fetch (not wrapped again)
        expect((global as any).window.fetch).toBe(modifiedFetch);
      });
    });

    describe('stopListening', () => {
      it('should stop listening for requests', () => {
        interceptor.startListening();
        interceptor.stopListening();
        
        // Should have set the listening flag to false
        expect(interceptor['isListening']).toBe(false);
      });
    });

    describe('getSubtitleData', () => {
      it('should return subtitle data for specific video and language', () => {
        const data = interceptor.getSubtitleData('test-video-id', 'en');
        
        // Should return null when no data stored
        expect(data).toBeNull();
      });

      it('should return any available data when no preferred language specified', () => {
        const data = interceptor.getSubtitleData('test-video-id');
        
        // Should return null when no data stored
        expect(data).toBeNull();
      });
    });

    describe('cleanup', () => {
      it('should clean up old intercepted data', () => {
        expect(() => interceptor.cleanup()).not.toThrow();
      });
    });
  });

  describe('parseJSON3Subtitles', () => {
    const mockJSON3Data = JSON.stringify({
      events: [
        {
          tStartMs: 0,
          dDurationMs: 3000,
          segs: [{ utf8: 'Hello world' }]
        },
        {
          tStartMs: 3500,
          dDurationMs: 2500,
          segs: [{ utf8: 'This is a test' }]
        },
        {
          tStartMs: 7000,
          dDurationMs: 3000,
          segs: [{ utf8: 'Final subtitle' }]
        }
      ]
    });

    it('should parse JSON3 subtitle format correctly', () => {
      const entries = parseJSON3Subtitles(mockJSON3Data);
      
      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({
        start: 0,
        end: 3,
        text: 'Hello world'
      });
      expect(entries[1]).toEqual({
        start: 3.5,
        end: 6,
        text: 'This is a test'
      });
      expect(entries[2]).toEqual({
        start: 7,
        end: 10,
        text: 'Final subtitle'
      });
    });

    it('should handle entries with multiple segments', () => {
      const dataWithMultipleSegs = JSON.stringify({
        events: [
          {
            tStartMs: 0,
            dDurationMs: 3000,
            segs: [
              { utf8: 'Hello ' },
              { utf8: 'world' }
            ]
          }
        ]
      });

      const entries = parseJSON3Subtitles(dataWithMultipleSegs);
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        start: 0,
        end: 3,
        text: 'Hello world'
      });
    });

    it('should skip entries without segments', () => {
      const dataWithoutSegs = JSON.stringify({
        events: [
          {
            tStartMs: 0,
            dDurationMs: 3000,
            segs: []
          },
          {
            tStartMs: 3000,
            dDurationMs: 2000,
            segs: [{ utf8: 'Valid entry' }]
          }
        ]
      });

      const entries = parseJSON3Subtitles(dataWithoutSegs);
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        start: 3,
        end: 5,
        text: 'Valid entry'
      });
    });

    it('should handle malformed JSON gracefully', () => {
      const entries = parseJSON3Subtitles('invalid json');
      expect(entries).toEqual([]);
    });

    it('should handle missing events property', () => {
      const dataWithoutEvents = JSON.stringify({ someOtherProperty: 'value' });
      const entries = parseJSON3Subtitles(dataWithoutEvents);
      expect(entries).toEqual([]);
    });

    it('should handle empty events array', () => {
      const emptyEvents = JSON.stringify({ events: [] });
      const entries = parseJSON3Subtitles(emptyEvents);
      expect(entries).toEqual([]);
    });

    it('should handle entries with missing timing information', () => {
      const dataWithMissingTiming = JSON.stringify({
        events: [
          { tStartMs: null, dDurationMs: null, segs: [{ utf8: 'Text without timing' }] },
          { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: 'Valid entry' }] }
        ]
      });
      
      const entries = parseJSON3Subtitles(dataWithMissingTiming);
      
      // Should filter out entries with invalid timing
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        start: 1,
        end: 3,
        text: 'Valid entry'
      });
    });
  });
});
