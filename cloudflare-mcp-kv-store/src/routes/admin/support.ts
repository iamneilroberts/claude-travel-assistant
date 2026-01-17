/**
 * Admin Routes: Support ticket management
 * Handles: GET /admin/support, PUT /admin/support/:id
 */

import type { Env, UserProfile, RouteHandler } from '../../types';
import { listAllKeys } from '../../lib/kv';

export const handleListSupport: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/support" || request.method !== "GET") return null;

  const data = await env.TRIPS.get("_support_requests", "json") as { requests: any[] } | null;
  const requests = data?.requests || [];

  // Enrich with user info
  const userMap: Record<string, string> = {};
  const userKeys = await listAllKeys(env, { prefix: "_users/" });
  for (const key of userKeys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (user) userMap[user.userId] = user.name;
  }

  const enrichedRequests = requests.map(r => ({
    ...r,
    userName: userMap[r.userId] || r.userId
  }));

  return new Response(JSON.stringify({ requests: enrichedRequests, total: enrichedRequests.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleUpdateSupport: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (!url.pathname.match(/^\/admin\/support\/[^/]+$/) || request.method !== "PUT") return null;

  const ticketId = url.pathname.split('/').pop();
  const updates = await request.json() as { status?: string; notes?: string; adminNotes?: string };

  const data = await env.TRIPS.get("_support_requests", "json") as { requests: any[] } | null;
  if (!data?.requests) {
    return new Response(JSON.stringify({ error: "No support requests found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const idx = data.requests.findIndex(r => r.id === ticketId);
  if (idx === -1) {
    return new Response(JSON.stringify({ error: "Ticket not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  data.requests[idx] = {
    ...data.requests[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await env.TRIPS.put("_support_requests", JSON.stringify(data));

  return new Response(JSON.stringify({ success: true, request: data.requests[idx] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
