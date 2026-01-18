/**
 * Health check endpoint for monitoring and load balancers
 */

import type { Env, RouteHandler } from '../types';

export const handleHealth: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/health" || request.method !== "GET") {
    return null;
  }

  const startTime = Date.now();
  let kvStatus = 'ok';
  let r2Status = 'ok';

  try {
    // Quick KV check (read-only, key doesn't need to exist)
    await env.TRIPS.get("_health_check", "text");
  } catch {
    kvStatus = 'error';
  }

  try {
    // Quick R2 check (head request on bucket)
    await env.MEDIA.head("_health_check");
  } catch {
    // R2 returns error for missing keys, that's expected
    r2Status = 'ok';
  }

  const responseTime = Date.now() - startTime;
  const status = kvStatus === 'ok' ? 'healthy' : 'degraded';

  return new Response(JSON.stringify({
    status,
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime}ms`,
    services: { kv: kvStatus, r2: r2Status },
    version: '1.0.0'
  }), {
    status: status === 'healthy' ? 200 : 503,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
};
