/**
 * Utility Functions
 * 
 * This module contains utility functions used across the core engine.
 */

/**
 * Delay execution for specified milliseconds
 * 
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Promise with the function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff with jitter
      const delayMs = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await delay(delayMs);
    }
  }
  
  throw lastError!;
}

/**
 * Check if code is running in browser environment
 * 
 * @returns Boolean indicating if running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if code is running in Node.js environment
 * 
 * @returns Boolean indicating if running in Node.js
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions && process.versions.node;
}

/**
 * Generate a random user agent string
 * 
 * @returns Random user agent string
 */
export function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Create a fetch function that works in both browser and Node.js
 * 
 * @returns Fetch function
 */
export async function createFetch(): Promise<typeof fetch> {
  if (isBrowser()) {
    return window.fetch;
  }
  
  // For Node.js, dynamically import node-fetch
  const { default: fetch } = await import('node-fetch');
  return fetch as any;
}

/**
 * Sanitize filename by removing invalid characters
 * 
 * @param filename - Original filename
 * @returns Sanitized filename safe for file systems
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid characters
    .replace(/\s+/g, '_')           // Replace spaces with underscores
    .replace(/_+/g, '_')            // Replace multiple underscores with single
    .replace(/^_|_$/g, '')          // Remove leading/trailing underscores
    .substring(0, 200);             // Limit length
}

/**
 * Parse language code and return standardized format
 * 
 * @param langCode - Language code (e.g., 'en', 'zh-Hans', 'en-US')
 * @returns Standardized language object
 */
export function parseLanguageCode(langCode: string): {
  code: string;
  language: string;
  region?: string;
} {
  const parts = langCode.split('-');
  const language = parts[0].toLowerCase();
  const region = parts[1]?.toUpperCase();
  
  return {
    code: langCode,
    language,
    region
  };
}

/**
 * Format file size in human readable format
 * 
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Create a debounced version of a function
 * 
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
