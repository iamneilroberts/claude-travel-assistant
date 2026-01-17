/**
 * Admin Routes: Comment listing
 * Handles: GET /admin/comments
 */

import type { Env, UserProfile, RouteHandler } from '../../types';
import { listAllKeys, getKeyPrefix } from '../../lib/kv';
import { getValidAuthKeys } from '../../lib/auth';

export const handleListComments: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/comments" || request.method !== "GET") return null;

  const allComments: any[] = [];

  // Build user map
  const userMap: Record<string, string> = {};
  const userKeys = await listAllKeys(env, { prefix: "_users/" });
  for (const key of userKeys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (user) userMap[user.userId] = user.name;
  }

  // Legacy users (from KV or env var fallback)
  const legacyKeys = await getValidAuthKeys(env);
  for (const authKey of legacyKeys) {
    const userId = getKeyPrefix(authKey).slice(0, -1);
    if (!userMap[userId]) userMap[userId] = authKey;
  }

  // Find all comment keys
  const allKeys = await listAllKeys(env);
  for (const key of allKeys) {
    if (key.name.endsWith('/_comments')) {
      const commentsData = await env.TRIPS.get(key.name, "json") as any;
      if (!commentsData?.comments?.length) continue;

      // Parse the key to get userId and tripId
      const keyPath = key.name.replace('/_comments', '');
      const parts = keyPath.split('/');
      const tripId = parts.pop() || '';
      const userId = parts.join('/');

      for (const comment of commentsData.comments) {
        allComments.push({
          ...comment,
          tripId,
          userId,
          userName: userMap[userId] || userId,
          tripKey: keyPath
        });
      }
    }
  }

  // Sort by timestamp descending
  allComments.sort((a, b) => {
    const dateA = new Date(a.timestamp || 0).getTime();
    const dateB = new Date(b.timestamp || 0).getTime();
    return dateB - dateA;
  });

  return new Response(JSON.stringify({ comments: allComments, total: allComments.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
