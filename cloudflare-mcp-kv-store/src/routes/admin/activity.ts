/**
 * Admin Routes: Activity tracking
 * Handles: GET /admin/activity
 */

import type { Env, UserProfile, RouteHandler } from '../../types';
import { listAllKeys, getKeyPrefix } from '../../lib/kv';
import { getValidAuthKeys } from '../../lib/auth';

export const handleGetActivity: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/activity" || request.method !== "GET") return null;

  // Collect all activity from all sources
  const allActivities: any[] = [];
  const userMap: Record<string, { name: string; agency: string }> = {};

  // 1. Get KV-stored users
  const userKeys = await listAllKeys(env, { prefix: "_users/" });
  for (const key of userKeys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (!user) continue;
    userMap[user.userId] = { name: user.name, agency: user.agency.name };

    const activityLog = await env.TRIPS.get(user.userId + "/_activity-log", "json") as any;
    if (activityLog?.recentChanges) {
      for (const entry of activityLog.recentChanges) {
        allActivities.push({
          ...entry,
          userId: user.userId,
          userName: user.name,
          agency: user.agency.name
        });
      }
    }
  }

  // 2. Get legacy users from AUTH_KEYS (KV or env var fallback)
  const legacyKeys = await getValidAuthKeys(env);
  for (const authKey of legacyKeys) {
    const userId = getKeyPrefix(authKey).slice(0, -1);
    // Skip if already processed as KV user
    if (userMap[userId]) continue;

    userMap[userId] = { name: authKey, agency: 'Legacy' };
    const activityLog = await env.TRIPS.get(userId + "/_activity-log", "json") as any;
    if (activityLog?.recentChanges) {
      for (const entry of activityLog.recentChanges) {
        allActivities.push({
          ...entry,
          userId: userId,
          userName: authKey,
          agency: 'Legacy User'
        });
      }
    }
  }

  // Sort by timestamp descending (newest first)
  allActivities.sort((a, b) => {
    const dateA = new Date(a.timestamp || 0).getTime();
    const dateB = new Date(b.timestamp || 0).getTime();
    return dateB - dateA;
  });

  // Get unique values for filters
  const users = Object.entries(userMap).map(([id, info]) => ({ userId: id, ...info }));
  const trips = [...new Set(allActivities.map(a => a.tripId).filter(Boolean))];

  return new Response(JSON.stringify({
    activities: allActivities,
    filters: { users, trips },
    total: allActivities.length
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
