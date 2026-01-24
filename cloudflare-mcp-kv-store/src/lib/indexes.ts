/**
 * Global Indexes for Performance
 *
 * These indexes are maintained by cron jobs and provide O(1) lookups
 * for admin dashboard queries that would otherwise require full KV scans.
 */

import type { Env } from '../types';
import { listAllKeys, getKeyPrefix } from './kv';

// ============================================
// TYPES
// ============================================

export interface TripSummary {
  tripId: string;
  userId: string;
  userName: string;
  destination: string;
  clientName: string;
  phase: string;
  status: string;
  lastModified: string;
  hasComments: boolean;
  isPublished: boolean;
}

// ============================================
// DASHBOARD CACHE (P0 - Biggest Performance Win)
// ============================================

export interface DashboardTripSummary {
  tripId: string;
  userId: string;
  userName: string;
  agency: string;
  destination: string;
  clientName: string;
  dates: string;
  phase: string;
  status: string;
  // Date fields
  created: string;           // When trip was first created
  lastUpdated: string;       // When trip was last modified (last worked)
  lastPublished: string | null; // When trip was last published or previewed
  // Other fields
  travelerCount: number;
  commentCount: number;
  unreadComments: number;
  publishedUrl: string | null;
  hasItinerary: boolean;
  hasLodging: boolean;
  hasTiers: boolean;
  totalCost: number;
  operationCount: number;
  isTest: boolean;
  isArchived: boolean;
}

export interface DashboardUserSummary {
  userId: string;
  name: string;
  agency: string;
  tripCount: number;
  commentCount: number;
}

export interface DashboardCache {
  version: number;  // Schema version for cache invalidation
  updatedAt: string;
  isStale: boolean;
  stats: {
    totalUsers: number;
    totalTrips: number;
    totalComments: number;
    unreadComments: number;
    activeUsers7d: number;
    tripsThisMonth: number;
  };
  tripSummaries: DashboardTripSummary[];
  userSummaries: DashboardUserSummary[];
}

const DASHBOARD_CACHE_KEY = '_admin/dashboard_cache';
const DASHBOARD_CACHE_STALE_KEY = '_admin/dashboard_cache_stale';
const DASHBOARD_CACHE_VERSION = 1;
const MAX_TRIPS_IN_CACHE = 500;

export interface TripSummariesIndex {
  trips: TripSummary[];
  lastUpdated: string;
  totalCount: number;
}

export interface UserActivityEntry {
  userId: string;
  userName: string;
  lastActive: string;
  tripCount: number;
  recentActions: string[];
}

export interface UserActivityIndex {
  activeUsers: UserActivityEntry[];
  lastUpdated: string;
  periodDays: number;
}

export interface IndexCursor {
  indexType: string;
  lastProcessedUser: string;
  totalProcessed: number;
  startedAt: string;
  completedAt?: string;
  errors: string[];
}

// ============================================
// TRIP SUMMARIES INDEX
// ============================================

/**
 * Build trip summaries index incrementally using cursor
 * Processes a batch of users per run to avoid timeouts
 */
export async function updateTripSummariesIndex(
  env: Env,
  batchSize: number = 10
): Promise<{ processed: number; total: number; complete: boolean }> {
  // Load or create cursor
  const cursorKey = '_indexes/cursor/trip_summaries';
  let cursor = await env.TRIPS.get(cursorKey, 'json') as IndexCursor | null;

  if (!cursor || cursor.completedAt) {
    // Start fresh
    cursor = {
      indexType: 'trip_summaries',
      lastProcessedUser: '',
      totalProcessed: 0,
      startedAt: new Date().toISOString(),
      errors: []
    };
  }

  // Get all users
  const userKeys = await listAllKeys(env, { prefix: '_users/' });
  const userIds = userKeys.map(k => k.name.replace('_users/', '')).sort();

  // Find where to resume
  const startIdx = cursor.lastProcessedUser
    ? userIds.findIndex(id => id > cursor.lastProcessedUser)
    : 0;

  if (startIdx === -1 || startIdx >= userIds.length) {
    // All done - finalize index
    cursor.completedAt = new Date().toISOString();
    await env.TRIPS.put(cursorKey, JSON.stringify(cursor));
    return { processed: 0, total: userIds.length, complete: true };
  }

  // Load existing partial index
  const existingIndex = await env.TRIPS.get('_indexes/trip_summaries', 'json') as TripSummariesIndex | null;
  const trips: TripSummary[] = existingIndex?.trips || [];

  // Process batch
  const batch = userIds.slice(startIdx, startIdx + batchSize);
  let processed = 0;

  for (const userId of batch) {
    try {
      const keyPrefix = getKeyPrefix(userId);
      const user = await env.TRIPS.get(`_users/${userId}`, 'json') as any;
      const tripIndex = await env.TRIPS.get(`${keyPrefix}_trip-index`, 'json') as string[] | null;
      const commentIndex = await env.TRIPS.get(`${keyPrefix}_comment-index`, 'json') as string[] | null;
      const commentSet = new Set(commentIndex || []);

      if (tripIndex) {
        // Remove old entries for this user
        const filtered = trips.filter(t => t.userId !== userId);

        // Add updated entries (sample first 20 trips per user for index)
        for (const tripId of tripIndex.slice(0, 20)) {
          const trip = await env.TRIPS.get(`${keyPrefix}${tripId}`, 'json') as any;
          if (trip) {
            filtered.push({
              tripId,
              userId,
              userName: user?.name || userId,
              destination: trip.meta?.destination || 'Unknown',
              clientName: trip.meta?.clientName || tripId,
              phase: trip.meta?.phase || 'unknown',
              status: trip.meta?.status || '',
              lastModified: trip.meta?.lastModified || '',
              hasComments: commentSet.has(tripId),
              isPublished: !!trip.meta?.publishedUrl
            });
          }
        }

        trips.length = 0;
        trips.push(...filtered);
      }

      cursor.lastProcessedUser = userId;
      cursor.totalProcessed++;
      processed++;
    } catch (e: any) {
      cursor.errors.push(`${userId}: ${e.message}`);
    }
  }

  // Sort by lastModified descending
  trips.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''));

  // Save index and cursor
  const index: TripSummariesIndex = {
    trips: trips.slice(0, 500), // Cap at 500 most recent
    lastUpdated: new Date().toISOString(),
    totalCount: trips.length
  };

  await env.TRIPS.put('_indexes/trip_summaries', JSON.stringify(index));
  await env.TRIPS.put(cursorKey, JSON.stringify(cursor));

  const complete = startIdx + batchSize >= userIds.length;
  if (complete) {
    cursor.completedAt = new Date().toISOString();
    await env.TRIPS.put(cursorKey, JSON.stringify(cursor));
  }

  return { processed, total: userIds.length, complete };
}

/**
 * Get trip summaries from index (fast)
 */
export async function getTripSummaries(env: Env): Promise<TripSummariesIndex | null> {
  return await env.TRIPS.get('_indexes/trip_summaries', 'json') as TripSummariesIndex | null;
}

// ============================================
// USER ACTIVITY INDEX
// ============================================

/**
 * Update user activity index (users active in last N days)
 */
export async function updateUserActivityIndex(
  env: Env,
  periodDays: number = 7
): Promise<{ activeCount: number; totalUsers: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);
  const cutoffStr = cutoffDate.toISOString();

  const userKeys = await listAllKeys(env, { prefix: '_users/' });
  const activeUsers: UserActivityEntry[] = [];

  for (const userKey of userKeys) {
    const userId = userKey.name.replace('_users/', '');
    const user = await env.TRIPS.get(userKey.name, 'json') as any;

    if (!user) continue;

    const lastActive = user.lastActive || user.created || '';

    if (lastActive >= cutoffStr) {
      const keyPrefix = getKeyPrefix(userId);
      const tripIndex = await env.TRIPS.get(`${keyPrefix}_trip-index`, 'json') as string[] | null;

      activeUsers.push({
        userId,
        userName: user.name || userId,
        lastActive,
        tripCount: tripIndex?.length || 0,
        recentActions: user.recentActions?.slice(0, 5) || []
      });
    }
  }

  // Sort by lastActive descending
  activeUsers.sort((a, b) => b.lastActive.localeCompare(a.lastActive));

  const index: UserActivityIndex = {
    activeUsers: activeUsers.slice(0, 100), // Cap at 100 most active
    lastUpdated: new Date().toISOString(),
    periodDays
  };

  await env.TRIPS.put('_indexes/user_activity', JSON.stringify(index));

  return { activeCount: activeUsers.length, totalUsers: userKeys.length };
}

/**
 * Get user activity from index (fast)
 */
export async function getUserActivity(env: Env): Promise<UserActivityIndex | null> {
  return await env.TRIPS.get('_indexes/user_activity', 'json') as UserActivityIndex | null;
}

// ============================================
// ALL COMMENTS INDEX (for admin)
// ============================================

export interface CommentEntry {
  tripId: string;
  userId: string;
  userName: string;
  tripName: string;
  commentCount: number;
  latestComment: string;
  latestCommentAt: string;
}

export interface CommentsIndex {
  comments: CommentEntry[];
  lastUpdated: string;
  totalCount: number;
}

/**
 * Build comments index for admin dashboard
 */
export async function updateCommentsIndex(env: Env): Promise<{ tripsWithComments: number }> {
  const userKeys = await listAllKeys(env, { prefix: '_users/' });
  const comments: CommentEntry[] = [];

  for (const userKey of userKeys) {
    const userId = userKey.name.replace('_users/', '');
    const user = await env.TRIPS.get(userKey.name, 'json') as any;
    const keyPrefix = getKeyPrefix(userId);

    const commentIndex = await env.TRIPS.get(`${keyPrefix}_comment-index`, 'json') as string[] | null;
    if (!commentIndex || commentIndex.length === 0) continue;

    for (const tripId of commentIndex) {
      const trip = await env.TRIPS.get(`${keyPrefix}${tripId}`, 'json') as any;
      if (!trip?.comments?.items) continue;

      const activeComments = trip.comments.items.filter((c: any) => !c.dismissed);
      if (activeComments.length === 0) continue;

      const latest = activeComments.sort((a: any, b: any) =>
        (b.timestamp || '').localeCompare(a.timestamp || '')
      )[0];

      comments.push({
        tripId,
        userId,
        userName: user?.name || userId,
        tripName: trip.meta?.clientName || tripId,
        commentCount: activeComments.length,
        latestComment: latest.text?.slice(0, 100) || '',
        latestCommentAt: latest.timestamp || ''
      });
    }
  }

  // Sort by latest comment
  comments.sort((a, b) => b.latestCommentAt.localeCompare(a.latestCommentAt));

  const index: CommentsIndex = {
    comments: comments.slice(0, 200),
    lastUpdated: new Date().toISOString(),
    totalCount: comments.length
  };

  await env.TRIPS.put('_indexes/comments', JSON.stringify(index));

  return { tripsWithComments: comments.length };
}

/**
 * Get comments from index (fast)
 */
export async function getCommentsIndex(env: Env): Promise<CommentsIndex | null> {
  return await env.TRIPS.get('_indexes/comments', 'json') as CommentsIndex | null;
}

// ============================================
// INDEX CURSORS MANAGEMENT
// ============================================

/**
 * Get cursor status for an index
 */
export async function getIndexCursor(env: Env, indexType: string): Promise<IndexCursor | null> {
  return await env.TRIPS.get(`_indexes/cursor/${indexType}`, 'json') as IndexCursor | null;
}

/**
 * Reset a cursor to start fresh
 */
export async function resetIndexCursor(env: Env, indexType: string): Promise<void> {
  await env.TRIPS.delete(`_indexes/cursor/${indexType}`);
}

/**
 * Get all index statuses
 */
export async function getAllIndexStatuses(env: Env): Promise<{
  tripSummaries: { exists: boolean; count: number; lastUpdated: string | null; cursor: IndexCursor | null };
  userActivity: { exists: boolean; count: number; lastUpdated: string | null };
  comments: { exists: boolean; count: number; lastUpdated: string | null };
}> {
  const [tripSummaries, userActivity, comments, tripCursor] = await Promise.all([
    env.TRIPS.get('_indexes/trip_summaries', 'json') as Promise<TripSummariesIndex | null>,
    env.TRIPS.get('_indexes/user_activity', 'json') as Promise<UserActivityIndex | null>,
    env.TRIPS.get('_indexes/comments', 'json') as Promise<CommentsIndex | null>,
    env.TRIPS.get('_indexes/cursor/trip_summaries', 'json') as Promise<IndexCursor | null>
  ]);

  return {
    tripSummaries: {
      exists: !!tripSummaries,
      count: tripSummaries?.totalCount || 0,
      lastUpdated: tripSummaries?.lastUpdated || null,
      cursor: tripCursor
    },
    userActivity: {
      exists: !!userActivity,
      count: userActivity?.activeUsers?.length || 0,
      lastUpdated: userActivity?.lastUpdated || null
    },
    comments: {
      exists: !!comments,
      count: comments?.totalCount || 0,
      lastUpdated: comments?.lastUpdated || null
    }
  };
}

// ============================================
// DASHBOARD CACHE (P0 - Main Performance Index)
// ============================================

/**
 * Get dashboard cache (fast - single KV read)
 */
export async function getDashboardCache(env: Env): Promise<DashboardCache | null> {
  return await env.TRIPS.get(DASHBOARD_CACHE_KEY, 'json') as DashboardCache | null;
}

/**
 * Check if dashboard cache is marked stale
 */
export async function isDashboardCacheStale(env: Env): Promise<boolean> {
  const staleFlag = await env.TRIPS.get(DASHBOARD_CACHE_STALE_KEY, 'text');
  return staleFlag === 'true';
}

/**
 * Mark dashboard cache as stale (call after trip/comment mutations)
 */
export async function markDashboardCacheStale(env: Env): Promise<void> {
  await env.TRIPS.put(DASHBOARD_CACHE_STALE_KEY, 'true');
}

/**
 * Clear stale flag after rebuild
 */
export async function clearDashboardCacheStale(env: Env): Promise<void> {
  await env.TRIPS.delete(DASHBOARD_CACHE_STALE_KEY);
}

/**
 * Build the complete dashboard cache
 * This is the expensive operation that replaces 4000+ KV ops with 1 KV read
 */
export async function buildDashboardCache(env: Env): Promise<{
  cache: DashboardCache;
  duration: number;
  tripCount: number;
  userCount: number;
}> {
  const startTime = Date.now();

  // Get all users
  const userKeys = await listAllKeys(env, { prefix: '_users/' });
  const userMap: Map<string, { name: string; agency: string; tripCount: number; commentCount: number }> = new Map();

  // Build user map and collect trip summaries
  const tripSummaries: DashboardTripSummary[] = [];
  let totalComments = 0;
  let totalUnread = 0;

  // Also check for legacy auth keys
  const legacyKeysData = await env.TRIPS.get('_config/auth_keys', 'json') as string[] | null;
  const legacyUserIds = new Set<string>();

  if (legacyKeysData) {
    for (const authKey of legacyKeysData) {
      const userId = getKeyPrefix(authKey).slice(0, -1);
      if (!userMap.has(userId)) {
        legacyUserIds.add(userId);
        userMap.set(userId, { name: authKey, agency: 'Legacy', tripCount: 0, commentCount: 0 });
      }
    }
  }

  // Process KV users
  for (const userKey of userKeys) {
    const userId = userKey.name.replace('_users/', '');
    const user = await env.TRIPS.get(userKey.name, 'json') as any;
    if (user) {
      userMap.set(userId, {
        name: user.name || userId,
        agency: user.agency?.name || 'Unknown',
        tripCount: 0,
        commentCount: 0
      });
    }
  }

  // Calculate 7-day active users and this month's trips
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  let activeUsers7d = 0;
  let tripsThisMonth = 0;

  // Process trips for each user
  for (const [userId, userInfo] of userMap) {
    const prefix = userId + '/';
    const tripKeys = await listAllKeys(env, { prefix });

    let userTripCount = 0;
    let userCommentCount = 0;

    for (const tripKey of tripKeys) {
      // Skip system keys
      if (tripKey.name.includes('/_') || tripKey.name.endsWith('_activity-log')) continue;

      const tripId = tripKey.name.replace(prefix, '');
      const tripData = await env.TRIPS.get(tripKey.name, 'json') as any;
      if (!tripData) continue;

      userTripCount++;

      // Get comments
      const commentsData = await env.TRIPS.get(tripKey.name + '/_comments', 'json') as any;
      const comments = commentsData?.comments || [];
      const unreadCount = comments.filter((c: any) => !c.read).length;
      totalComments += comments.length;
      totalUnread += unreadCount;
      userCommentCount += comments.length;

      // Get cost data
      const costData = await env.TRIPS.get(tripKey.name + '/_costs', 'json') as any;

      // Check if this month's trip
      const lastUpdated = tripData.meta?.lastUpdated || '';
      if (lastUpdated && new Date(lastUpdated) >= thisMonthStart) {
        tripsThisMonth++;
      }

      // Add to summaries (cap at MAX_TRIPS_IN_CACHE)
      if (tripSummaries.length < MAX_TRIPS_IN_CACHE) {
        tripSummaries.push({
          tripId,
          userId,
          userName: userInfo.name,
          agency: userInfo.agency,
          destination: tripData.meta?.destination || '',
          clientName: tripData.meta?.clientName || tripId,
          dates: tripData.meta?.dates || tripData.dates?.start || '',
          phase: tripData.meta?.phase || 'unknown',
          status: tripData.meta?.status || '',
          // Date fields
          created: tripData.meta?.created || tripData.meta?.lastUpdated || '',
          lastUpdated: lastUpdated,
          lastPublished: tripData.meta?.lastPublished || tripData.meta?.publishedAt || null,
          // Other fields
          travelerCount: tripData.travelers?.count || 0,
          commentCount: comments.length,
          unreadComments: unreadCount,
          publishedUrl: tripData.meta?.publishedUrl || null,
          hasItinerary: !!(tripData.itinerary && tripData.itinerary.length > 0),
          hasLodging: !!(tripData.lodging && tripData.lodging.length > 0),
          hasTiers: !!tripData.tiers,
          totalCost: costData?.totalCost || 0,
          operationCount: costData?.operationCount || 0,
          isTest: tripData.meta?.isTest || false,
          isArchived: tripData.meta?.isArchived || false
        });
      }
    }

    // Update user counts
    userMap.set(userId, { ...userInfo, tripCount: userTripCount, commentCount: userCommentCount });

    // Check if user was active in last 7 days
    const user = await env.TRIPS.get(`_users/${userId}`, 'json') as any;
    if (user?.lastActive && new Date(user.lastActive) >= sevenDaysAgo) {
      activeUsers7d++;
    }
  }

  // Sort trips by lastUpdated descending
  tripSummaries.sort((a, b) => {
    const dateA = new Date(a.lastUpdated || 0).getTime();
    const dateB = new Date(b.lastUpdated || 0).getTime();
    return dateB - dateA;
  });

  // Build user summaries
  const userSummaries: DashboardUserSummary[] = Array.from(userMap.entries()).map(([userId, info]) => ({
    userId,
    name: info.name,
    agency: info.agency,
    tripCount: info.tripCount,
    commentCount: info.commentCount
  }));

  const cache: DashboardCache = {
    version: DASHBOARD_CACHE_VERSION,
    updatedAt: new Date().toISOString(),
    isStale: false,
    stats: {
      totalUsers: userMap.size,
      totalTrips: tripSummaries.length,
      totalComments,
      unreadComments: totalUnread,
      activeUsers7d,
      tripsThisMonth
    },
    tripSummaries,
    userSummaries
  };

  // Save cache and clear stale flag
  await Promise.all([
    env.TRIPS.put(DASHBOARD_CACHE_KEY, JSON.stringify(cache)),
    clearDashboardCacheStale(env)
  ]);

  return {
    cache,
    duration: Date.now() - startTime,
    tripCount: tripSummaries.length,
    userCount: userMap.size
  };
}

/**
 * Get dashboard cache status for the UI
 */
export async function getDashboardCacheStatus(env: Env): Promise<{
  exists: boolean;
  updatedAt: string | null;
  isStale: boolean;
  ageMinutes: number;
  staleness: 'fresh' | 'recent' | 'stale' | 'old';
  tripCount: number;
  userCount: number;
}> {
  const [cache, staleFlag] = await Promise.all([
    getDashboardCache(env),
    isDashboardCacheStale(env)
  ]);

  if (!cache) {
    return {
      exists: false,
      updatedAt: null,
      isStale: true,
      ageMinutes: Infinity,
      staleness: 'old',
      tripCount: 0,
      userCount: 0
    };
  }

  const ageMs = Date.now() - new Date(cache.updatedAt).getTime();
  const ageMinutes = Math.floor(ageMs / 60000);

  // Determine staleness tier
  let staleness: 'fresh' | 'recent' | 'stale' | 'old';
  if (ageMinutes < 1) {
    staleness = 'fresh';
  } else if (ageMinutes < 5) {
    staleness = 'recent';
  } else if (ageMinutes < 15) {
    staleness = 'stale';
  } else {
    staleness = 'old';
  }

  return {
    exists: true,
    updatedAt: cache.updatedAt,
    isStale: staleFlag || staleness === 'old',
    ageMinutes,
    staleness,
    tripCount: cache.tripSummaries.length,
    userCount: cache.userSummaries.length
  };
}
