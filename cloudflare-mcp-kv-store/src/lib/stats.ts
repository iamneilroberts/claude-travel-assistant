/**
 * Stats tracking for page views and analytics
 */

import type { Env } from '../types';

/**
 * Daily view statistics
 */
export interface DailyViews {
  date: string; // YYYY-MM-DD
  views: number;
}

/**
 * Trip statistics
 */
export interface TripStats {
  tripId: string;
  totalViews: number;
  dailyViews: DailyViews[];
}

/**
 * User-level statistics
 */
export interface UserStats {
  totalTrips: number;
  publishedTrips: number;
  totalViews: number;
  viewsLast30Days: number;
  unreadComments: number;
  topTrips: Array<{ tripId: string; title: string; views: number }>;
}

/**
 * Track a page view for a trip
 * Increments both daily and total counters
 */
export async function trackPageView(
  env: Env,
  userId: string,
  tripId: string
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Increment daily counter (with 90-day TTL)
  const dailyKey = `${userId}/_stats/views/${tripId}/${today}`;
  const currentDaily = await env.TRIPS.get(dailyKey);
  const newDailyCount = (parseInt(currentDaily || '0', 10) || 0) + 1;
  await env.TRIPS.put(dailyKey, String(newDailyCount), {
    expirationTtl: 60 * 60 * 24 * 90 // 90 days
  });

  // Increment total counter (no TTL)
  const totalKey = `${userId}/_stats/views/${tripId}/total`;
  const currentTotal = await env.TRIPS.get(totalKey);
  const newTotalCount = (parseInt(currentTotal || '0', 10) || 0) + 1;
  await env.TRIPS.put(totalKey, String(newTotalCount));
}

/**
 * Get view statistics for a specific trip
 */
export async function getTripStats(
  env: Env,
  userId: string,
  tripId: string,
  days: number = 30
): Promise<TripStats> {
  // Get total views
  const totalKey = `${userId}/_stats/views/${tripId}/total`;
  const totalViews = parseInt(await env.TRIPS.get(totalKey) || '0', 10) || 0;

  // Get daily views for the last N days
  const dailyViews: DailyViews[] = [];
  const now = Date.now();

  for (let i = 0; i < days; i++) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const dailyKey = `${userId}/_stats/views/${tripId}/${date}`;
    const views = parseInt(await env.TRIPS.get(dailyKey) || '0', 10) || 0;
    dailyViews.push({ date, views });
  }

  // Reverse so oldest is first
  dailyViews.reverse();

  return {
    tripId,
    totalViews,
    dailyViews
  };
}

/**
 * Get aggregate statistics for a user
 */
export async function getUserStats(
  env: Env,
  userId: string,
  tripIds: string[]
): Promise<UserStats> {
  let totalViews = 0;
  let viewsLast30Days = 0;
  const tripViewCounts: Array<{ tripId: string; views: number }> = [];

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  for (const tripId of tripIds) {
    // Get total views
    const totalKey = `${userId}/_stats/views/${tripId}/total`;
    const tripTotal = parseInt(await env.TRIPS.get(totalKey) || '0', 10) || 0;
    totalViews += tripTotal;
    tripViewCounts.push({ tripId, views: tripTotal });

    // Get last 30 days views
    for (let i = 0; i < 30; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const dailyKey = `${userId}/_stats/views/${tripId}/${date}`;
      const dailyViews = parseInt(await env.TRIPS.get(dailyKey) || '0', 10) || 0;
      viewsLast30Days += dailyViews;
    }
  }

  // Sort trips by views descending and take top 5
  tripViewCounts.sort((a, b) => b.views - a.views);
  const topTrips = tripViewCounts.slice(0, 5).map(t => ({
    tripId: t.tripId,
    title: t.tripId, // Title will be filled in by caller
    views: t.views
  }));

  return {
    totalTrips: tripIds.length,
    publishedTrips: tripIds.length, // Assuming all passed trips are published
    totalViews,
    viewsLast30Days,
    unreadComments: 0, // Will be filled in by caller
    topTrips
  };
}

/**
 * Get views for a specific date range
 */
export async function getViewsInRange(
  env: Env,
  userId: string,
  tripId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  let totalViews = 0;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let time = start; time <= end; time += dayMs) {
    const date = new Date(time).toISOString().split('T')[0];
    const dailyKey = `${userId}/_stats/views/${tripId}/${date}`;
    const dailyViews = parseInt(await env.TRIPS.get(dailyKey) || '0', 10) || 0;
    totalViews += dailyViews;
  }

  return totalViews;
}

/**
 * Get today's views for a trip
 */
export async function getTodaysViews(
  env: Env,
  userId: string,
  tripId: string
): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const dailyKey = `${userId}/_stats/views/${tripId}/${today}`;
  return parseInt(await env.TRIPS.get(dailyKey) || '0', 10) || 0;
}

/**
 * Clean up old stats beyond the retention period
 * Called by cron job
 */
export async function cleanupOldStats(
  env: Env,
  userId: string,
  retentionDays: number = 90
): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // List all stats keys for this user
  const prefix = `${userId}/_stats/views/`;
  const keys = await env.TRIPS.list({ prefix });

  let deletedCount = 0;

  for (const key of keys.keys) {
    // Extract date from key if it's a daily key
    const parts = key.name.split('/');
    const lastPart = parts[parts.length - 1];

    // Skip total keys
    if (lastPart === 'total') continue;

    // Check if it's a date (YYYY-MM-DD format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(lastPart) && lastPart < cutoffDate) {
      await env.TRIPS.delete(key.name);
      deletedCount++;
    }
  }

  return deletedCount;
}
