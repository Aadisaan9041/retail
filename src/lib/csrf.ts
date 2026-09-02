/**
 * CSRF Protection utilities for secure form handling.
 * Generates and validates CSRF tokens to prevent Cross-Site Request Forgery attacks.
 */

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_EXPIRY_KEY = 'csrf_token_expiry';
const TOKEN_VALIDITY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generates a cryptographically secure random token
 */
function generateRandomToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Gets or creates a CSRF token for the current session.
 * Tokens expire after 30 minutes of inactivity.
 */
export function getCSRFToken(): string {
  const existingToken = sessionStorage.getItem(CSRF_TOKEN_KEY);
  const expiryStr = sessionStorage.getItem(CSRF_TOKEN_EXPIRY_KEY);
  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
  
  // Check if token exists and is still valid
  if (existingToken && expiry > Date.now()) {
    // Extend token validity on each use
    sessionStorage.setItem(CSRF_TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_VALIDITY_MS));
    return existingToken;
  }
  
  // Generate new token
  const newToken = generateRandomToken();
  sessionStorage.setItem(CSRF_TOKEN_KEY, newToken);
  sessionStorage.setItem(CSRF_TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_VALIDITY_MS));
  
  return newToken;
}

/**
 * Validates a CSRF token against the stored token.
 */
export function validateCSRFToken(token: string): boolean {
  const storedToken = sessionStorage.getItem(CSRF_TOKEN_KEY);
  const expiryStr = sessionStorage.getItem(CSRF_TOKEN_EXPIRY_KEY);
  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
  
  if (!storedToken || !token) {
    return false;
  }
  
  // Check expiry
  if (expiry < Date.now()) {
    clearCSRFToken();
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  return constantTimeCompare(token, storedToken);
}

/**
 * Clears the CSRF token (call on logout)
 */
export function clearCSRFToken(): void {
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
  sessionStorage.removeItem(CSRF_TOKEN_EXPIRY_KEY);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * React hook helper - returns CSRF token and refresh function
 */
export function useCSRFToken(): { token: string; refresh: () => string } {
  const token = getCSRFToken();
  
  const refresh = () => {
    clearCSRFToken();
    return getCSRFToken();
  };
  
  return { token, refresh };
}
