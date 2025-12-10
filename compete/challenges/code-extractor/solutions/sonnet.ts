/**
 * Extract source code from LLM responses
 * @param response - The full LLM response text
 * @returns The extracted code (trimmed)
 */
export function extractCode(response: string): string {
  if (!response) return '';
  
  const trimmed = response.trim();
  if (!trimmed) return '';
  
  // Use hex escapes to avoid backtick issues
  const FENCE = '\x60\x60\x60'; //