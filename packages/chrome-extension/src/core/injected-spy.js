/**
 * 🕵️ PureSubs 间谍脚本 - 页面内部拦截器
 * 
 * 这个脚本将被注入到YouTube页面的主环境中，
 * 突破Chrome扩展的沙箱限制，直接拦截页面的网络请求
 */

(function() {
  'use strict';
  
  console.log('[PureSubs Spy] 🕵️ Agent activated in main page context');
  
  // 保存原始的fetch函数
  const originalFetch = window.fetch;
  
  // 标记是否已经拦截到字幕数据
  let subtitleDataIntercepted = false;
  
  // 🎯 发送就绪通知给内容脚本
  function notifyReady() {
    console.log('[PureSubs Spy] �️ Spy is alive and has patched fetch. Sending READY signal now!');
    window.postMessage({
      type: 'PURESUBS_SPY_READY',
      timestamp: Date.now()
    }, '*');
    console.log('[PureSubs Spy] ✅ READY signal has been sent.');
    
    // 额外的调试信息
    console.log('[PureSubs Spy] 🔍 window.postMessage function:', typeof window.postMessage);
    console.log('[PureSubs Spy] 🔍 Signal data:', { type: 'PURESUBS_SPY_READY', timestamp: Date.now() });
  }
  
  // 初始化完成后立即发送就绪通知
  console.log('[PureSubs Spy] ⏰ Setting up ready notification timer...');
  setTimeout(() => {
    console.log('[PureSubs Spy] ⏰ Timer fired, calling notifyReady()');
    notifyReady();
  }, 100);
  
  /**
   * 覆盖原生fetch函数 - 这是关键的"窃听"技术
   */
  window.fetch = async function(...args) {
    const [input] = args;
    const url = typeof input === 'string' ? input : input.url;
    
    // 调用原始fetch获取响应
    const response = await originalFetch.apply(this, args);
    
    try {
      // 检查是否是字幕请求
      if (isSubtitleRequest(url)) {
        console.log('[PureSubs Spy] 🎯 Intercepted subtitle request:', url);
        
        // 克隆响应避免消费原始流
        const clonedResponse = response.clone();
        const subtitleData = await clonedResponse.text();
        
        if (subtitleData && subtitleData.length > 0) {
          console.log(`[PureSubs Spy] 📦 Got subtitle data, length: ${subtitleData.length}`);
          console.log(`[PureSubs Spy] 📄 Data preview:`, subtitleData.substring(0, 200));
          
          // 解析数据以获取更多信息
          const metadata = extractMetadataFromUrl(url);
          
          // 通过postMessage发送数据到内容脚本
          const message = {
            type: 'PURESUBS_SUBTITLE_INTERCEPTED',
            data: {
              url: url,
              content: subtitleData,
              videoId: metadata.videoId,
              language: metadata.language,
              format: metadata.format,
              timestamp: Date.now()
            }
          };
          
          window.postMessage(message, '*');
          console.log('[PureSubs Spy] 📨 Sent subtitle data to content script');
          
          subtitleDataIntercepted = true;
        } else {
          console.log('[PureSubs Spy] ⚠️ Subtitle request returned empty data');
        }
      }
    } catch (error) {
      console.error('[PureSubs Spy] ❌ Error processing response:', error);
    }
    
    return response;
  };
  
  /**
   * 检查URL是否是字幕请求
   */
  function isSubtitleRequest(url) {
    if (!url || typeof url !== 'string') return false;
    
    const patterns = [
      '/api/timedtext',
      '/youtubei/v1/player/',
      'fmt=json3',
      'fmt=srv3',
      'fmt=srv1'
    ];
    
    return patterns.some(pattern => url.includes(pattern));
  }
  
  /**
   * 从URL中提取元数据
   */
  function extractMetadataFromUrl(url) {
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
  
  /**
   * 主动监听XMLHttpRequest（备用方案）
   */
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._puresubs_url = url;
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  XMLHttpRequest.prototype.send = function(data) {
    if (this._puresubs_url && isSubtitleRequest(this._puresubs_url)) {
      console.log('[PureSubs Spy] 🎯 Intercepted XHR subtitle request:', this._puresubs_url);
      
      this.addEventListener('load', function() {
        if (this.status === 200 && this.responseText) {
          const metadata = extractMetadataFromUrl(this._puresubs_url);
          
          const message = {
            type: 'PURESUBS_SUBTITLE_INTERCEPTED',
            data: {
              url: this._puresubs_url,
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
    
    return originalXHRSend.apply(this, [data]);
  };
  
  // 监听来自内容脚本的指令
  window.addEventListener('message', function(event) {
    if (event.data?.type === 'PURESUBS_REQUEST_STATUS') {
      console.log('[PureSubs Spy] 📊 Status check requested');
      
      const statusMessage = {
        type: 'PURESUBS_SPY_STATUS',
        data: {
          active: true,
          intercepted: subtitleDataIntercepted,
          timestamp: Date.now()
        }
      };
      
      window.postMessage(statusMessage, '*');
    }
  });
  
  // 添加视觉指示器（开发时使用）
  if (window.location.hostname === 'www.youtube.com') {
    const indicator = document.createElement('div');
    indicator.id = 'puresubs-spy-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ff0000;
      color: white;
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 12px;
      z-index: 10000;
      font-family: Arial, sans-serif;
    `;
    indicator.textContent = '🕵️ PureSubs Spy Active';
    
    // 3秒后移除指示器
    setTimeout(() => {
      if (document.body && document.body.contains(indicator)) {
        document.body.removeChild(indicator);
      }
    }, 3000);
    
    // 确保页面加载后添加指示器
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
  
  console.log('[PureSubs Spy] 🚀 Agent fully initialized and monitoring network requests');
  
  // 🎯 在脚本的最后，再次发送就绪信号（以防第一次信号在监听器设置前发送）
  console.log('[PureSubs Spy] 🔄 Sending final ready notification...');
  setTimeout(() => {
    console.log('[PureSubs Spy] 🔄 Final ready signal firing now!');
    notifyReady();
  }, 500);
  
})();
