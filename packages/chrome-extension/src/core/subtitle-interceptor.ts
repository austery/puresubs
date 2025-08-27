/**
 * 2025年最新YouTube字幕API逆向工程
 * 基于对真实浏览器请求的网络监听分析
 */

import { SubtitleEntry } from './browser-engine';

/**
 * 从YouTube播放器的网络请求中拦截字幕数据
 * 这是目前最有效的方法，因为我们复用了YouTube自己的请求
 */
export class YouTubeSubtitleInterceptor {
  private interceptedRequests: Map<string, any> = new Map();
  private isListening: boolean = false;

  /**
   * 开始监听YouTube的网络请求
   */
  public startListening(): void {
    if (this.isListening) return;
    
    console.log('[PureSubs] Starting subtitle request interception');
    this.isListening = true;

    // 监听fetch请求
    this.interceptFetch();
    
    // 监听XMLHttpRequest
    this.interceptXHR();
  }

  /**
   * 拦截fetch请求
   */
  private interceptFetch(): void {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const response = await originalFetch.apply(window, args);
      
      try {
        const url = args[0] as string;
        
        // 检查是否是字幕请求
        if (this.isSubtitleRequest(url)) {
          console.log('[PureSubs] Intercepted subtitle fetch request:', url);
          
          // 克隆响应以避免消费原始流
          const clonedResponse = response.clone();
          const subtitleData = await clonedResponse.text();
          
          // 存储拦截到的数据
          this.storeSubtitleData(url, subtitleData);
        }
      } catch (error) {
        console.error('[PureSubs] Error intercepting fetch:', error);
      }
      
      return response;
    };
  }

  /**
   * 拦截XMLHttpRequest
   */
  private interceptXHR(): void {
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const interceptor = this; // 保存引用
    
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async: boolean = true, username?: string | null, password?: string | null) {
      (this as any)._puresubs_url = url.toString();
      return originalXHROpen.call(this, method, url, async, username, password);
    };
    
    XMLHttpRequest.prototype.send = function(data?: any) {
      const url = (this as any)._puresubs_url;
      
      if (url && interceptor.isSubtitleRequest(url)) {
        console.log('[PureSubs] Intercepted subtitle XHR request:', url);
        
        this.addEventListener('load', () => {
          try {
            if (this.status === 200) {
              const subtitleData = this.responseText;
              interceptor.storeSubtitleData(url, subtitleData);
            }
          } catch (error) {
            console.error('[PureSubs] Error processing XHR response:', error);
          }
        });
      }
      
      return originalXHRSend.call(this, data);
    };
  }

  /**
   * 检查URL是否是字幕请求
   */
  private isSubtitleRequest(url: string): boolean {
    return url.includes('/api/timedtext') || 
           url.includes('/youtubei/v1/player/') ||
           (url.includes('youtube.com') && url.includes('fmt=json3'));
  }

  /**
   * 存储拦截到的字幕数据
   */
  private storeSubtitleData(url: string, data: string): void {
    try {
      const videoId = this.extractVideoIdFromUrl(url);
      const language = this.extractLanguageFromUrl(url);
      
      if (videoId && language) {
        const key = `${videoId}_${language}`;
        
        console.log(`[PureSubs] Storing subtitle data for ${key}, length: ${data.length}`);
        console.log(`[PureSubs] Data preview:`, data.substring(0, 500));
        
        this.interceptedRequests.set(key, {
          url,
          data,
          timestamp: Date.now(),
          videoId,
          language
        });
        
        // 触发自定义事件通知扩展
        this.notifySubtitleAvailable(videoId, language, data);
      }
    } catch (error) {
      console.error('[PureSubs] Error storing subtitle data:', error);
    }
  }

  /**
   * 从URL中提取视频ID
   */
  private extractVideoIdFromUrl(url: string): string | null {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  /**
   * 从URL中提取语言代码
   */
  private extractLanguageFromUrl(url: string): string | null {
    const match = url.match(/[?&]lang=([^&]+)/);
    return match ? match[1] : null;
  }

  /**
   * 通知扩展有新的字幕数据可用
   */
  private notifySubtitleAvailable(videoId: string, language: string, data: string): void {
    const event = new CustomEvent('puresubs-subtitle-available', {
      detail: { videoId, language, data }
    });
    document.dispatchEvent(event);
    
    console.log(`[PureSubs] Notified extension about subtitle availability: ${videoId} (${language})`);
  }

  /**
   * 获取指定视频的字幕数据
   */
  public getSubtitleData(videoId: string, preferredLanguage?: string): any | null {
    if (preferredLanguage) {
      const key = `${videoId}_${preferredLanguage}`;
      const data = this.interceptedRequests.get(key);
      if (data) return data;
    }
    
    // 如果没有指定语言或指定语言不可用，返回任何可用的语言
    for (const [key, data] of this.interceptedRequests.entries()) {
      if (key.startsWith(videoId + '_')) {
        return data;
      }
    }
    
    return null;
  }

  /**
   * 清理旧的请求数据
   */
  public cleanup(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10分钟
    
    for (const [key, data] of this.interceptedRequests.entries()) {
      if (now - data.timestamp > maxAge) {
        this.interceptedRequests.delete(key);
      }
    }
  }

  /**
   * 停止监听
   */
  public stopListening(): void {
    this.isListening = false;
    console.log('[PureSubs] Stopped subtitle request interception');
    // 注意：这里没有恢复原始的fetch和XMLHttpRequest，因为可能会影响其他功能
  }
}

/**
 * 解析新格式的JSON字幕数据（fmt=json3）
 */
export function parseJSON3Subtitles(jsonData: string): SubtitleEntry[] {
  try {
    console.log('[PureSubs] Parsing JSON3 subtitle format');
    const data = JSON.parse(jsonData);
    const entries: SubtitleEntry[] = [];

    if (data.events && Array.isArray(data.events)) {
      data.events.forEach((event: any) => {
        if (event.segs && Array.isArray(event.segs)) {
          let text = '';
          event.segs.forEach((seg: any) => {
            if (seg.utf8) {
              text += seg.utf8;
            }
          });
          
          if (text.trim()) {
            // 验证时间信息
            const startMs = event.tStartMs;
            const durationMs = event.dDurationMs;
            
            if (startMs != null && durationMs != null && 
                !isNaN(startMs) && !isNaN(durationMs) && 
                startMs >= 0 && durationMs > 0) {
              entries.push({
                start: startMs / 1000, // 转换毫秒到秒
                end: (startMs + durationMs) / 1000,
                text: cleanSubtitleText(text)
              });
            }
          }
        }
      });
    }

    console.log(`[PureSubs] Parsed ${entries.length} subtitle entries from JSON3 format`);
    return entries.sort((a, b) => a.start - b.start);
  } catch (error) {
    console.error('[PureSubs] Error parsing JSON3 subtitles:', error);
    return [];
  }
}

/**
 * 清理字幕文本
 */
function cleanSubtitleText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 全局拦截器实例
export const globalSubtitleInterceptor = new YouTubeSubtitleInterceptor();
