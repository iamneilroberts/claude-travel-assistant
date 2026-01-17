/**
 * Admin Routes: Admin messages (broadcasts and direct messages)
 * Handles: GET /admin/messages, POST /admin/messages/broadcast, DELETE /admin/messages/broadcast/:id,
 *          POST /admin/messages/direct, GET/PUT /admin/messages/thread/:userId/:threadId,
 *          POST /admin/messages/thread/:userId/:threadId/mark-read
 */

import type { Env, UserProfile, RouteHandler } from '../../types';
import { listAllKeys } from '../../lib/kv';

export const handleListMessages: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/messages" || request.method !== "GET") return null;

  // Load broadcasts
  const broadcastData = await env.TRIPS.get("_admin_messages/broadcasts", "json") as { messages: any[] } | null;
  const broadcasts = broadcastData?.messages || [];

  // Get all users for counting dismissals
  const userStateKeys = await listAllKeys(env, { prefix: "_admin_messages/user_states/" });
  const dismissalCounts: Record<string, number> = {};

  for (const key of userStateKeys) {
    const state = await env.TRIPS.get(key.name, "json") as { dismissedBroadcasts: string[] } | null;
    if (state?.dismissedBroadcasts) {
      for (const id of state.dismissedBroadcasts) {
        dismissalCounts[id] = (dismissalCounts[id] || 0) + 1;
      }
    }
  }

  // Get total user count for stats
  const userKeys = await listAllKeys(env, { prefix: "_users/" });
  const totalUsers = userKeys.length;

  // Enrich broadcasts with stats
  const now = new Date().toISOString();
  const enrichedBroadcasts = broadcasts
    .filter(b => !b.expiresAt || b.expiresAt > now)
    .map(b => ({
      ...b,
      stats: {
        totalUsers,
        dismissed: dismissalCounts[b.id] || 0,
        pending: totalUsers - (dismissalCounts[b.id] || 0)
      }
    }));

  // Load all direct message threads
  const threadKeys = await listAllKeys(env, { prefix: "_admin_messages/threads/" });
  const directThreads: any[] = [];
  let unreadUserReplies = 0;

  // Load user names for display
  const usersData: Record<string, UserProfile> = {};
  for (const key of userKeys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (user) usersData[user.userId] = user;
  }

  for (const key of threadKeys) {
    const userId = key.name.replace("_admin_messages/threads/", "");
    const data = await env.TRIPS.get(key.name, "json") as { threads: any[] } | null;

    if (data?.threads) {
      for (const thread of data.threads) {
        const unreadCount = thread.messages.filter((m: any) => m.sender === "user" && !m.read).length;
        unreadUserReplies += unreadCount;

        const lastMsg = thread.messages[thread.messages.length - 1];
        directThreads.push({
          id: thread.id,
          userId,
          userName: usersData[userId]?.name || userId,
          subject: thread.subject,
          status: thread.status,
          lastMessage: {
            sender: lastMsg?.sender,
            preview: lastMsg?.body?.substring(0, 100) || "",
            timestamp: lastMsg?.timestamp
          },
          unreadCount,
          messageCount: thread.messages.length,
          updatedAt: thread.updatedAt
        });
      }
    }
  }

  // Sort threads by most recent activity
  directThreads.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  return new Response(JSON.stringify({
    broadcasts: enrichedBroadcasts,
    directThreads,
    stats: {
      activeBroadcasts: enrichedBroadcasts.length,
      openThreads: directThreads.filter(t => t.status === "open").length,
      unreadUserReplies
    }
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleCreateBroadcast: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/messages/broadcast" || request.method !== "POST") return null;

  const body = await request.json() as {
    title: string;
    body: string;
    priority?: "normal" | "urgent";
    expiresAt?: string;
  };

  if (!body.title || !body.body) {
    return new Response(JSON.stringify({ error: "title and body are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const broadcastData = await env.TRIPS.get("_admin_messages/broadcasts", "json") as { messages: any[] } | null || { messages: [] };

  const newBroadcast = {
    id: `broadcast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "announcement",
    title: body.title,
    body: body.body,
    priority: body.priority || "normal",
    createdAt: new Date().toISOString(),
    expiresAt: body.expiresAt || null,
    createdBy: "admin"
  };

  broadcastData.messages.unshift(newBroadcast);
  await env.TRIPS.put("_admin_messages/broadcasts", JSON.stringify(broadcastData));

  return new Response(JSON.stringify({
    success: true,
    message: newBroadcast
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleDeleteBroadcast: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (!url.pathname.startsWith("/admin/messages/broadcast/") || request.method !== "DELETE") return null;

  const broadcastId = url.pathname.replace("/admin/messages/broadcast/", "");

  const broadcastData = await env.TRIPS.get("_admin_messages/broadcasts", "json") as { messages: any[] } | null;
  if (!broadcastData?.messages) {
    return new Response(JSON.stringify({ error: "Broadcast not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const idx = broadcastData.messages.findIndex(m => m.id === broadcastId);
  if (idx === -1) {
    return new Response(JSON.stringify({ error: "Broadcast not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  broadcastData.messages.splice(idx, 1);
  await env.TRIPS.put("_admin_messages/broadcasts", JSON.stringify(broadcastData));

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleSendDirectMessage: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/messages/direct" || request.method !== "POST") return null;

  const body = await request.json() as {
    userId: string;
    subject: string;
    body: string;
    threadId?: string;
  };

  if (!body.userId || !body.subject || !body.body) {
    return new Response(JSON.stringify({ error: "userId, subject, and body are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const threadsKey = `_admin_messages/threads/${body.userId}`;
  const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null || { threads: [] };

  const newMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sender: "admin",
    senderName: "Voygent Support",
    body: body.body,
    timestamp: new Date().toISOString(),
    read: false
  };

  let thread;
  if (body.threadId) {
    // Reply to existing thread
    thread = threadsData.threads.find(t => t.id === body.threadId);
    if (!thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    thread.messages.push(newMessage);
    thread.updatedAt = new Date().toISOString();
    thread.status = "open";
  } else {
    // Create new thread
    thread = {
      id: `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      subject: body.subject,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [newMessage]
    };
    threadsData.threads.unshift(thread);
  }

  await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));

  return new Response(JSON.stringify({
    success: true,
    thread: {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      messageCount: thread.messages.length
    },
    messageId: newMessage.id
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleGetThread: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (!url.pathname.match(/^\/admin\/messages\/thread\/[^/]+\/[^/]+$/) || request.method !== "GET") return null;

  const parts = url.pathname.split("/");
  const threadId = parts.pop()!;
  const userId = parts.pop()!;

  const threadsData = await env.TRIPS.get(`_admin_messages/threads/${userId}`, "json") as { threads: any[] } | null;
  const thread = threadsData?.threads?.find(t => t.id === threadId);

  if (!thread) {
    return new Response(JSON.stringify({ error: "Thread not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Get user info
  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile | null;

  return new Response(JSON.stringify({
    thread: {
      ...thread,
      userId,
      userName: user?.name || userId,
      userEmail: user?.email || ""
    }
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleUpdateThread: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (!url.pathname.match(/^\/admin\/messages\/thread\/[^/]+\/[^/]+$/) || request.method !== "PUT") return null;

  const parts = url.pathname.split("/");
  const threadId = parts.pop()!;
  const userId = parts.pop()!;

  const body = await request.json() as {
    body?: string;
    status?: "open" | "closed";
  };

  const threadsKey = `_admin_messages/threads/${userId}`;
  const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;

  if (!threadsData?.threads) {
    return new Response(JSON.stringify({ error: "Thread not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const thread = threadsData.threads.find(t => t.id === threadId);
  if (!thread) {
    return new Response(JSON.stringify({ error: "Thread not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Add reply if body provided
  if (body.body) {
    thread.messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sender: "admin",
      senderName: "Voygent Support",
      body: body.body,
      timestamp: new Date().toISOString(),
      read: false
    });
    thread.status = "open";
  }

  // Update status if provided
  if (body.status) {
    thread.status = body.status;
  }

  thread.updatedAt = new Date().toISOString();
  await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));

  return new Response(JSON.stringify({
    success: true,
    thread: {
      id: thread.id,
      status: thread.status,
      messageCount: thread.messages.length
    }
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleMarkThreadRead: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (!url.pathname.match(/^\/admin\/messages\/thread\/[^/]+\/[^/]+\/mark-read$/) || request.method !== "POST") return null;

  const parts = url.pathname.replace("/mark-read", "").split("/");
  const threadId = parts.pop()!;
  const userId = parts.pop()!;

  const threadsKey = `_admin_messages/threads/${userId}`;
  const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;

  if (threadsData?.threads) {
    const thread = threadsData.threads.find(t => t.id === threadId);
    if (thread) {
      for (const msg of thread.messages) {
        if (msg.sender === "user") {
          msg.read = true;
        }
      }
      await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
