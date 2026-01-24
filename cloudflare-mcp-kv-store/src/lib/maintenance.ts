/**
 * Scheduled Maintenance Tasks
 * Runs via cron job every 15 minutes
 */

import type { Env } from '../types';
import { listAllKeys, getKeyPrefix } from './kv';
import {
  updateTripSummariesIndex,
  updateUserActivityIndex,
  updateCommentsIndex,
  buildDashboardCache,
  isDashboardCacheStale,
  getDashboardCache,
  type TripSummariesIndex,
  type DashboardCache
} from './indexes';

// ============================================
// CLEANUP TASKS
// ============================================

/**
 * Archive old support telemetry (older than 30 days)
 */
async function archiveSupportTelemetry(env: Env): Promise<{ archived: number }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

  const keys = await listAllKeys(env, { prefix: '_support_telemetry/' });
  let archived = 0;

  for (const key of keys) {
    const date = key.name.replace('_support_telemetry/', '');
    if (date < cutoffDate) {
      // Move to archive (could also just delete if archive not needed)
      const data = await env.TRIPS.get(key.name, 'json');
      if (data) {
        await env.TRIPS.put(`_archive/support_telemetry/${date}`, JSON.stringify(data));
        await env.TRIPS.delete(key.name);
        archived++;
      }
    }
  }

  return { archived };
}

/**
 * Clean up expired daily quotas (knowledge base rate limiting)
 * Quotas are per-day, so anything older than today can be deleted
 */
async function cleanupExpiredQuotas(env: Env): Promise<{ deleted: number }> {
  const today = new Date().toISOString().split('T')[0];
  const keys = await listAllKeys(env, { prefix: '_knowledge/quotas/' });
  let deleted = 0;

  for (const key of keys) {
    // Key format: _knowledge/quotas/YYYY-MM-DD/userId
    const match = key.name.match(/_knowledge\/quotas\/(\d{4}-\d{2}-\d{2})\//);
    if (match && match[1] < today) {
      await env.TRIPS.delete(key.name);
      deleted++;
    }
  }

  return { deleted };
}

/**
 * Clean up old AI support logs (older than 90 days)
 */
async function cleanupOldLogs(env: Env): Promise<{ deleted: number }> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];

  const keys = await listAllKeys(env, { prefix: '_ai_support/log/' });
  let deleted = 0;

  for (const key of keys) {
    const date = key.name.replace('_ai_support/log/', '');
    if (date < cutoffDate) {
      await env.TRIPS.delete(key.name);
      deleted++;
    }
  }

  return { deleted };
}

/**
 * Clean up old activity logs (older than 7 days)
 */
async function cleanupOldActivityLogs(env: Env): Promise<{ deleted: number }> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];

  const keys = await listAllKeys(env, { prefix: '_activity/' });
  let deleted = 0;

  for (const key of keys) {
    // Key format: _activity/YYYY-MM-DD or _activity/userId/YYYY-MM-DD
    const dateMatch = key.name.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch && dateMatch[1] < cutoffDate) {
      await env.TRIPS.delete(key.name);
      deleted++;
    }
  }

  return { deleted };
}

// ============================================
// INDEX VALIDATION & REPAIR
// ============================================

/**
 * Validate and repair user trip indexes
 * Checks that trip-index matches actual trips in KV
 */
async function validateTripIndexes(env: Env): Promise<{
  usersChecked: number;
  repaired: number;
  orphanedTrips: number;
}> {
  const userKeys = await listAllKeys(env, { prefix: '_users/' });
  let usersChecked = 0;
  let repaired = 0;
  let orphanedTrips = 0;

  // Check max 5 users per run to stay within CPU limits
  for (const userKey of userKeys.slice(0, 5)) {
    const userId = userKey.name.replace('_users/', '');
    const keyPrefix = getKeyPrefix(userId);
    const indexKey = `${keyPrefix}_trip-index`;

    const index = await env.TRIPS.get(indexKey, 'json') as string[] | null;

    if (!index) {
      // No index - rebuild from actual keys
      const tripKeys = await listAllKeys(env, { prefix: keyPrefix });
      const actualTrips = tripKeys
        .map(k => k.name.replace(keyPrefix, ''))
        .filter(k => !k.startsWith('_') && !k.includes('/_'));

      if (actualTrips.length > 0) {
        await env.TRIPS.put(indexKey, JSON.stringify(actualTrips));
        repaired++;
      }
    } else {
      // Verify index entries still exist (spot check first 5)
      const toVerify = index.slice(0, 5);
      const checks = await Promise.all(
        toVerify.map(async tripId => {
          const exists = await env.TRIPS.get(`${keyPrefix}${tripId}`, 'text');
          return { tripId, exists: !!exists };
        })
      );

      const missing = checks.filter(c => !c.exists);
      if (missing.length > 0) {
        // Some indexed trips don't exist - rebuild
        const tripKeys = await listAllKeys(env, { prefix: keyPrefix });
        const actualTrips = tripKeys
          .map(k => k.name.replace(keyPrefix, ''))
          .filter(k => !k.startsWith('_') && !k.includes('/_'));

        await env.TRIPS.put(indexKey, JSON.stringify(actualTrips));
        orphanedTrips += missing.length;
        repaired++;
      }
    }

    usersChecked++;
  }

  return { usersChecked, repaired, orphanedTrips };
}

/**
 * Validate comment indexes match actual comments
 */
async function validateCommentIndexes(env: Env): Promise<{
  usersChecked: number;
  repaired: number;
}> {
  const userKeys = await listAllKeys(env, { prefix: '_users/' });
  let usersChecked = 0;
  let repaired = 0;

  // Check max 5 users per run
  for (const userKey of userKeys.slice(0, 5)) {
    const userId = userKey.name.replace('_users/', '');
    const keyPrefix = getKeyPrefix(userId);
    const commentIndexKey = `${keyPrefix}_comment-index`;

    const commentIndex = await env.TRIPS.get(commentIndexKey, 'json') as string[] | null;
    if (!commentIndex || commentIndex.length === 0) {
      usersChecked++;
      continue;
    }

    // Verify each trip in comment index has active comments
    const tripIndex = await env.TRIPS.get(`${keyPrefix}_trip-index`, 'json') as string[] | null;
    if (!tripIndex) {
      usersChecked++;
      continue;
    }

    // Check first 3 trips in comment index
    let needsRepair = false;
    for (const tripId of commentIndex.slice(0, 3)) {
      const trip = await env.TRIPS.get(`${keyPrefix}${tripId}`, 'json') as any;
      if (!trip) {
        needsRepair = true;
        break;
      }

      const hasActiveComments = trip.comments?.items?.some((c: any) => !c.dismissed);
      if (!hasActiveComments) {
        needsRepair = true;
        break;
      }
    }

    if (needsRepair) {
      // Rebuild comment index from scratch
      const validTripsWithComments: string[] = [];
      for (const tripId of tripIndex) {
        const trip = await env.TRIPS.get(`${keyPrefix}${tripId}`, 'json') as any;
        if (trip?.comments?.items?.some((c: any) => !c.dismissed)) {
          validTripsWithComments.push(tripId);
        }
      }
      await env.TRIPS.put(commentIndexKey, JSON.stringify(validTripsWithComments));
      repaired++;
    }

    usersChecked++;
  }

  return { usersChecked, repaired };
}

// ============================================
// GLOBAL INDEX UPDATES (for admin dashboard)
// ============================================

interface GlobalStats {
  totalUsers: number;
  totalTrips: number;
  activeUsers7d: number;
  tripsThisMonth: number;
  lastUpdated: string;
}

/**
 * Update global stats index for fast admin dashboard loading
 */
async function updateGlobalStats(env: Env): Promise<GlobalStats> {
  const userKeys = await listAllKeys(env, { prefix: '_users/' });
  const totalUsers = userKeys.length;

  // Count trips across all users (sample-based for speed)
  let totalTrips = 0;
  let activeUsers7d = 0;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const userKey of userKeys) {
    const userId = userKey.name.replace('_users/', '');
    const keyPrefix = getKeyPrefix(userId);

    const tripIndex = await env.TRIPS.get(`${keyPrefix}_trip-index`, 'json') as string[] | null;
    totalTrips += tripIndex?.length || 0;

    // Check if user was active recently
    const user = await env.TRIPS.get(userKey.name, 'json') as any;
    if (user?.lastActive && new Date(user.lastActive) > sevenDaysAgo) {
      activeUsers7d++;
    }
  }

  const stats: GlobalStats = {
    totalUsers,
    totalTrips,
    activeUsers7d,
    tripsThisMonth: 0, // Would need activity log aggregation
    lastUpdated: new Date().toISOString()
  };

  await env.TRIPS.put('_indexes/global_stats', JSON.stringify(stats));

  return stats;
}

// ============================================
// MAIN RUNNER
// ============================================

export interface MaintenanceResult {
  timestamp: string;
  duration: number;
  tasks: {
    telemetryArchive: { archived: number };
    quotaCleanup: { deleted: number };
    logCleanup: { deleted: number };
    activityCleanup: { deleted: number };
    tripIndexValidation: { usersChecked: number; repaired: number; orphanedTrips: number };
    commentIndexValidation: { usersChecked: number; repaired: number };
    globalStats: GlobalStats;
    // Global indexes for admin dashboard
    tripSummariesIndex: { processed: number; total: number; complete: boolean };
    userActivityIndex: { activeCount: number; totalUsers: number };
    commentsIndex: { tripsWithComments: number };
    // Dashboard cache (P0 performance index)
    dashboardCache: { rebuilt: boolean; duration: number; tripCount: number; userCount: number } | null;
  };
}

/**
 * Main maintenance runner
 */
export async function runMaintenance(env: Env): Promise<MaintenanceResult> {
  const startTime = Date.now();

  // Run cleanup tasks in parallel
  const [telemetryArchive, quotaCleanup, logCleanup, activityCleanup] = await Promise.all([
    archiveSupportTelemetry(env),
    cleanupExpiredQuotas(env),
    cleanupOldLogs(env),
    cleanupOldActivityLogs(env)
  ]);

  // Run index validations (these are more expensive, run sequentially)
  const tripIndexValidation = await validateTripIndexes(env);
  const commentIndexValidation = await validateCommentIndexes(env);

  // Update global stats (runs every time, fast enough)
  const globalStats = await updateGlobalStats(env);

  // Update global indexes for admin dashboard (cursor-based, incremental)
  const [tripSummariesIndex, userActivityIndex, commentsIndex] = await Promise.all([
    updateTripSummariesIndex(env, 10), // Process 10 users per run
    updateUserActivityIndex(env, 7),   // Users active in last 7 days
    updateCommentsIndex(env)           // All trips with active comments
  ]);

  // Rebuild dashboard cache if needed (P0 performance index)
  // Rebuild if: stale flag set, cache doesn't exist, or cache is older than 15 minutes
  let dashboardCacheResult: { rebuilt: boolean; duration: number; tripCount: number; userCount: number } | null = null;
  const existingCache = await getDashboardCache(env);
  const cacheIsStale = await isDashboardCacheStale(env);

  let shouldRebuild = cacheIsStale;
  if (!existingCache) {
    shouldRebuild = true; // No cache exists
  } else {
    const cacheAge = Date.now() - new Date(existingCache.updatedAt).getTime();
    if (cacheAge > 15 * 60 * 1000) {
      shouldRebuild = true; // Cache is older than 15 minutes
    }
  }

  if (shouldRebuild) {
    const cacheResult = await buildDashboardCache(env);
    dashboardCacheResult = {
      rebuilt: true,
      duration: cacheResult.duration,
      tripCount: cacheResult.tripCount,
      userCount: cacheResult.userCount
    };
  }

  const result: MaintenanceResult = {
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    tasks: {
      telemetryArchive,
      quotaCleanup,
      logCleanup,
      activityCleanup,
      tripIndexValidation,
      commentIndexValidation,
      globalStats,
      tripSummariesIndex,
      userActivityIndex,
      commentsIndex,
      dashboardCache: dashboardCacheResult
    }
  };

  // Store last maintenance run for monitoring
  await env.TRIPS.put('_maintenance/last_run', JSON.stringify(result));

  // Also save to history log (keep last 7 days worth, ~672 runs)
  const logKey = `_maintenance/log/${result.timestamp.replace(/[:.]/g, '-')}`;
  await env.TRIPS.put(logKey, JSON.stringify(result), {
    expirationTtl: 7 * 24 * 60 * 60 // 7 days TTL
  });

  return result;
}
