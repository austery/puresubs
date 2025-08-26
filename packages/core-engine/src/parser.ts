/**
 * Subtitle Parser and Formatter
 * 
 * This module handles parsing of subtitle XML content and formatting
 * it into different output formats (SRT, TXT).
 */

import { SubtitleEntry } from './index';

/**
 * Parse subtitle XML content into structured data
 * 
 * @param xmlContent - Raw XML subtitle content from YouTube
 * @returns Array of subtitle entries with timing and text
 */
export function parseSubtitleXML(xmlContent: string): SubtitleEntry[] {
  try {
    const entries: SubtitleEntry[] = [];
    
    // Regex to match <text> tags with attributes and content
    const textRegex = /<text start="([^"]+)"(?:\s+dur="([^"]+)")?>([^<]*)<\/text>/g;
    
    let match;
    while ((match = textRegex.exec(xmlContent)) !== null) {
      const start = parseFloat(match[1]);
      const duration = match[2] ? parseFloat(match[2]) : 0;
      const text = cleanSubtitleText(match[3]);
      
      if (text.trim()) {
        entries.push({
          start: start,
          end: start + (duration || 0),
          text: text
        });
      }
    }
    
    // Sort entries by start time
    return entries.sort((a, b) => a.start - b.start);
  } catch (error) {
    throw new Error(`Failed to parse subtitle XML: ${error}`);
  }
}

/**
 * Convert subtitle entries to SRT format
 * 
 * @param entries - Array of subtitle entries
 * @returns SRT formatted string
 */
export function convertToSRT(entries: SubtitleEntry[]): string {
  if (!entries || entries.length === 0) {
    return '';
  }
  
  return entries
    .map((entry, index) => {
      const startTime = formatSRTTimestamp(entry.start);
      const endTime = formatSRTTimestamp(entry.end);
      
      return [
        (index + 1).toString(),
        `${startTime} --> ${endTime}`,
        entry.text,
        ''
      ].join('\n');
    })
    .join('\n');
}

/**
 * Convert subtitle entries to plain text format
 * 
 * @param entries - Array of subtitle entries
 * @param separator - Line separator (default: '\n')
 * @returns Plain text string without timing information
 */
export function convertToTXT(entries: SubtitleEntry[], separator: string = '\n'): string {
  // Implementation will extract just the text content
  if (!entries || entries.length === 0) {
    return '';
  }
  
  return entries.map(entry => entry.text.trim()).join(separator);
}

/**
 * Format time in seconds to SRT timestamp format (HH:MM:SS,mmm)
 * 
 * @param seconds - Time in seconds (can be decimal)
 * @returns Formatted timestamp string
 */
export function formatSRTTimestamp(seconds: number): string {
  // Round to 3 decimal places to avoid floating point precision issues
  const roundedSeconds = Math.round(seconds * 1000) / 1000;
  
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const secs = Math.floor(roundedSeconds % 60);
  const milliseconds = Math.round((roundedSeconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Clean subtitle text by removing HTML tags and fixing encoding
 * 
 * @param text - Raw subtitle text
 * @returns Cleaned text
 */
export function cleanSubtitleText(text: string): string {
  if (!text) return '';
  
  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Merge overlapping or adjacent subtitle entries
 * 
 * @param entries - Array of subtitle entries
 * @param maxGap - Maximum gap in seconds to merge (default: 0.1)
 * @returns Merged subtitle entries
 */
export function mergeSubtitleEntries(entries: SubtitleEntry[], maxGap: number = 0.1): SubtitleEntry[] {
  if (!entries || entries.length <= 1) {
    return entries;
  }
  
  // Sort entries by start time
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  const merged: SubtitleEntry[] = [];
  
  let current = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    
    // Check if current entry should be merged with next
    if (next.start - current.end <= maxGap) {
      // Merge entries
      current = {
        start: current.start,
        end: Math.max(current.end, next.end),
        text: current.text + ' ' + next.text
      };
    } else {
      // Add current to result and move to next
      merged.push(current);
      current = next;
    }
  }
  
  // Add the last entry
  merged.push(current);
  
  return merged;
}
