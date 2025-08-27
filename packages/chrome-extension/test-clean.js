// Test HTML entity decoding
function testCleanSubtitleText(text) {
  if (!text) return '';

  let result = text;
  console.log('Step 0 - Input:', result);
  
  // Decode common HTML entities (order matters - do this first)
  result = result.replace(/&amp;/g, '&');
  console.log('Step 1 - After &amp;:', result);
  
  result = result.replace(/&lt;/g, '<');
  console.log('Step 2 - After &lt;:', result);
  
  result = result.replace(/&gt;/g, '>');
  console.log('Step 3 - After &gt;:', result);
  
  result = result.replace(/&quot;/g, '"');
  console.log('Step 4 - After &quot;:', result);
  
  result = result.replace(/&#39;/g, "'");
  console.log('Step 5 - After &#39;:', result);
  
  result = result.replace(/&#x27;/g, "'");
  console.log('Step 6 - After &#x27;:', result);
  
  result = result.replace(/&#x2F;/g, '/');
  console.log('Step 7 - After &#x2F;:', result);
  
  // Decode numeric entities
  result = result.replace(/&#(\d+);/g, (match, num) => String.fromCharCode(parseInt(num, 10)));
  console.log('Step 8 - After numeric entities:', result);
  
  result = result.replace(/&#x([a-fA-F0-9]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  console.log('Step 9 - After hex entities:', result);
  
  // Remove HTML tags
  result = result.replace(/<[^>]*>/g, '');
  console.log('Step 10 - After HTML tag removal:', result);
  
  // Clean up extra whitespace
  result = result.replace(/\s+/g, ' ');
  console.log('Step 11 - After whitespace cleanup:', result);
  
  result = result.trim();
  console.log('Step 12 - Final result:', result);

  return result;
}

const input = '&amp;&lt;&gt;&quot;&#39;';
const result = testCleanSubtitleText(input);
const expected = '&<>"\'';

console.log('Input:', input);
console.log('Result:', result);
console.log('Expected:', expected);
console.log('Result length:', result.length);
console.log('Expected length:', expected.length);
console.log('Equal:', result === expected);

// Check each character
for (let i = 0; i < Math.max(result.length, expected.length); i++) {
  const rChar = result[i] || 'undefined';
  const eChar = expected[i] || 'undefined';
  console.log(`Position ${i}: result="${rChar}" (${rChar.charCodeAt(0)}) vs expected="${eChar}" (${eChar.charCodeAt(0)})`);
}
