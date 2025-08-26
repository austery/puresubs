/**
 * 简单的字幕下载测试脚本
 * 用于诊断YouTube字幕下载问题
 */

// 模拟一个简单的YouTube数据结构
const mockPlayerResponse = {
  videoDetails: {
    title: "Test Video",
    shortDescription: "Test Description"
  },
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=en&fmt=srv3",
          name: { simpleText: "English" },
          languageCode: "en",
          kind: "captions"
        },
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=zh-Hans&fmt=srv3", 
          name: { simpleText: "中文（简体）" },
          languageCode: "zh-Hans",
          kind: "asr"
        }
      ]
    }
  }
};

// 测试核心引擎的字幕提取功能
async function testSubtitleExtraction() {
  console.log('=== 测试字幕提取功能 ===');
  
  try {
    // 导入核心引擎模块
    const { extractSubtitleTracks } = await import('./packages/core-engine/src/extractor.js');
    
    // 测试字幕轨道提取
    const tracks = extractSubtitleTracks(mockPlayerResponse);
    console.log('✅ 字幕轨道提取成功:');
    console.log(JSON.stringify(tracks, null, 2));
    
    if (tracks.length === 0) {
      console.log('❌ 警告: 没有找到字幕轨道');
      return false;
    }
    
    // 测试XML获取（模拟）
    console.log('\n=== 测试字幕XML获取 ===');
    const mockXML = `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
  <text start="0" dur="2.5">Hello world</text>
  <text start="2.5" dur="3.0">This is a test</text>
  <text start="5.5" dur="2.0">Subtitle content</text>
</transcript>`;
    
    // 测试XML解析
    const { parseSubtitleXML } = await import('./packages/core-engine/src/parser.js');
    const entries = parseSubtitleXML(mockXML);
    console.log('✅ XML解析成功:');
    console.log(JSON.stringify(entries, null, 2));
    
    // 测试格式转换
    const { convertToSRT, convertToTXT } = await import('./packages/core-engine/src/parser.js');
    const srtContent = convertToSRT(entries);
    const txtContent = convertToTXT(entries);
    
    console.log('\n=== SRT格式 ===');
    console.log(srtContent);
    
    console.log('\n=== TXT格式 ===');
    console.log(txtContent);
    
    return true;
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 测试网络请求问题
async function testNetworkRequest() {
  console.log('\n=== 测试网络请求 ===');
  
  try {
    // 测试对YouTube字幕API的请求
    const testUrl = "https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=en&fmt=srv3";
    console.log('尝试获取字幕:', testUrl);
    
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    console.log('响应状态:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const content = await response.text();
      console.log('✅ 网络请求成功');
      console.log('内容长度:', content.length);
      console.log('内容预览:', content.substring(0, 500));
      return true;
    } else {
      console.log('❌ 网络请求失败:', response.status, response.statusText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ 网络请求异常:', error);
    return false;
  }
}

// 主测试函数
async function main() {
  console.log('开始诊断YouTube字幕下载问题...\n');
  
  const extractionTest = await testSubtitleExtraction();
  const networkTest = await testNetworkRequest();
  
  console.log('\n=== 测试总结 ===');
  console.log('字幕提取功能:', extractionTest ? '✅ 正常' : '❌ 异常');
  console.log('网络请求功能:', networkTest ? '✅ 正常' : '❌ 异常');
  
  if (!extractionTest) {
    console.log('\n🔍 字幕提取问题可能原因:');
    console.log('- 代码逻辑错误');
    console.log('- 数据结构不匹配');
    console.log('- 模块导入问题');
  }
  
  if (!networkTest) {
    console.log('\n🔍 网络请求问题可能原因:');
    console.log('- YouTube API访问被限制');
    console.log('- 请求头不正确');
    console.log('- 网络连接问题');
    console.log('- CORS政策限制');
  }
  
  console.log('\n💡 解决建议:');
  if (!networkTest) {
    console.log('- 检查是否需要更准确的User-Agent');
    console.log('- 考虑使用代理服务器');
    console.log('- 验证YouTube API的访问策略');
    console.log('- 在Chrome扩展环境中测试（避免CORS限制）');
  }
}

// 运行测试
main().catch(console.error);
