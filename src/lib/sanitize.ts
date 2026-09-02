/**
 * Sanitization utilities to prevent XSS attacks in user-generated content.
 * Use these functions when displaying or printing user data.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Use this when displaying user input in HTML context.
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return String(text || '');
  }
  
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return text.replace(/[&<>"'`=/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Sanitizes text for PDF generation.
 * Removes control characters and normalizes whitespace.
 */
export function sanitizeForPdf(text: string): string {
  if (typeof text !== 'string') {
    return String(text || '');
  }
  
  return text
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Remove potential script injection patterns
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Sanitizes currency values to ensure they're valid numbers.
 */
export function sanitizeCurrency(value: unknown): number {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return 0;
  }
  // Clamp to reasonable range
  return Math.max(0, Math.min(num, 999999999.99));
}

/**
 * Truncates text to a maximum length safely.
 */
export function truncateText(text: string, maxLength: number): string {
  if (typeof text !== 'string') {
    return '';
  }
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Validates and sanitizes a string for use in identifiers/codes.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
export function sanitizeIdentifier(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    .slice(0, 50);
}
