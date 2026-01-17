/**
 * Admin Routes: Dashboard statistics
 * Handles: GET /admin/stats, GET /admin/billing-stats
 */

import type { Env, UserProfile, RouteHandler } from '../../types';
import { listAllKeys } from '../../lib/kv';

export const handleGetStats: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/stats" || request.method !== "GET") return null;

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
    userStats
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
