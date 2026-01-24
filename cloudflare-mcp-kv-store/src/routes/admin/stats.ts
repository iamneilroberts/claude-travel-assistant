/**
 * Admin Routes: Dashboard statistics
 * Handles: GET /admin/stats, GET /admin/billing-stats, GET /admin/cache-status, POST /admin/cache-refresh
 */

import type { Env, UserProfile, RouteHandler } from '../../types';
import { listAllKeys } from '../../lib/kv';
import {
  getDashboardCache,
  getDashboardCacheStatus,
  buildDashboardCache,
  markDashboardCacheStale
} from '../../lib/indexes';

export const handleGetStats: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/stats" || request.method !== "GET") return null;

  // Try to use dashboard cache first (fast path - 1 KV read)
  const cache = await getDashboardCache(env);

  if (cache) {
    const cacheStatus = await getDashboardCacheStatus(env);
    return new Response(JSON.stringify({
      totalUsers: cache.stats.totalUsers,
      totalTrips: cache.stats.totalTrips,
      totalComments: cache.stats.totalComments,
      unreadComments: cache.stats.unreadComments,
      activeUsers7d: cache.stats.activeUsers7d,
      tripsThisMonth: cache.stats.tripsThisMonth,
      userStats: cache.userSummaries.map(u => ({
        userId: u.userId,
        name: u.name,
        trips: u.tripCount,
        comments: u.commentCount
      })),
      // Cache metadata for staleness UI
      _cache: {
        updatedAt: cache.updatedAt,
        isStale: cacheStatus.isStale,
        staleness: cacheStatus.staleness,
        ageMinutes: cacheStatus.ageMinutes
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Fallback to full scan (slow path) if no cache exists
  const userKeys = await listAllKeys(env, { prefix: "_users/" });
  const allTrips = await listAllKeys(env);

  let totalTrips = 0;
  let totalComments = 0;
  const userStats: any[] = [];

  for (const key of userKeys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (!user) continue;

    const prefix = user.userId + '/';
    const userTrips = allTrips.filter(k =>
      k.name.startsWith(prefix) &&
      !k.name.includes('/_') &&
      !k.name.endsWith('_activity-log')
    );

    // Count comments
    let userComments = 0;
    for (const tripKey of userTrips) {
      const commentsData = await env.TRIPS.get(tripKey.name + '/_comments', 'json') as any;
      if (commentsData?.comments) {
        userComments += commentsData.comments.length;
      }
    }

    totalTrips += userTrips.length;
    totalComments += userComments;

    userStats.push({
      userId: user.userId,
      name: user.name,
      trips: userTrips.length,
      comments: userComments
    });
  }

  return new Response(JSON.stringify({
    totalUsers: userKeys.length,
    totalTrips,
    totalComments,
    userStats,
    _cache: null // No cache available
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

/**
 * GET /admin/cache-status - Get dashboard cache status
 */
export const handleGetCacheStatus: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/cache-status" || request.method !== "GET") return null;

  const status = await getDashboardCacheStatus(env);

  return new Response(JSON.stringify(status), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

/**
 * POST /admin/cache-refresh - Force rebuild of dashboard cache
 */
export const handleRefreshCache: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/cache-refresh" || request.method !== "POST") return null;

  const result = await buildDashboardCache(env);

  return new Response(JSON.stringify({
    success: true,
    updatedAt: result.cache.updatedAt,
    duration: result.duration,
    tripCount: result.tripCount,
    userCount: result.userCount
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleGetBillingStats: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/billing-stats" || request.method !== "GET") return null;

  const userKeys = await listAllKeys(env, { prefix: "_users/" });
  let activeSubs = 0;
  let trialingSubs = 0;
  let pastDueSubs = 0;
  let mrr = 0;

  const tierPrices: Record<string, number> = {
    starter: 29,
    professional: 79,
    agency: 199
  };

  for (const key of userKeys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (user?.subscription) {
      const sub = user.subscription;
      if (sub.status === 'active') {
        activeSubs++;
        mrr += tierPrices[sub.tier] || 0;
      } else if (sub.status === 'trialing') {
        trialingSubs++;
      } else if (sub.status === 'past_due') {
        pastDueSubs++;
      }
    }
  }

  return new Response(JSON.stringify({
    activeSubs,
    trialingSubs,
    pastDueSubs,
    mrr
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
