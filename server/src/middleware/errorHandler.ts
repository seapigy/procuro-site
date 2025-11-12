import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class with status code
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Centralized error handling middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = (err as AppError).statusCode || 500;
  const route = `${req.method} ${req.path}`;
  
  // Log error for debugging
  console.error(`[${new Date().toISOString()}] Error on ${route}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Send JSON error response
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal server error',
    route,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.path}`,
    route: `${req.method} ${req.path}`
  });
}

/**
 * Async route wrapper to catch errors
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error helper
 */
export function validationError(message: string) {
  return new AppError(message, 400);
}

/**
 * Unauthorized error helper
 */
export function unauthorizedError(message: string = 'Unauthorized') {
  return new AppError(message, 401);
}

/**
 * Not found error helper
 */
export function notFoundError(resource: string) {
  return new AppError(`${resource} not found`, 404);
}

/**
 * Internal server error helper
 */
export function serverError(message: string = 'Internal server error') {
  return new AppError(message, 500);
}

