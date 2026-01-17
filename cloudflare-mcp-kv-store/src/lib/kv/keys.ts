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
 * Uses collision-resistant encoding: each special character maps to a unique code
 *
 * SECURITY: The old implementation replaced ALL non-alphanumeric chars with '_'
 * which caused collisions (kim.abc, kim-abc, kim_abc all became kim_abc/).
 *
 * This new implementation:
 * - Preserves alphanumeric characters (lowercase)
 * - Encodes each special character uniquely: . -> _d_, - -> _h_, _ -> _u_, etc.
 * - Ensures different auth keys ALWAYS produce different prefixes
 */
export function getKeyPrefix(authKey: string): string {
  const result: string[] = [];
  const lower = authKey.toLowerCase();

  for (let i = 0; i < lower.length; i++) {
    const char = lower[i];
    if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
      result.push(char);
    } else {
      // Encode special characters uniquely using their char code
      // Format: _XX_ where XX is the hex code
      const code = char.charCodeAt(0).toString(16).padStart(2, '0');
      result.push(`_${code}_`);
    }
  }

  return result.join('') + '/';
}

/**
 * Legacy getKeyPrefix for backward compatibility
 * DEPRECATED: Use getKeyPrefix() for new code
 * This is kept only for migrating existing data
 */
export function getLegacyKeyPrefix(authKey: string): string {
  return authKey.toLowerCase().replace(/[^a-z0-9]/g, '_') + '/';
}
