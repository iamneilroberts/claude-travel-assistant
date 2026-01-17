/**
 * Auth key utilities for Voygent MCP Server
 */

import type { Env } from '../../types';

/**
 * Get valid auth keys (check KV first, then fall back to env var)
 */
export async function getValidAuthKeys(env: Env): Promise<string[]> {
  // First check KV for auth keys
  const kvKeys = await env.TRIPS.get("_config/auth-keys", "json") as string[] | null;
  if (kvKeys && kvKeys.length > 0) {
    return kvKeys;
  }
  // Fallback to env var during migration
  return env.AUTH_KEYS ? env.AUTH_KEYS.split(',').map(k => k.trim()) : [];
}
