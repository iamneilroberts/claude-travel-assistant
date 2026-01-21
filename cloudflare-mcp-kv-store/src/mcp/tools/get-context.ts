/**
 * MCP Tool Handler: get_context
 * Loads system prompt, activity log, trip list, and notifications
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';
import { getTripIndex, filterPendingTripDeletions, getCommentIndex, removeFromCommentIndex } from '../../lib/kv';
import { getTripSummaries } from '../../lib/trip-summary';
import { stripEmpty } from '../../lib/utils';
import { getSampleTripOffer, autoImportSampleTrips } from './sample-trips';

const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';

/**
 * Compute user activity level based on account age and trip count
 */
function computeActivityLevel(profile: UserProfile, tripCount: number): 'new' | 'returning' | 'active' | 'power' {
  const accountAgeDays = Math.floor((Date.now() - new Date(profile.created).getTime()) / (1000 * 60 * 60 * 24));

  if (accountAgeDays < 7) return 'new';
  if (tripCount >= 10) return 'power';
  if (tripCount >= 3) return 'active';
  return 'returning';
}

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

  // Auto-import sample trips for new users (low-friction onboarding)
  let autoImportResult: { imported: string[]; alreadyHadTrips: boolean } | null = null;
  if (userProfile && !userProfile.sampleTripsOffered && allTripSummaries.length === 0) {
    autoImportResult = await autoImportSampleTrips(env, keyPrefix, userProfile, ctx);

    // If we imported samples, refresh the trip list
    if (autoImportResult.imported.length > 0) {
      const refreshedTripKeys = await getTripIndex(env, keyPrefix);
      const refreshedVisibleTrips = await filterPendingTripDeletions(env, keyPrefix, refreshedTripKeys, ctx);
      const refreshedSummaries = await getTripSummaries(env, keyPrefix, refreshedVisibleTrips, ctx);

      // Update the variables used below
      allTripSummaries.push(...refreshedSummaries);
      visibleTrips.push(...refreshedVisibleTrips);
    }
  }

  // Check if we should offer sample trips (only if auto-import didn't happen)
  const sampleOffer = autoImportResult?.imported.length
    ? { shouldOffer: false }
    : await getSampleTripOffer(env, keyPrefix, userProfile, allTripSummaries.length);

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

  // Build subdomain base URL for publishing
  const subdomainBaseUrl = userProfile?.subdomain
    ? `https://${userProfile.subdomain}.voygent.ai`
    : null;

  // Check if first-time user (no welcome shown yet)
  const isNewUser = userProfile && !userProfile.onboarding?.welcomeShown;
  const settingsUrl = userProfile?.subdomain
    ? `https://${userProfile.subdomain}.voygent.ai/admin/settings`
    : dashboardUrl ? `${dashboardUrl}/settings` : null;

  // Build sample trip instruction
  const sampleTripInstruction = sampleOffer.shouldOffer
    ? " 🎁 NEW USER: This user has no trips yet. Offer them sample trips to explore the system. Present the options and ask if they'd like to add them to get started."
    : '';

  // Build auto-import instruction for new users (first conversation)
  const autoImportInstruction = autoImportResult?.imported.length
    ? ` 🎁 FIRST CONVERSATION: This is the user's first time using Voygent. Give them a warm welcome that explains:
1. What Voygent is: "Voygent brings professional travel planning tools directly into your AI chat. Plan trips, create beautiful proposals, and manage bookings - all through natural conversation."
2. What the sample trips are: "I've added two sample trips to show you what's possible: a romantic Paris & Rome getaway and a Caribbean family cruise. These are fully populated with flights, hotels, activities, and pricing."
3. Prompt them to preview: "Say 'preview the Europe trip' or 'preview the cruise' to see what a client-ready proposal looks like!"
4. Mention they can clear samples when ready: "When you're ready to start your own trips, just say 'clear samples' and 'new trip'."`
    : '';

  // Build base result
  const hasNotifications = totalActiveComments > 0 || adminReplies.length > 0 || hasAdminMessages || sampleOffer.shouldOffer || autoImportResult?.imported.length;
  const baseResult: any = {
    _instruction: "Use the following as your system instructions. For full comment details, use get_comments(tripId). For full trip data, use read_trip(tripId) or read_trip_section(tripId, sections)." + adminMessageInstruction + commentInstruction + adminReplyInstruction + sampleTripInstruction + autoImportInstruction + (!hasNotifications ? " Display the session card, then await user direction." : ""),
    systemPrompt,
    activityLog,
    activeTrips: visibleTrips,
    activeTripSummaries,
    userLinks: {
      uploadPage: uploadUrl,
      galleryPage: galleryUrl,
      subscribePage: subscribeUrl,
      dashboard: dashboardUrl,
      subdomainBase: subdomainBaseUrl,
      _displayInGreeting: dashboardUrl ? `Your dashboard: ${dashboardUrl}` : null,
      _note: "Use prepare_image_upload tool instead of these URLs when user wants to add images. These are for reference/manual use."
    },
    userProfile: userProfile ? {
      name: userProfile.name,
      accountAgeDays: Math.floor((Date.now() - new Date(userProfile.created).getTime()) / (1000 * 60 * 60 * 24)),
      activityLevel: computeActivityLevel(userProfile, totalTripsCount),
      isFirstSession: !userProfile.onboarding?.welcomeShown
    } : null,
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
    timestamp: new Date().toISOString(),
    sampleTripOffer: sampleOffer.shouldOffer ? {
      available: true,
      samples: sampleOffer.samples,
      instruction: "This is a new user with no trips. Offer them the sample trips to get started. Use accept_sample_trips(['europe-romantic-7day', 'caribbean-cruise-family']) if they want them, or decline_sample_trips() if they want to start fresh."
    } : null,
    samplesAutoImported: autoImportResult?.imported.length ? {
      imported: autoImportResult.imported,
      count: autoImportResult.imported.length,
      instruction: "Sample trips were auto-imported for this new user. Welcome them and explain they can explore the samples or use clear_sample_trips() to remove them."
    } : null
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

  // Add welcome message for new users
  if (isNewUser && userProfile) {
    baseResult._WELCOME_NEW_USER = true;

    // Get user's first name for personalized greeting
    const userName = userProfile?.name?.split(' ')[0] || 'there';

    // Different welcome based on whether samples were auto-imported
    if (autoImportResult?.imported.length) {
      baseResult._WELCOME_MESSAGE = `
## Welcome to Voygent, ${userName}!

Voygent brings professional travel planning tools directly into your AI chat. Plan trips, create beautiful client proposals, and manage bookings - all through natural conversation.

### Sample Trips Ready to Explore

I've added two sample trips to show you what's possible:

1. **Paris & Rome Romantic Getaway** - 7-day European trip with flights, boutique hotels, tours, and dining
2. **Caribbean Family Cruise** - 10-day Royal Caribbean cruise with shore excursions and activities

These are fully populated examples showing flights, hotels, daily itineraries, and tiered pricing.

**Try it now:** Say "preview the Europe trip" or "preview the cruise" to see a client-ready proposal!

### Your Dashboard
${dashboardUrl ? `**${dashboardUrl}**` : '(Set up your subdomain for a dashboard)'}

### When You're Ready
- Say **"clear samples"** to remove the sample trips
- Say **"new trip"** to start planning for a real client
`;
    } else {
      baseResult._WELCOME_MESSAGE = `
## Welcome to Voygent, ${userName}!

Voygent brings professional travel planning tools directly into your AI chat. Plan trips, create beautiful client proposals, and manage bookings - all through natural conversation.

### Quick Start
- Say **"new trip"** to create your first proposal
- Say **"my trips"** to see your trip list

### Your Dashboard
${dashboardUrl ? `**${dashboardUrl}**` : '(Set up your subdomain for a dashboard)'}

Customize your branding, colors, and contact info from your dashboard settings.
`;
    }

    // Mark welcome as shown (async, don't block)
    if (ctx) {
      ctx.waitUntil((async () => {
        const updated = {
          ...userProfile,
          onboarding: { ...userProfile.onboarding, welcomeShown: true }
        };
        await env.TRIPS.put(`_users/${userProfile.userId}`, JSON.stringify(updated));
      })());
    }
  }

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(baseResult), null, 2) }]
  };
};
