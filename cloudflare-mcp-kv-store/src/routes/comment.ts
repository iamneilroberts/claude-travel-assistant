/**
 * Comment submission endpoint (public, no auth required)
 */

import type { Env, RouteHandler } from '../types';
import { addToCommentIndex } from '../lib/kv';

export const handleComment: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/comment" || request.method !== "POST") {
    return null;
  }

  try {
    // Rate limit: 10 comments per IP per hour
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const hourKey = new Date().toISOString().slice(0, 13); // "2026-01-13T14"
    const rateLimitKey = `_ratelimit/comment/${clientIP}/${hourKey}`;
    const currentCount = await env.TRIPS.get(rateLimitKey, "json") as number || 0;

    if (currentCount >= 10) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Increment rate limit counter (expires in 1 hour)
    await env.TRIPS.put(rateLimitKey, JSON.stringify(currentCount + 1), { expirationTtl: 3600 });

    const body = await request.json() as {
      tripKey: string;      // Full key path like "home_star1/caribbean-trip"
      section: string;      // "lodging", "itinerary", "general", etc.
      item?: string;        // Optional: specific item like "Day 3" or hotel name
      message: string;
      name?: string;
      email?: string;
    };

    if (!body.tripKey || !body.message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Load existing comments
    const commentsKey = `${body.tripKey}/_comments`;
    const existing = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;
    const comments = existing?.comments || [];

    // Add new comment
    comments.push({
      id: crypto.randomUUID(),
      section: body.section,
      item: body.item || null,
      message: body.message,
      name: body.name || "Anonymous",
      email: body.email || null,
      timestamp: new Date().toISOString(),
      read: false
    });

    // Save
    await env.TRIPS.put(commentsKey, JSON.stringify({ comments }));

    // Update comment index for efficient lookups
    // tripKey format: "user_prefix/trip-id" - extract both parts
    const slashIndex = body.tripKey.indexOf('/');
    if (slashIndex > 0) {
      const keyPrefix = body.tripKey.substring(0, slashIndex + 1); // includes trailing /
      const tripId = body.tripKey.substring(slashIndex + 1);
      await addToCommentIndex(env, keyPrefix, tripId);
    }

    return new Response(JSON.stringify({ success: true, commentCount: comments.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to save comment" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
