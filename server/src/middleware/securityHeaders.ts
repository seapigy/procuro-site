/**
 * Security Headers Middleware
 * Adds standard security headers to all responses
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware
 * Adds standard security headers to prevent common attacks
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy - minimal for now, can be refined later
  // Allows:
  // - Resources from same origin ('self')
  // - Images from same origin and data URIs
  // - API connections to same origin and any external domain (for provider APIs)
  // Allow inline <style> on static HTML landing pages and Google Fonts (landing uses both).
  // Without style-src, browsers fall back to default-src and block inline styles.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src https://fonts.gstatic.com data:; " +
      "img-src 'self' data:; " +
      "connect-src 'self' *"
  );
  
  next();
}

