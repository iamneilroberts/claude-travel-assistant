/**
 * MCP Tool Handlers: Support and messaging operations
 * Handles: submit_support, reply_to_admin, dismiss_admin_message
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';

export const handleSubmitSupport: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { subject, message, priority = "medium", tripId, screenshotUrl } = args;

  // Get or create support requests list
  const supportKey = "_support_requests";
  const existing = await env.TRIPS.get(supportKey, "json") as { requests: any[] } | null;
  const requests = existing?.requests || [];

  // Create support ticket
  const ticketId = `support_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ticket: any = {
    id: ticketId,
    userId: keyPrefix.slice(0, -1),
    subject,
    message,
    priority,
    tripId: tripId || null,
    status: "open",
    timestamp: new Date().toISOString()
  };

  // Store screenshot URL if provided
  if (screenshotUrl) {
    ticket.screenshotUrl = screenshotUrl;
  }

  requests.unshift(ticket); // Add to beginning (newest first)

  // Keep last 100 requests
  if (requests.length > 100) {
    requests.length = 100;
  }

  await env.TRIPS.put(supportKey, JSON.stringify({ requests }));

  const result = {
    success: true,
    ticketId: ticket.id,
    message: `✓ Support request submitted! Ticket ID: ${ticket.id}. An admin will review your request soon.`
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};

export const handleReplyToAdmin: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { threadId, message } = args;
  const userId = keyPrefix.slice(0, -1);

  // Load user's threads
  const threadsKey = `_admin_messages/threads/${userId}`;
  const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;

  if (!threadsData?.threads) {
    throw new Error("No message threads found. You may not have any messages from admin.");
  }

  const thread = threadsData.threads.find(t => t.id === threadId);
  if (!thread) {
    throw new Error(`Thread '${threadId}' not found. Check the threadId from adminMessages in get_context.`);
  }

  // Add user's reply
  const newMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sender: "user",
    senderName: userProfile?.name || userId,
    body: message,
    timestamp: new Date().toISOString(),
    read: false  // Admin hasn't seen it yet
  };

  thread.messages.push(newMessage);
  thread.updatedAt = new Date().toISOString();
  thread.status = "open";  // Re-open if was closed

  // Mark admin messages as read since user is replying
  for (const msg of thread.messages) {
    if (msg.sender === "admin") {
      msg.read = true;
    }
  }

  await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));

  const result = {
    success: true,
    message: `✓ Reply sent to admin. Thread: "${thread.subject}". The admin will be notified of your response.`
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};

export const handleDismissAdminMessage: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { messageId, type } = args;
  const userId = keyPrefix.slice(0, -1);

  if (type === "broadcast") {
    // Add to user's dismissed broadcasts list
    const stateKey = `_admin_messages/user_states/${userId}`;
    const state = await env.TRIPS.get(stateKey, "json") as {
      dismissedBroadcasts: string[];
      lastChecked: string;
    } | null || { dismissedBroadcasts: [], lastChecked: new Date().toISOString() };

    if (!state.dismissedBroadcasts.includes(messageId)) {
      state.dismissedBroadcasts.push(messageId);
    }
    state.lastChecked = new Date().toISOString();

    await env.TRIPS.put(stateKey, JSON.stringify(state));

    return {
      content: [{ type: "text", text: JSON.stringify({
        success: true,
        message: `✓ Announcement dismissed. It won't appear again.`
      }, null, 2) }]
    };
  } else if (type === "thread") {
    // Mark all messages in thread as read
    const threadsKey = `_admin_messages/threads/${userId}`;
    const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;

    if (threadsData?.threads) {
      const thread = threadsData.threads.find(t => t.id === messageId);
      if (thread) {
        for (const msg of thread.messages) {
          msg.read = true;
        }
        thread.updatedAt = new Date().toISOString();
        await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify({
        success: true,
        message: `✓ Message thread marked as read. You can still reply later using reply_to_admin if needed.`
      }, null, 2) }]
    };
  } else {
    throw new Error("Invalid type. Use 'broadcast' for announcements or 'thread' for direct messages.");
  }
};
