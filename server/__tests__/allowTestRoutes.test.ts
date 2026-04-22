import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { allowTestAndDebugRoutes } from '../src/middleware/allowTestRoutes';

function mockRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('allowTestAndDebugRoutes (unit)', () => {
  const req = {} as Request;
  let origNodeEnv: string | undefined;
  let origAllow: string | undefined;

  beforeEach(() => {
    origNodeEnv = process.env.NODE_ENV;
    origAllow = process.env.ALLOW_TEST_ROUTES;
  });

  afterEach(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origAllow === undefined) delete process.env.ALLOW_TEST_ROUTES;
    else process.env.ALLOW_TEST_ROUTES = origAllow;
  });

  function expectBlocked(next: NextFunction, res: Response) {
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  }

  function expectAllowed(next: NextFunction, res: Response) {
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  }

  it('calls next when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_TEST_ROUTES;
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectAllowed(next, res);
  });

  it('calls next when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_TEST_ROUTES;
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectAllowed(next, res);
  });

  it('calls next when NODE_ENV is undefined (not production)', () => {
    delete process.env.NODE_ENV;
    delete process.env.ALLOW_TEST_ROUTES;
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectAllowed(next, res);
  });

  it('calls next when NODE_ENV is empty string (not production)', () => {
    process.env.NODE_ENV = '';
    delete process.env.ALLOW_TEST_ROUTES;
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectAllowed(next, res);
  });

  it('returns 404 in production when ALLOW_TEST_ROUTES is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_TEST_ROUTES;
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectBlocked(next, res);
  });

  it('returns 404 in production when ALLOW_TEST_ROUTES is empty after trim', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_ROUTES = '   ';
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectBlocked(next, res);
  });

  it('returns 404 in production when ALLOW_TEST_ROUTES is not exactly true', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_ROUTES = 'false';
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectBlocked(next, res);
  });

  it('returns 404 in production when ALLOW_TEST_ROUTES is True (case-sensitive)', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_ROUTES = 'True';
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectBlocked(next, res);
  });

  it('returns 404 in production when ALLOW_TEST_ROUTES is 1', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_ROUTES = '1';
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectBlocked(next, res);
  });

  it('calls next in production when ALLOW_TEST_ROUTES is true', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_ROUTES = 'true';
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectAllowed(next, res);
  });

  it('calls next in production when ALLOW_TEST_ROUTES is true with surrounding whitespace', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_ROUTES = '  true  ';
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectAllowed(next, res);
  });

  it('does not call next in non-production when ALLOW_TEST_ROUTES would block in prod', () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_ROUTES = 'false';
    const next = jest.fn();
    const res = mockRes();
    allowTestAndDebugRoutes(req, res, next);
    expectAllowed(next, res);
  });
});

describe('allowTestAndDebugRoutes (HTTP integration)', () => {
  let origNodeEnv: string | undefined;
  let origAllow: string | undefined;

  beforeEach(() => {
    origNodeEnv = process.env.NODE_ENV;
    origAllow = process.env.ALLOW_TEST_ROUTES;
  });

  afterEach(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origAllow === undefined) delete process.env.ALLOW_TEST_ROUTES;
    else process.env.ALLOW_TEST_ROUTES = origAllow;
  });

  function gatedApp() {
    const app = express();
    app.get('/gated', allowTestAndDebugRoutes, (_req, res) => {
      res.json({ ok: true });
    });
    return app;
  }

  it('responds 200 through gate in development without ALLOW_TEST_ROUTES', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_TEST_ROUTES;
    const res = await request(gatedApp()).get('/gated');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('responds 404 from gate in production without ALLOW_TEST_ROUTES', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_TEST_ROUTES;
    const res = await request(gatedApp()).get('/gated');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('responds 200 from gate in production when ALLOW_TEST_ROUTES=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_ROUTES = 'true';
    const res = await request(gatedApp()).get('/gated');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
