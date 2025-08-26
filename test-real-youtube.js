/**
 * 从实际YouTube页面获取字幕数据的测试脚本
 */

async function testRealYouTubePageParsing() {
  console.log('=== 测试从YouTube页面获取字幕数据 ===');
  
  try {
    // 获取YouTube页面HTML
    const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
    console.log('获取页面:', testUrl);
    
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log('页面HTML长度:', html.length);
    
    // 查找ytInitialPlayerResponse
    const patterns = [
      /var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s,
      /ytInitialPlayerResponse\s*=\s*(\{.+?\});/s,
      /"ytInitialPlayerResponse":\s*(\{.+?\})/s,
      /window\["ytInitialPlayerResponse"\]\s*=\s*(\{.+?\});/s
    ];
    
    let playerResponse = null;
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          playerResponse = JSON.parse(match[1]);
          console.log('✅ 成功解析ytInitialPlayerResponse');
          break;
        } catch (e) {
          console.log('解析JSON失败，尝试下一个模式...');
          continue;
        }
      }
    }
    
    if (!playerResponse) {
      console.log('❌ 未找到ytInitialPlayerResponse');
      
      // 输出部分HTML用于调试
      console.log('\n页面内容示例:');
      console.log(html.substring(0, 2000));
      return false;
    }
    
    // 提取视频信息
    console.log('\n=== 视频信息 ===');
    const videoDetails = playerResponse.videoDetails;
    if (videoDetails) {
      console.log('标题:', videoDetails.title);
      console.log('描述长度:', videoDetails.shortDescription?.length || 0);
      console.log('视频ID:', videoDetails.videoId);
      console.log('时长:', videoDetails.lengthSeconds);
    }
    
    // 提取字幕信息
    console.log('\n=== 字幕信息 ===');
    const captions = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captions || captions.length === 0) {
      console.log('❌ 没有找到字幕轨道');
      console.log('完整captions对象:', JSON.stringify(playerResponse.captions, null, 2));
      return false;
    }
    
    console.log(`✅ 找到 ${captions.length} 个字幕轨道:`);
    captions.forEach((caption, index) => {
      console.log(`${index + 1}. 语言: ${caption.languageCode} (${caption.name?.simpleText || caption.name?.runs?.[0]?.text})`);
      console.log(`   URL: ${caption.baseUrl}`);
      console.log(`   类型: ${caption.kind === 'asr' ? '自动生成' : '手动'}`);
    });
    
    // 测试获取第一个字幕
    if (captions.length > 0) {
      console.log('\n=== 测试获取字幕内容 ===');
      const firstCaption = captions[0];
      console.log('尝试获取字幕:', firstCaption.baseUrl);
      
      try {
        const captionResponse = await fetch(firstCaption.baseUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': testUrl
          }
        });
        
        if (captionResponse.ok) {
          const captionContent = await captionResponse.text();
          console.log('✅ 字幕获取成功!');
          console.log('字幕内容长度:', captionContent.length);
          console.log('字幕内容预览:');
          console.log(captionContent.substring(0, 1000));
          return true;
        } else {
          console.log('❌ 字幕获取失败:', captionResponse.status, captionResponse.statusText);
          return false;
        }
      } catch (error) {
        console.log('❌ 字幕获取异常:', error.message);
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 运行测试
testRealYouTubePageParsing().then(success => {
  console.log('\n=== 总结 ===');
  if (success) {
    console.log('✅ YouTube字幕获取流程正常');
    console.log('\n💡 建议:');
    console.log('- 确保在Chrome扩展中使用相同的方法');
    console.log('- 添加Referer头以提高成功率');
    console.log('- 处理不同的字幕格式(srv1, srv3等)');
  } else {
    console.log('❌ YouTube字幕获取存在问题');
    console.log('\n🔧 调试建议:');
    console.log('- 检查YouTube页面结构是否变化');
    console.log('- 验证ytInitialPlayerResponse的解析');
    console.log('- 确认字幕API的访问方式');
    console.log('- 考虑使用不同的User-Agent');
  }
}).catch(console.error);
