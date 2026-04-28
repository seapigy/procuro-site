import axios from 'axios';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export type ImportRunStatus = 'running' | 'success' | 'empty' | 'error';

export function mapImportErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();

  if (message.includes('oauth state')) return 'oauth_state_invalid';
  if (message.includes('expired')) return 'token_expired';
  if (message.includes('token') && message.includes('refresh')) return 'token_refresh_failed';
  if (message.includes('realm')) return 'qb_realm_missing';
  if (message.includes('company info')) return 'qb_company_info_failed';
  if (message.includes('quickbooks') && message.includes('connect')) return 'oauth_token_exchange_failed';
  if (message.includes('timeout')) return 'qb_api_timeout';
  if (message.includes('rate')) return 'qb_api_rate_limited';
  if (message.includes('parse')) return 'qb_response_parse_failed';
  if (message.includes('failed to import')) return 'import_failed';

  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    if (status === 401) return 'qb_api_unauthorized';
    if (status === 403) return 'qb_api_forbidden';
    if (status === 429) return 'qb_api_rate_limited';
    if (status >= 500) return 'qb_api_unavailable';
    if (status >= 400) return 'qb_api_bad_request';
  }

  return 'unknown_internal_error';
}

export function safeErrorMessage(error: unknown, max = 500): string {
  const text = error instanceof Error ? error.message : String(error || 'Unknown error');
  return text.length > max ? text.slice(0, max) : text;
}

export async function startImportRun(data: {
  companyId: number;
  userId?: number | null;
  source: string;
  realmId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const run = await prisma.importRun.create({
    data: {
      companyId: data.companyId,
      userId: data.userId ?? null,
      source: data.source,
      status: 'running',
      startedAt: new Date(),
      realmId: data.realmId ?? null,
      metadata: (data.metadata || {}) as Prisma.InputJsonValue,
    },
  });
  return run.id;
}

export async function finishImportRun(
  runId: number,
  data: {
    status: ImportRunStatus;
    importedItemCount?: number;
    errorCode?: string | null;
    errorMessage?: string | null;
  }
): Promise<void> {
  const finishedAt = new Date();
  const started = await prisma.importRun.findUnique({ where: { id: runId }, select: { startedAt: true } });
  const durationMs = started?.startedAt ? Math.max(0, finishedAt.getTime() - started.startedAt.getTime()) : null;

  await prisma.importRun.update({
    where: { id: runId },
    data: {
      status: data.status,
      importedItemCount: data.importedItemCount ?? 0,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ?? null,
      finishedAt,
      durationMs,
    },
  });
}
