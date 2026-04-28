import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import {
  getAdminOwnerEmails,
  getAdminSessionMaxAgeSeconds,
  isAdminPortalEnabled,
  verifyAdminSession,
} from '../config/adminPortal';

const ADMIN_COOKIE_NAME = 'procuro_admin_session';

declare global {
  namespace Express {
    interface Request {
      adminUser?: { email: string; sub: string };
    }
  }
}

function readCookie(req: Request, key: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${key}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(`${key}=`.length));
}

function clearCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

export function setAdminSessionCookie(res: Response, token: string): void {
  const maxAge = getAdminSessionMaxAgeSeconds();
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminPortalEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const token = readCookie(req, ADMIN_COOKIE_NAME);
  if (!token) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const payload = verifyAdminSession(token);
  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const sub = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
  if (!email || !sub) {
    clearCookie(res);
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const allowedOwners = getAdminOwnerEmails();
  if (!allowedOwners.includes(email)) {
    clearCookie(res);
    res.status(404).json({ error: 'Not found' });
    return;
  }

  req.adminUser = { email, sub };
  next();
}

export async function writeAdminAudit(
  req: Request,
  data: {
    action: string;
    success: boolean;
    errorCode?: string;
    targetCompanyId?: number | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminEmail: req.adminUser?.email || 'unknown',
        action: data.action,
        endpoint: req.path,
        method: req.method,
        targetCompanyId: data.targetCompanyId ?? null,
        success: data.success,
        errorCode: data.errorCode || null,
        correlationId: String(req.headers['x-request-id'] || ''),
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error('Failed to write admin audit log:', error);
  }
}
