/**
 * Admin Routes: Maintenance Telemetry
 * Handles: GET /admin/maintenance/status, GET /admin/maintenance/history
 */

import type { Env, RouteHandler } from '../../types';
import type { MaintenanceResult } from '../../lib/maintenance';
import { listAllKeys } from '../../lib/kv';

/**
 * GET /admin/maintenance/status - Get latest maintenance run status
 */
export const handleMaintenanceStatus: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/maintenance/status' || request.method !== 'GET') return null;

  const lastRun = await env.TRIPS.get('_maintenance/last_run', 'json') as MaintenanceResult | null;
  const globalStats = await env.TRIPS.get('_indexes/global_stats', 'json');

  return new Response(JSON.stringify({
    lastRun,
    globalStats,
    nextRun: 'Every 15 minutes (cron)'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * GET /admin/maintenance/history - Get maintenance run history (last 7 days)
 */
export const handleMaintenanceHistory: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/maintenance/history' || request.method !== 'GET') return null;

  // Get maintenance logs from the last 7 days
  const history: MaintenanceResult[] = [];
  const keys = await listAllKeys(env, { prefix: '_maintenance/log/' });

  // Sort by date descending and take last 50
  const sortedKeys = keys
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(0, 50);

  for (const key of sortedKeys) {
    const log = await env.TRIPS.get(key.name, 'json') as MaintenanceResult;
    if (log) {
      history.push(log);
    }
  }

  return new Response(JSON.stringify({
    history,
    count: history.length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * POST /admin/maintenance/run - Manually trigger maintenance (for testing)
 */
export const handleMaintenanceRun: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/maintenance/run' || request.method !== 'POST') return null;

  // Import dynamically to avoid circular deps
  const { runMaintenance } = await import('../../lib/maintenance');

  const result = await runMaintenance(env);

  // Also save to history log
  const logKey = `_maintenance/log/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  await env.TRIPS.put(logKey, JSON.stringify(result));

  return new Response(JSON.stringify({
    success: true,
    result
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};
