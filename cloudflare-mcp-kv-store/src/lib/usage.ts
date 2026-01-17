/**
 * Usage tracking for publish limits
 */

import type { Env, MonthlyUsage } from '../types';

/**
 * Get current month's usage for a user
 */
export async function getMonthlyUsage(env: Env, userId: string): Promise<MonthlyUsage> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const usageKey = `_usage/${userId}/${currentMonth}`;
  const usage = await env.TRIPS.get(usageKey, "json") as MonthlyUsage | null;
  return usage || {
    userId,
    period: currentMonth,
    publishCount: 0,
    publishedTrips: [],
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Increment publish count for a user
 */
export async function incrementPublishCount(
  env: Env,
  userId: string,
  tripId: string,
  filename: string
): Promise<MonthlyUsage> {
  const usage = await getMonthlyUsage(env, userId);
  usage.publishCount++;
  usage.publishedTrips.push({
    tripId,
    publishedAt: new Date().toISOString(),
    filename
  });
  usage.lastUpdated = new Date().toISOString();

  const currentMonth = new Date().toISOString().slice(0, 7);
  await env.TRIPS.put(`_usage/${userId}/${currentMonth}`, JSON.stringify(usage));
  return usage;
}
