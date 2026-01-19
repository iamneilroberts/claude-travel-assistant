/**
 * Comment submission and thread viewing endpoints (public, no auth required)
 */

import type { Env, RouteHandler } from '../types';
import { addToCommentIndex, listAllKeys } from '../lib/kv';

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

/**
 * Comment thread viewing endpoint
 * GET /trips/{tripId}/comments - View comment thread for a trip
 */
export const handleCommentThread: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  // Match /trips/{tripId}/comments
  const match = url.pathname.match(/^\/trips\/([^\/]+)\/comments$/);
  if (!match || request.method !== "GET") {
    return null;
  }

  let tripId = match[1];
  try {
    tripId = decodeURIComponent(tripId);
  } catch {
    tripId = match[1];
  }

  try {
    // Find the trip across all user prefixes
    const keys = await listAllKeys(env, {});
    let commentsData: { comments: any[] } | null = null;
    let tripData: any = null;
    let foundKey = '';

    for (const key of keys) {
      if (key.name.endsWith(`/${tripId}/_comments`)) {
        commentsData = await env.TRIPS.get(key.name, "json") as { comments: any[] } | null;
        foundKey = key.name.replace('/_comments', '');
        // Also try to get trip meta
        tripData = await env.TRIPS.get(foundKey, "json");
        break;
      }
    }

    if (!commentsData?.comments?.length) {
      return new Response(renderCommentThreadPage(tripId, [], null), {
        headers: { ...corsHeaders, "Content-Type": "text/html" }
      });
    }

    return new Response(renderCommentThreadPage(tripId, commentsData.comments, tripData), {
      headers: { ...corsHeaders, "Content-Type": "text/html" }
    });
  } catch (err) {
    return new Response(renderCommentThreadPage(tripId, [], null, "Error loading comments"), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/html" }
    });
  }
};

function renderCommentThreadPage(tripId: string, comments: any[], tripData: any, error?: string): string {
  const tripName = tripData?.meta?.clientName
    ? `${tripData.meta.clientName}'s ${tripData.meta.destination || 'Trip'}`
    : tripId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch { return iso; }
  };

  const commentsHtml = comments.length === 0
    ? '<p class="no-comments">No comments yet.</p>'
    : comments.map(c => `
      <div class="comment-thread">
        <div class="comment traveler-comment">
          <div class="comment-header">
            <span class="comment-author">👤 ${escapeHtml(c.name || 'Traveler')}</span>
            <span class="comment-section">on ${escapeHtml(c.item ? `${c.section} - ${c.item}` : c.section)}</span>
          </div>
          <div class="comment-body">${escapeHtml(c.message)}</div>
          <div class="comment-time">${formatDate(c.timestamp)}</div>
        </div>
        ${(c.replies || []).map((r: any) => `
          <div class="comment agent-reply">
            <div class="comment-header">
              <span class="comment-author">✈️ ${escapeHtml(r.from || 'Travel Agent')}</span>
            </div>
            <div class="comment-body">${escapeHtml(r.message)}</div>
            <div class="comment-time">${formatDate(r.timestamp)}</div>
          </div>
        `).join('')}
      </div>
    `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comments - ${escapeHtml(tripName)}</title>
  <style>
    :root {
      --primary: #1b619c;
      --primary-dark: #154a78;
      --accent: #3baf2a;
      --bg: #f5f9fc;
      --text: #2c3e50;
      --text-light: #5a6c7d;
      --border: #d1e3f0;
      --white: #ffffff;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 20px;
    }
    .container {
      max-width: 700px;
      margin: 0 auto;
    }
    .header {
      background: var(--primary);
      color: var(--white);
      padding: 25px;
      border-radius: 12px 12px 0 0;
      text-align: center;
    }
    .header h1 {
      font-size: 1.5em;
      margin-bottom: 5px;
    }
    .header .subtitle {
      opacity: 0.9;
      font-size: 0.95em;
    }
    .content {
      background: var(--white);
      padding: 25px;
      border-radius: 0 0 12px 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .comment-thread {
      margin-bottom: 25px;
      padding-bottom: 25px;
      border-bottom: 1px solid var(--border);
    }
    .comment-thread:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .comment {
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 10px;
    }
    .traveler-comment {
      background: var(--bg);
      border-left: 4px solid var(--primary);
    }
    .agent-reply {
      background: #e8f5e9;
      border-left: 4px solid var(--accent);
      margin-left: 30px;
    }
    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 5px;
    }
    .comment-author {
      font-weight: 600;
      color: var(--primary);
    }
    .agent-reply .comment-author {
      color: var(--accent);
    }
    .comment-section {
      font-size: 0.85em;
      color: var(--text-light);
    }
    .comment-body {
      margin-bottom: 8px;
      white-space: pre-wrap;
    }
    .comment-time {
      font-size: 0.8em;
      color: var(--text-light);
    }
    .no-comments {
      text-align: center;
      color: var(--text-light);
      padding: 40px 20px;
    }
    .error {
      background: #ffebee;
      color: #c62828;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 0.85em;
      color: var(--text-light);
    }
    @media (max-width: 600px) {
      .agent-reply { margin-left: 15px; }
      .comment-header { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💬 Conversation</h1>
      <div class="subtitle">${escapeHtml(tripName)}</div>
    </div>
    <div class="content">
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      ${commentsHtml}
    </div>
    <div class="footer">
      Questions about your trip? Leave a comment on the proposal page.
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
