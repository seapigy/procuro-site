import type { RequestHandler } from 'express';

/**
 * In production, test and debug HTTP routes are disabled unless
 * ALLOW_TEST_ROUTES=true (e.g. staging or controlled debugging).
 * Development and test (Jest) always allow.
 */
export const allowTestAndDebugRoutes: RequestHandler = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  if (process.env.ALLOW_TEST_ROUTES?.trim() === 'true') {
    return next();
  }
  res.status(404).json({ error: 'Not found' });
};
