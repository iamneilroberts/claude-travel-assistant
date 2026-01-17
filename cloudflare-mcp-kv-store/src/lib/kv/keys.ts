/**
 * KV key utilities for Voygent MCP Server
 */

import type { Env } from '../../types';

export type KvListOptions = { prefix?: string; cursor?: string; limit?: number };
export type KvListKey = { name: string };

/**
 * List all keys from KV with pagination support
 */
export async function listAllKeys(env: Env, options: KvListOptions = {}): Promise<KvListKey[]> {
  const keys: KvListKey[] = [];
  const { cursor: initialCursor, ...rest } = options;
  let cursor: string | undefined = initialCursor;

  while (true) {
    const result = await env.TRIPS.list({ ...rest, cursor });
    keys.push(...result.keys);
    if (result.list_complete || !result.cursor) break;
    cursor = result.cursor;
  }

  return keys;
}

/**
 * Get key prefix for data isolation (sanitize key to safe string)
 * Converts auth key to safe prefix: "Home.Star1" -> "home_star1/"
 */
export function getKeyPrefix(authKey: string): string {
  return authKey.toLowerCase().replace(/[^a-z0-9]/g, '_') + '/';
}
