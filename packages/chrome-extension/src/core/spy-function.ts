/**
 * 🕵️ 间谍函数 - 在主页面上下文中执行
 * 这个函数将通过 chrome.scripting.executeScript 注入到页面的 MAIN world
 */
export function spyFunction() {
  console.log('[PureSubs Spy] 🕵️ Agent activated in main page context (via executeScript)');
  
  // 保存原始fetch函数
  const originalFetch = window.fetch;
  let dataIntercepted = false;
  
  /**
   * 检测是否为字幕相关URL
   */
  function isSubtitleURL(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    return [
      '/api/timedtext',
      '/youtubei/v1/player/',
      'fmt=json3',
      'fmt=srv3', 
      'fmt=srv1'
    ].some(pattern => url.includes(pattern));
  }
  
  /**
   * 从URL中提取元数据
   */
  function extractMetadata(url: string) {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      return {
        videoId: params.get('v') || 'unknown',
        language: params.get('lang') || params.get('tlang') || 'unknown',
        format: params.get('fmt') || 'unknown'
      };
    } catch (error) {
      console.error('[PureSubs Spy] Error parsing URL:', error);
      return {
        videoId: 'unknown',
        language: 'unknown', 
        format: 'unknown'
      };
    }
  }
  
  // 重写 window.fetch
  (window as any).fetch = async function(input: any, init?: any): Promise<Response> {
    let requestURL: string;
    
    if (typeof input === 'string') {
      requestURL = input;
    } else if (input instanceof URL) {
      requestURL = input.toString();
    } else if (input && typeof input === 'object' && input.url) {
      requestURL = input.url;
    } else {
      requestURL = String(input);
    }
    
    // 执行原始请求
    const response = await originalFetch(input, init);
    
    try {
      // 检查是否为字幕请求
      if (isSubtitleURL(requestURL)) {
        console.log('[PureSubs Spy] 🎯 Intercepted subtitle request:', requestURL);
        
        // 克隆响应以避免消费原始流
        const clonedResponse = response.clone();
        const data = await clonedResponse.text();
        
        if (data && data.length > 0) {
          console.log(`[PureSubs Spy] 📦 Got subtitle data, length: ${data.length}`);
          console.log('[PureSubs Spy] 📄 Data preview:', data.substring(0, 200));
          
          // 提取元数据
          const metadata = extractMetadata(requestURL);
          
          // 通过 postMessage 发送数据到内容脚本
          const message = {
            type: 'PURESUBS_SUBTITLE_INTERCEPTED',
            data: {
              url: requestURL,
              content: data,
              videoId: metadata.videoId,
              language: metadata.language,
              format: metadata.format,
              timestamp: Date.now()
            }
          };
          
          (window as any).postMessage(message, '*');
          console.log('[PureSubs Spy] 📨 Sent subtitle data to content script');
          dataIntercepted = true;
          
        } else {
          console.log('[PureSubs Spy] ⚠️ Subtitle request returned empty data');
        }
      }
    } catch (error) {
      console.error('[PureSubs Spy] ❌ Error processing response:', error);
    }
    
    return response;
  };
  
  // 重写 XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method: string, url: string, async: boolean = true, username?: string | null, password?: string | null) {
    (this as any)._puresubs_url = url;
    return originalOpen.call(this, method, url, async, username, password);
  };
  
  XMLHttpRequest.prototype.send = function(body?: any) {
    const url = (this as any)._puresubs_url;
    
    if (url && isSubtitleURL(url)) {
      console.log('[PureSubs Spy] 🎯 Intercepted XHR subtitle request:', url);
      
      this.addEventListener('load', function() {
        if (this.status === 200 && this.responseText) {
          const metadata = extractMetadata(url);
          
          const message = {
            type: 'PURESUBS_SUBTITLE_INTERCEPTED',
            data: {
              url: url,
              content: this.responseText,
              videoId: metadata.videoId,
              language: metadata.language,
              format: metadata.format,
              timestamp: Date.now()
            }
          };
          
          window.postMessage(message, '*');
          console.log('[PureSubs Spy] 📨 Sent XHR subtitle data to content script');
        }
      });
    }
    
    return originalSend.apply(this, [body]);
  };
  
  // 监听状态查询
  window.addEventListener('message', function(event) {
    if (event.data?.type === 'PURESUBS_REQUEST_STATUS') {
      console.log('[PureSubs Spy] 📊 Status check requested');
      
      const statusMessage = {
        type: 'PURESUBS_SPY_STATUS',
        data: {
          active: true,
          intercepted: dataIntercepted,
          timestamp: Date.now()
        }
      };
      
      window.postMessage(statusMessage, '*');
    }
  });
  
  // 在YouTube页面显示指示器
  if (window.location.hostname === 'www.youtube.com') {
    const indicator = document.createElement('div');
    indicator.id = 'puresubs-spy-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #00ff00;
      color: black;
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 12px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-weight: bold;
    `;
    indicator.textContent = '🕵️ PureSubs Spy (API)';
    
    // 3秒后移除指示器
    setTimeout(() => {
      if (document.body && document.body.contains(indicator)) {
        document.body.removeChild(indicator);
      }
    }, 3000);
    
    if (document.body) {
      document.body.appendChild(indicator);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          document.body.appendChild(indicator);
        }
      });
    }
  }
  
  console.log('[PureSubs Spy] 🚀 Agent fully initialized and monitoring network requests (executeScript method)');
}

/**
 * 字符串版本的间谍函数，用于executeScript注入
 * 因为executeScript不能直接传递TypeScript函数，需要转换为字符串
 */
export const spyFunctionString = `(${spyFunction.toString()})()`;
