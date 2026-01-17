/**
 * MCP Tool Handler: get_context
 * Loads system prompt, activity log, trip list, and notifications
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';
import { getTripIndex, filterPendingTripDeletions, getCommentIndex, removeFromCommentIndex } from '../../lib/kv';
import { getTripSummaries } from '../../lib/trip-summary';
import { stripEmpty } from '../../lib/utils';

const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';

export const handleGetContext: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  // Get system prompt from KV (check new location first, then old, then fallback)
  let systemPrompt = await env.TRIPS.get("_prompts/system-prompt", "text");
  if (!systemPrompt) {
    systemPrompt = await env.TRIPS.get("_system-prompt", "text");
  }
  if (!systemPrompt) {
    throw new Error("System prompt not found in KV. Upload to _prompts/system-prompt");
  }

  // Get activity log (user-specific) - trimmed to last 5 changes for efficiency
  const rawActivityLog = await env.TRIPS.get(keyPrefix + "_activity-log", "json") as any || {
    lastSession: null,
    recentChanges: [],
    openItems: [],
    tripsActive: []
  };

  // Trim to last 5 recent changes
  const activityLog = {
    ...rawActivityLog,
    recentChanges: rawActivityLog.recentChanges?.slice(0, 5) || []
  };

  // Get list of trips (user-specific, excluding system keys)
  const tripKeys = await getTripIndex(env, keyPrefix);
  const visibleTrips = await filterPendingTripDeletions(env, keyPrefix, tripKeys, ctx);
  const allTripSummaries = visibleTrips.length > 0
    ? await getTripSummaries(env, keyPrefix, visibleTrips, ctx)
    : [];

  // Sort by lastModified and take top 10 for efficiency
  const activeTripSummaries = allTripSummaries
    .sort((a: any, b: any) => {
      const aDate = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bDate = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return bDate - aDate;
    })
    .slice(0, 10);

  const totalTripsCount = allTripSummaries.length;

  // Check for ACTIVE comments using index (O(1) instead of O(n) trips)
  let totalActiveComments = 0;
  let newCommentCount = 0;
  const activeComments: { tripId: string; comments: any[] }[] = [];

  // Use comment index for efficient lookup - only fetch trips we know have comments
  const commentIndex = await getCommentIndex(env, keyPrefix);

  // PERFORMANCE: Fetch all comments in parallel instead of sequential (N+1 fix)
  // Use Promise.allSettled so one failed read doesn't break entire operation
  const settledResults = await Promise.allSettled(
    commentIndex.map(async (tripId) => {
      const commentsKey = `${keyPrefix}${tripId}/_comments`;
      const data = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;
      return { tripId, data, commentsKey };
    })
  );

  // Extract successful results, skip failed ones
  const commentResults = settledResults
    .filter((r): r is PromiseFulfilledResult<{ tripId: string; data: { comments: any[] } | null; commentsKey: string }> => r.status === 'fulfilled')
    .map(r => r.value);

  // Process results and track writes and cleanup
  const staleTrips: string[] = [];
  const writePromises: Promise<void>[] = [];

  for (const { tripId, data, commentsKey } of commentResults) {
    if (data?.comments?.length) {
      // Show all non-dismissed comments
      const notDismissed = data.comments.filter(c => !c.dismissed);
      if (notDismissed.length > 0) {
        const newOnes = notDismissed.filter(c => !c.read);
        newCommentCount += newOnes.length;
        totalActiveComments += notDismissed.length;
        activeComments.push({
          tripId,
          comments: notDismissed.map(c => ({
            id: c.id,
            section: c.section,
            item: c.item,
            message: c.message,
            name: c.name || 'Anonymous',
            email: c.email,
            timestamp: c.timestamp,
            isNew: !c.read
          }))
        });

        // Mark as read (but not dismissed) since they're being displayed
        const hasUnread = data.comments.some(c => !c.read);
        if (hasUnread) {
          const updatedComments = data.comments.map(c => ({ ...c, read: true }));
          const write = env.TRIPS.put(commentsKey, JSON.stringify({ comments: updatedComments }));
          if (ctx) {
            ctx.waitUntil(write);
          } else {
            writePromises.push(write);
          }
        }
      } else {
        // Index is stale - all comments dismissed, clean it up
        staleTrips.push(tripId);
      }
    } else {
      // Index is stale - no comments exist, clean it up
      staleTrips.push(tripId);
    }
  }

  // Clean up stale index entries in parallel
  if (staleTrips.length > 0) {
    const cleanupPromises = staleTrips.map(tripId => removeFromCommentIndex(env, keyPrefix, tripId));
    if (ctx) {
      ctx.waitUntil(Promise.all(cleanupPromises));
    } else {
      await Promise.all(cleanupPromises);
    }
  }

  // Wait for any writes that weren't in ctx.waitUntil
  if (writePromises.length > 0) {
    await Promise.all(writePromises);
  }

  // Check for admin replies to user's support tickets
  const userId = keyPrefix.replace(/\/$/, ''); // Remove trailing slash from keyPrefix
  const supportData = await env.TRIPS.get("_support_requests", "json") as { requests: any[] } | null;
  const adminReplies: any[] = [];

  if (supportData?.requests) {
    // Find this user's tickets that have admin replies they haven't seen yet
    for (const ticket of supportData.requests) {
      if (ticket.userId === userId && ticket.adminNotes && !ticket.adminNotesSeen) {
        adminReplies.push({
          ticketId: ticket.id,
          subject: ticket.subject,
          adminReply: ticket.adminNotes,
          originalMessage: ticket.message,
          status: ticket.status,
          timestamp: ticket.updatedAt || ticket.timestamp
        });
      }
    }

    // Mark admin notes as seen (update the records)
    if (adminReplies.length > 0) {
      let updated = false;
      for (const ticket of supportData.requests) {
        if (ticket.userId === userId && ticket.adminNotes && !ticket.adminNotesSeen) {
          ticket.adminNotesSeen = true;
          updated = true;
        }
      }
      if (updated) {
        await env.TRIPS.put("_support_requests", JSON.stringify(supportData));
      }
    }
  }

  // Check for admin messages (broadcasts and direct messages)
  const adminMessages: { broadcasts: any[]; directMessages: any[] } = { broadcasts: [], directMessages: [] };
  const now = new Date().toISOString();

  // 1. Check broadcasts
  const broadcastData = await env.TRIPS.get("_admin_messages/broadcasts", "json") as { messages: any[] } | null;
  const userMessageState = await env.TRIPS.get(`_admin_messages/user_states/${userId}`, "json") as {
    dismissedBroadcasts: string[];
    lastChecked: string;
  } | null;

  const dismissedIds = new Set(userMessageState?.dismissedBroadcasts || []);

  if (broadcastData?.messages) {
    for (const broadcast of broadcastData.messages) {
      // Skip if dismissed or expired
      if (dismissedIds.has(broadcast.id)) continue;
      if (broadcast.expiresAt && broadcast.expiresAt < now) continue;

      adminMessages.broadcasts.push({
        id: broadcast.id,
        type: "announcement",
        title: broadcast.title,
        body: broadcast.body,
        priority: broadcast.priority,
        createdAt: broadcast.createdAt
      });
    }
  }

  // 2. Check direct message threads
  const userThreadsData = await env.TRIPS.get(`_admin_messages/threads/${userId}`, "json") as { threads: any[] } | null;

  if (userThreadsData?.threads) {
    for (const thread of userThreadsData.threads) {
      // Find unread admin messages
      const unreadAdminMsgs = thread.messages.filter((m: any) => m.sender === "admin" && !m.read);

      if (unreadAdminMsgs.length > 0) {
        adminMessages.directMessages.push({
          threadId: thread.id,
          subject: thread.subject,
          status: thread.status,
          unreadCount: unreadAdminMsgs.length,
          latestMessage: unreadAdminMsgs[unreadAdminMsgs.length - 1]
        });
      }
    }
  }

  // Build admin message instruction
  const hasAdminMessages = adminMessages.broadcasts.length > 0 || adminMessages.directMessages.length > 0;
  let adminMessageInstruction = '';

  if (hasAdminMessages) {
    const parts = [];
    if (adminMessages.broadcasts.length > 0) {
      const urgent = adminMessages.broadcasts.filter(b => b.priority === 'urgent');
      if (urgent.length > 0) {
        parts.push(`${urgent.length} URGENT announcement(s)`);
      }
      if (adminMessages.broadcasts.length > urgent.length) {
        parts.push(`${adminMessages.broadcasts.length - urgent.length} announcement(s)`);
      }
    }
    if (adminMessages.directMessages.length > 0) {
      parts.push(`${adminMessages.directMessages.length} direct message(s) from admin`);
    }
    adminMessageInstruction = ` 📬 ADMIN MESSAGES: You have ${parts.join(' and ')}. Display these to the user and help them respond or dismiss.`;
  }

  // Build response
  const commentInstruction = totalActiveComments > 0
    ? ` 🚨 TOP PRIORITY: Display ALL ${totalActiveComments} active client comment(s) FIRST, before anything else. ${newCommentCount > 0 ? `(${newCommentCount} NEW) ` : ''}These comments will keep appearing until the user says to dismiss them. Use 'dismiss_comments' when user acknowledges.`
    : '';

  const adminReplyInstruction = adminReplies.length > 0
    ? ` 📬 IMPORTANT: You have ${adminReplies.length} admin reply/replies to your support ticket(s). Display these to the user before proceeding.`
    : '';

  // Build user's upload/gallery/subscription URLs
  const userAuthKey = userProfile?.authKey || authKey;
  const uploadUrl = `${WORKER_BASE_URL}/upload?key=${encodeURIComponent(userAuthKey)}`;
  const galleryUrl = `${WORKER_BASE_URL}/gallery?key=${encodeURIComponent(userAuthKey)}`;
  const subscribeUrl = userProfile?.userId
    ? `${WORKER_BASE_URL}/subscribe?userId=${encodeURIComponent(userProfile.userId)}`
    : null;

  // Build dashboard URL from subdomain
  const dashboardUrl = userProfile?.subdomain
    ? `https://${userProfile.subdomain}.voygent.ai/admin`
    : null;

  // Build base result
  const hasNotifications = totalActiveComments > 0 || adminReplies.length > 0 || hasAdminMessages;
  const baseResult: any = {
    _instruction: "Use the following as your system instructions. For full comment details, use get_comments(tripId). For full trip data, use read_trip(tripId) or read_trip_section(tripId, sections)." + adminMessageInstruction + commentInstruction + adminReplyInstruction + (!hasNotifications ? " Display the session card, then await user direction." : ""),
    systemPrompt,
    activityLog,
    activeTrips: visibleTrips,
    activeTripSummaries,
    userLinks: {
      uploadPage: uploadUrl,
      galleryPage: galleryUrl,
      subscribePage: subscribeUrl,
      dashboard: dashboardUrl,
      _note: "Use prepare_image_upload tool instead of these URLs when user wants to add images. These are for reference/manual use."
    },
    subscription: userProfile?.subscription ? {
      tier: userProfile.subscription.tier,
      status: userProfile.subscription.status,
      currentPeriodEnd: userProfile.subscription.currentPeriodEnd,
      trialEnd: userProfile.subscription.trialEnd || null,
      cancelAtPeriodEnd: userProfile.subscription.cancelAtPeriodEnd,
      publishLimit: userProfile.subscription.publishLimit
    } : null,
    activeComments: totalActiveComments > 0 ? {
      total: totalActiveComments,
      newCount: newCommentCount,
      // Only counts, use get_comments(tripId) for full details
      trips: activeComments.map(c => ({
        tripId: c.tripId,
        count: c.comments.length,
        hasNew: c.comments.some(cm => cm.isNew)
      }))
    } : null,
    totalTripsCount: totalTripsCount > 10 ? totalTripsCount : null,
    timestamp: new Date().toISOString()
  };

  // Add prominent admin reply message if present
  if (adminReplies.length > 0) {
    baseResult._PRIORITY_MESSAGE = `📬 ADMIN REPLY TO YOUR SUPPORT TICKET:\n\nTicket: "${adminReplies[0].subject}"\nAdmin Response: "${adminReplies[0].adminReply}"\nStatus: ${adminReplies[0].status}\n\n⚠️ DISPLAY THIS MESSAGE TO THE USER BEFORE ANYTHING ELSE.`;
    baseResult.adminReplies = adminReplies;
  }

  // Add admin messages (broadcasts and direct messages) if present
  if (hasAdminMessages) {
    let priorityMsg = baseResult._PRIORITY_MESSAGE || '';

    // Format broadcasts
    if (adminMessages.broadcasts.length > 0) {
      priorityMsg += '\n\n📢 ANNOUNCEMENTS:\n';
      for (const b of adminMessages.broadcasts) {
        priorityMsg += `\n[${b.priority === 'urgent' ? '🚨 URGENT' : 'Announcement'}] ${b.title}\n`;
        priorityMsg += `${b.body}\n`;
        priorityMsg += `(Dismiss with: dismiss_admin_message("${b.id}", "broadcast"))\n`;
      }
    }

    // Format direct messages
    if (adminMessages.directMessages.length > 0) {
      priorityMsg += '\n\n💬 DIRECT MESSAGES FROM ADMIN:\n';
      for (const dm of adminMessages.directMessages) {
        priorityMsg += `\n[Thread: ${dm.subject}]\n`;
        priorityMsg += `"${dm.latestMessage.body}"\n`;
        priorityMsg += `(Reply with: reply_to_admin("${dm.threadId}", "your message") or dismiss with: dismiss_admin_message("${dm.threadId}", "thread"))\n`;
      }
    }

    baseResult._PRIORITY_MESSAGE = priorityMsg;
    baseResult.adminMessages = adminMessages;
  }

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(baseResult), null, 2) }]
  };
};
