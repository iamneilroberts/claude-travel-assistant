/**
 * Trip index operations for O(1) trip list lookups per user
 */

import type { Env } from '../../types';
import { listAllKeys } from './keys';

/**
 * Rebuild trip index from KV keys (scans all keys with user prefix)
 */
export async function rebuildTripIndex(env: Env, keyPrefix: string): Promise<string[]> {
  const keys = await listAllKeys(env, { prefix: keyPrefix });
  const trips = keys
    .map(k => k.name.replace(keyPrefix, ''))
    .filter(k => !k.startsWith("_") && !k.includes("/_"));

  await env.TRIPS.put(`${keyPrefix}_trip-index`, JSON.stringify(trips));
  return trips;
}

/**
 * Get trip index (cached list of trip IDs for a user)
 */
export async function getTripIndex(env: Env, keyPrefix: string): Promise<string[]> {
  const indexKey = `${keyPrefix}_trip-index`;
  const existing = await env.TRIPS.get(indexKey, "json") as string[] | null;
  if (existing) return existing;
  return rebuildTripIndex(env, keyPrefix);
}

/**
 * Add a trip ID to the index
 */
export async function addToTripIndex(env: Env, keyPrefix: string, tripId: string): Promise<void> {
  if (tripId.startsWith("_") || tripId.includes("/_")) return;
  const indexKey = `${keyPrefix}_trip-index`;
  const existing = await env.TRIPS.get(indexKey, "json") as string[] | null;
  const baseline = existing || await rebuildTripIndex(env, keyPrefix);
  if (baseline.includes(tripId)) return;
  await env.TRIPS.put(indexKey, JSON.stringify([...baseline, tripId]));
}

/**
 * Remove a trip ID from the index
 */
export async function removeFromTripIndex(env: Env, keyPrefix: string, tripId: string): Promise<void> {
  const indexKey = `${keyPrefix}_trip-index`;
  const existing = await env.TRIPS.get(indexKey, "json") as string[] | null;
  if (!existing) return;
  await env.TRIPS.put(indexKey, JSON.stringify(existing.filter(id => id !== tripId)));
}
