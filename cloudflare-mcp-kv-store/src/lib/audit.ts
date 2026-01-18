/**
 * Admin audit logging for tracking who modified what
 */

import type { Env } from '../types';

export type AuditAction =
  | 'create_user'
  | 'update_user'
  | 'delete_user'
  | 'create_promo'
  | 'delete_promo'
  | 'update_support';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  resource: string;
  details: Record<string, any>;
  adminKeyHash: string;  // First 8 chars of admin key for identification
}

/**
 * Log an admin action to the audit log
 * Uses waitUntil for fire-and-forget logging to avoid blocking admin operations
 */
export async function logAdminAction(
  env: Env,
  action: AuditAction,
  resource: string,
  details: Record<string, any>,
  adminKey: string,
  ctx?: ExecutionContext
): Promise<void> {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    resource,
    details,
    adminKeyHash: adminKey.slice(0, 8)
  };

  // Fire and forget - don't block admin operations
  const write = (async () => {
    try {
      const existing = await env.TRIPS.get('_audit_log', 'json') as { entries: AuditEntry[] } | null;
      const entries = existing?.entries || [];
      entries.unshift(entry);
      // Keep last 500 entries to prevent unbounded growth
      await env.TRIPS.put('_audit_log', JSON.stringify({ entries: entries.slice(0, 500) }));
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  })();

  if (ctx) {
    ctx.waitUntil(write);
  } else {
    await write;
  }
}

/**
 * Get the audit log entries
 */
export async function getAuditLog(env: Env, limit = 100): Promise<AuditEntry[]> {
  const data = await env.TRIPS.get('_audit_log', 'json') as { entries: AuditEntry[] } | null;
  return (data?.entries || []).slice(0, limit);
}

/**
 * Format audit action for display
 */
export function formatAuditAction(action: AuditAction): string {
  const actionMap: Record<AuditAction, string> = {
    create_user: 'Created user',
    update_user: 'Updated user',
    delete_user: 'Deleted user',
    create_promo: 'Created promo code',
    delete_promo: 'Deleted promo code',
    update_support: 'Updated support ticket'
  };
  return actionMap[action] || action;
}
