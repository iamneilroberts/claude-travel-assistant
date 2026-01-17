/**
 * Admin Routes: Trip management
 * Handles: GET /admin/trips, GET /admin/trips/:userId/:tripId, POST /admin/trip-summaries/rebuild
 */

import type { Env, UserProfile, RouteHandler } from '../../types';
import { listAllKeys, getKeyPrefix, getTripIndex } from '../../lib/kv';
import { getValidAuthKeys } from '../../lib/auth';
import { computeTripSummary } from '../../lib/trip-summary';

// Helper to get trip summary key
function getTripSummaryKey(keyPrefix: string, tripId: string): string {
  return `${keyPrefix}_summaries/${tripId}`;
}

export const handleListTrips: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/trips" || request.method !== "GET") return null;

  const allTrips: any[] = [];

  // Build user map for both KV and legacy users
  const userMap: Record<string, { name: string; agency: string; authKey: string }> = {};

  // KV users
  const userKeys = await listAllKeys(env, { prefix: "_users/" });
  for (const key of userKeys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (user) {
      userMap[user.userId] = { name: user.name, agency: user.agency.name, authKey: user.authKey };
    }
  }

  // Legacy users (from KV or env var fallback)
  const legacyKeys = await getValidAuthKeys(env);
  for (const authKey of legacyKeys) {
    const userId = getKeyPrefix(authKey).slice(0, -1);
    if (!userMap[userId]) {
      userMap[userId] = { name: authKey, agency: 'Legacy', authKey };
    }
  }

  // Get all trips for each user
  for (const [userId, userInfo] of Object.entries(userMap)) {
    const prefix = userId + '/';
    const tripKeys = await listAllKeys(env, { prefix });

    for (const key of tripKeys) {
      // Skip system keys
      if (key.name.includes('/_') || key.name.endsWith('_activity-log')) continue;

      const tripId = key.name.replace(prefix, '');
      const tripData = await env.TRIPS.get(key.name, "json") as any;
      if (!tripData) continue;

      // Get comments for this trip
      const commentsData = await env.TRIPS.get(key.name + '/_comments', "json") as any;
      const comments = commentsData?.comments || [];
      const unreadComments = comments.filter((c: any) => !c.read).length;

      // Check if published (look in trips.json on GitHub or use meta)
      const publishedUrl = tripData.meta?.publishedUrl || null;

      allTrips.push({
        tripId,
        userId,
        userName: userInfo.name,
        agency: userInfo.agency,
        fullKey: key.name,
        meta: {
          clientName: tripData.meta?.clientName || tripId,
          destination: tripData.meta?.destination || '',
          dates: tripData.meta?.dates || tripData.dates?.start || '',
          phase: tripData.meta?.phase || 'unknown',
          status: tripData.meta?.status || '',
          lastUpdated: tripData.meta?.lastUpdated || ''
        },
        travelers: tripData.travelers?.count || 0,
        commentCount: comments.length,
        unreadComments,
        publishedUrl,
        hasItinerary: !!(tripData.itinerary && tripData.itinerary.length > 0),
        hasLodging: !!(tripData.lodging && tripData.lodging.length > 0),
        hasTiers: !!(tripData.tiers)
      });
    }
  }

  // Sort by lastUpdated descending
  allTrips.sort((a, b) => {
    const dateA = new Date(a.meta.lastUpdated || 0).getTime();
    const dateB = new Date(b.meta.lastUpdated || 0).getTime();
    return dateB - dateA;
  });

  return new Response(JSON.stringify({ trips: allTrips, total: allTrips.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleRebuildSummaries: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/trip-summaries/rebuild" || request.method !== "POST") return null;

  const body = await request.json().catch(() => ({})) as {
    userId?: string;
    tripId?: string;
    limit?: number;
  };

  const targetUserId = typeof body.userId === 'string' ? body.userId : null;
  const targetTripId = typeof body.tripId === 'string' ? body.tripId : null;
  const limit = typeof body.limit === 'number' && Number.isFinite(body.limit) && body.limit > 0
    ? Math.floor(body.limit)
    : null;

  if (targetTripId && !targetUserId) {
    return new Response(JSON.stringify({ error: "tripId requires userId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const userIds: string[] = [];
  if (targetUserId) {
    userIds.push(targetUserId);
  } else {
    const userKeys = await listAllKeys(env, { prefix: "_users/" });
    for (const key of userKeys) {
      const user = await env.TRIPS.get(key.name, "json") as UserProfile;
      if (user?.userId) userIds.push(user.userId);
    }

    const legacyKeys = await getValidAuthKeys(env);
    for (const authKey of legacyKeys) {
      const userId = getKeyPrefix(authKey).slice(0, -1);
      if (!userIds.includes(userId)) userIds.push(userId);
    }
  }

  let rebuilt = 0;
  let missing = 0;
  let tripsProcessed = 0;
  let limitReached = false;
  const results: Array<{ userId: string; tripsProcessed: number; rebuilt: number; missing: number }> = [];

  for (const userId of userIds) {
    const keyPrefix = `${userId}/`;
    const tripIds = targetTripId ? [targetTripId] : await getTripIndex(env, keyPrefix);
    let userProcessed = 0;
    let userRebuilt = 0;
    let userMissing = 0;

    for (const tripId of tripIds) {
      if (limit !== null && tripsProcessed >= limit) {
        limitReached = true;
        break;
      }

      const tripData = await env.TRIPS.get(`${keyPrefix}${tripId}`, "json");
      tripsProcessed += 1;
      userProcessed += 1;

      if (!tripData) {
        missing += 1;
        userMissing += 1;
        continue;
      }

      const summary = await computeTripSummary(tripId, tripData);
      await env.TRIPS.put(getTripSummaryKey(keyPrefix, tripId), JSON.stringify(summary));
      rebuilt += 1;
      userRebuilt += 1;
    }

    results.push({
      userId,
      tripsProcessed: userProcessed,
      rebuilt: userRebuilt,
      missing: userMissing
    });

    if (limitReached) break;
  }

  return new Response(JSON.stringify({
    userCount: userIds.length,
    tripsProcessed,
    rebuilt,
    missing,
    limit: limit ?? null,
    limitReached,
    results
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleGetTrip: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (!url.pathname.match(/^\/admin\/trips\/[^/]+\/[^/]+$/) || request.method !== "GET") return null;

  const parts = url.pathname.split('/');
  const tripId = parts.pop();
  const userId = parts.pop();
  const fullKey = `${userId}/${tripId}`;

  const tripData = await env.TRIPS.get(fullKey, "json");
  if (!tripData) {
    return new Response(JSON.stringify({ error: "Trip not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Get comments
  const commentsData = await env.TRIPS.get(fullKey + '/_comments', "json") as any;

  // Get activity for this trip
  const activityLog = await env.TRIPS.get(userId + '/_activity-log', "json") as any;
  const tripActivity = activityLog?.recentChanges?.filter((a: any) => a.tripId === tripId) || [];

  // Get user info
  let userInfo = null;
  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;
  if (user) {
    userInfo = { name: user.name, email: user.email, agency: user.agency.name, authKey: user.authKey };
  }

  return new Response(JSON.stringify({
    tripId,
    userId,
    fullKey,
    user: userInfo,
    data: tripData,
    comments: commentsData?.comments || [],
    activity: tripActivity
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
