/**
 * Soft delete tracking for trips
 * Pending deletions are tracked to handle KV eventual consistency
 */

import type { Env } from '../../types';

export const PENDING_TRIP_DELETE_TTL_SECONDS = 600;

/**
 * Get list of trips pending deletion for a user
 */
export async function getPendingTripDeletions(env: Env, keyPrefix: string): Promise<string[]> {
  const key = `${keyPrefix}_trip-deletes`;
  return await env.TRIPS.get(key, "json") as string[] || [];
}

/**
 * Set the list of pending trip deletions
 */
export async function setPendingTripDeletions(
  env: Env,
  keyPrefix: string,
  pending: string[],
  ctx?: ExecutionContext
): Promise<void> {
  const key = `${keyPrefix}_trip-deletes`;
  if (pending.length === 0) {
    const del = env.TRIPS.delete(key);
    if (ctx) {
      ctx.waitUntil(del);
    } else {
      await del;
    }
    return;
  }

  const write = env.TRIPS.put(key, JSON.stringify(pending), {
    expirationTtl: PENDING_TRIP_DELETE_TTL_SECONDS
  });
  if (ctx) {
    ctx.waitUntil(write);
  } else {
    await write;
  }
}

/**
 * Add a trip to the pending deletion list
 */
export async function addPendingTripDeletion(
  env: Env,
  keyPrefix: string,
  tripId: string,
  ctx?: ExecutionContext
): Promise<void> {
  if (tripId.startsWith("_") || tripId.includes("/_")) return;
  const pending = await getPendingTripDeletions(env, keyPrefix);
  if (pending.includes(tripId)) return;
  pending.push(tripId);
  await setPendingTripDeletions(env, keyPrefix, pending, ctx);
}

/**
 * Remove a trip from the pending deletion list
 */
export async function removePendingTripDeletion(
  env: Env,
  keyPrefix: string,
  tripId: string,
  ctx?: ExecutionContext
): Promise<void> {
  const pending = await getPendingTripDeletions(env, keyPrefix);
  if (!pending.includes(tripId)) return;
  await setPendingTripDeletions(env, keyPrefix, pending.filter(id => id !== tripId), ctx);
}

/**
 * Filter out pending deletions from a list of trip IDs
 * Also cleans up confirmed deletions from the pending list
 */
export async function filterPendingTripDeletions(
  env: Env,
  keyPrefix: string,
  tripIds: string[],
  ctx?: ExecutionContext
): Promise<string[]> {
  const pending = await getPendingTripDeletions(env, keyPrefix);
  if (pending.length === 0) return tripIds;

  const pendingSet = new Set(pending);
  const visibleTrips = tripIds.filter(id => !pendingSet.has(id));
  const confirmedDeleted: string[] = [];

  for (const tripId of pending) {
    const exists = await env.TRIPS.get(`${keyPrefix}${tripId}`, "text");
    if (!exists) {
      confirmedDeleted.push(tripId);
    }
  }

  if (confirmedDeleted.length > 0) {
    const nextPending = pending.filter(id => !confirmedDeleted.includes(id));
    await setPendingTripDeletions(env, keyPrefix, nextPending, ctx);
  }

  return visibleTrips;
}
