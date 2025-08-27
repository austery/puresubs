/**
 * Alternative subtitle extraction methods for YouTube
 * Since direct API access may be limited, we implement fallback strategies
 */

import { 
  SubtitleEntry, 
  fetchSubtitleXML, 
  parseSubtitleXML, 
  convertToSRT, 
  convertToTXT 
} from './browser-engine';

/**
 * Try to extract subtitle content from page DOM elements
 * This is a fallback when API requests return empty content
 */
export function extractSubtitlesFromPageDOM(): SubtitleEntry[] {
  console.log('[PureSubs] Attempting to extract subtitles from page DOM');
  
  const entries: SubtitleEntry[] = [];
  
  try {
    // Try to find subtitle elements in the page
    // YouTube sometimes embeds subtitle data in the page itself
    
    // Method 1: Look for subtitle track data in page scripts
    const scripts = document.querySelectorAll('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const content = script.innerHTML;
      
      // Look for subtitle data patterns
      if (content.includes('captionTracks') || content.includes('timedtext')) {
        console.log('[PureSubs] Found potential subtitle data in script tag');
        
        // Try to extract embedded subtitle data
        const subtitleMatches = content.match(/"text":"([^"]+)"/g);
        if (subtitleMatches && subtitleMatches.length > 0) {
          console.log(`[PureSubs] Found ${subtitleMatches.length} subtitle text matches`);
          
          // Convert matches to subtitle entries
          subtitleMatches.forEach((match: string, index: number) => {
            const text = match.replace(/"text":"/, '').replace(/"$/, '');
            const decodedText = decodeURIComponent(text.replace(/\\u[\dA-F]{4}/gi, (match: string) => {
              return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
            }));
            
            if (decodedText.trim()) {
              entries.push({
                start: index * 3, // Approximate timing
                end: (index + 1) * 3,
                text: cleanSubtitleText(decodedText)
              });
            }
          });
        }
      }
    }
    
    // Method 2: Look for YouTube's built-in subtitle display
    const captionContainer = document.querySelector('.ytp-caption-segment') || 
                           document.querySelector('.captions-text') ||
                           document.querySelector('[data-layer="4"]');
    
    if (captionContainer) {
      console.log('[PureSubs] Found caption container in page');
      const captionText = captionContainer.textContent?.trim();
      if (captionText) {
        entries.push({
          start: 0,
          end: 3,
          text: cleanSubtitleText(captionText)
        });
      }
    }
    
  } catch (error) {
    console.error('[PureSubs] Error extracting subtitles from DOM:', error);
  }
  
  console.log(`[PureSubs] Extracted ${entries.length} subtitle entries from DOM`);
  return entries;
}

/**
 * Generate user-friendly error message when subtitles are not available
 */
export function generateSubtitleUnavailableMessage(videoTitle: string): {
  srt: string;
  txt: string;
  entries: SubtitleEntry[];
} {
  const message = `字幕暂不可用

视频: ${videoTitle}

由于YouTube的API限制，当前无法获取此视频的字幕内容。

可能的原因：
1. 该视频没有字幕
2. 字幕仅对特定地区可用
3. YouTube更改了字幕访问策略

建议：
1. 检查视频是否有手动字幕
2. 尝试刷新页面后重试
3. 联系PureSubs开发团队反馈问题

---
PureSubs Chrome Extension
访问: https://github.com/your-repo/puresubs`;

  const entry: SubtitleEntry = {
    start: 0,
    end: 10,
    text: message
  };

  return {
    srt: convertToSRT([entry]),
    txt: message,
    entries: [entry]
  };
}

/**
 * Enhanced subtitle fetching with multiple fallback strategies
 */
export async function fetchSubtitleWithFallbacks(
  subtitleUrl: string, 
  videoTitle: string = 'Unknown Video'
): Promise<{
  srt: string;
  txt: string;
  entries: SubtitleEntry[];
}> {
  console.log('[PureSubs] Starting enhanced subtitle fetch with fallbacks');
  
  try {
    // Strategy 1: Try original API method
    console.log('[PureSubs] Strategy 1: Original API method');
    const apiContent = await fetchSubtitleXML(subtitleUrl);
    
    if (apiContent && apiContent.length > 0) {
      console.log('[PureSubs] Success with original API method');
      const entries = parseSubtitleXML(apiContent);
      if (entries.length > 0) {
        return {
          srt: convertToSRT(entries),
          txt: convertToTXT(entries),
          entries
        };
      }
    }
    
    // Strategy 2: Try DOM extraction
    console.log('[PureSubs] Strategy 2: DOM extraction method');
    const domEntries = extractSubtitlesFromPageDOM();
    
    if (domEntries.length > 0) {
      console.log('[PureSubs] Success with DOM extraction method');
      return {
        srt: convertToSRT(domEntries),
        txt: convertToTXT(domEntries),
        entries: domEntries
      };
    }
    
    // Strategy 3: Return helpful error message
    console.log('[PureSubs] All strategies failed, returning user-friendly message');
    return generateSubtitleUnavailableMessage(videoTitle);
    
  } catch (error) {
    console.error('[PureSubs] Error in enhanced subtitle fetch:', error);
    return generateSubtitleUnavailableMessage(videoTitle);
  }
}

// Clean subtitle text utility
function cleanSubtitleText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}
