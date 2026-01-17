/**
 * Comment index operations for O(1) comment lookups
 * Index stores trip IDs that have active (non-dismissed) comments
 */

import type { Env } from '../../types';

/**
 * Add a trip to the comment index (has active comments)
 */
export async function addToCommentIndex(env: Env, keyPrefix: string, tripId: string): Promise<void> {
  const indexKey = `${keyPrefix}_comment-index`;
  const existing = await env.TRIPS.get(indexKey, "json") as string[] | null;
  const index = new Set(existing || []);
  index.add(tripId);
  await env.TRIPS.put(indexKey, JSON.stringify([...index]));
}

/**
 * Remove a trip from the comment index (no more active comments)
 */
export async function removeFromCommentIndex(env: Env, keyPrefix: string, tripId: string): Promise<void> {
  const indexKey = `${keyPrefix}_comment-index`;
  const existing = await env.TRIPS.get(indexKey, "json") as string[] | null;
  if (!existing) return;
  const index = new Set(existing);
  index.delete(tripId);
  await env.TRIPS.put(indexKey, JSON.stringify([...index]));
}

/**
 * Get the list of trip IDs with active comments
 */
export async function getCommentIndex(env: Env, keyPrefix: string): Promise<string[]> {
  const indexKey = `${keyPrefix}_comment-index`;
  return await env.TRIPS.get(indexKey, "json") as string[] || [];
}
