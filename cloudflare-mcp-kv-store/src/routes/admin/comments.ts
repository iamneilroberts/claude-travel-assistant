/**
 * Admin Routes: Comment listing and management
 * Handles:
 *   GET    /admin/comments        - List all comments
 *   DELETE /admin/comments/single - Delete individual comment
 *   DELETE /admin/comments/all    - Delete all comments
 */

import type { Env, UserProfile, RouteHandler } from '../../types';
import { listAllKeys, getKeyPrefix } from '../../lib/kv';
import { getValidAuthKeys } from '../../lib/auth';

interface CommentData {
  comments: Array<{
    id: string;
    section: string;
    message: string;
    timestamp: string;
    name?: string;
    read?: boolean;
  }>;
}

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

/**
 * DELETE /admin/comments/single - Delete a single comment
 * Body: { tripKey: string, commentId: string }
 */
export const handleDeleteComment: RouteHandler = async (request, env, _ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/comments/single" || request.method !== "DELETE") return null;

  const body = await request.json() as { tripKey: string; commentId: string };
  const { tripKey, commentId } = body;

  if (!tripKey || !commentId) {
    return new Response(JSON.stringify({ error: "tripKey and commentId required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const commentsKey = `${tripKey}/_comments`;
  const data = await env.TRIPS.get(commentsKey, "json") as CommentData | null;

  if (!data?.comments) {
    return new Response(JSON.stringify({ error: "Comments not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const idx = data.comments.findIndex(c => c.id === commentId);
  if (idx === -1) {
    return new Response(JSON.stringify({ error: "Comment not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  data.comments.splice(idx, 1);
  await env.TRIPS.put(commentsKey, JSON.stringify(data));

  return new Response(JSON.stringify({ success: true, deleted: commentId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

/**
 * DELETE /admin/comments/all - Delete all comments across all trips
 */
export const handleDeleteAllComments: RouteHandler = async (request, env, _ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/comments/all" || request.method !== "DELETE") return null;

  const allKeys = await listAllKeys(env);
  let deleted = 0;

  for (const key of allKeys) {
    if (key.name.endsWith('/_comments')) {
      await env.TRIPS.delete(key.name);
      deleted++;
    }
  }

  return new Response(JSON.stringify({ success: true, deletedKeys: deleted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
