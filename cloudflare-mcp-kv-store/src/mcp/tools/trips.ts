/**
 * MCP Tool Handlers: Trip CRUD operations
 * Handles: list_trips, read_trip, save_trip, patch_trip, delete_trip
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';
import {
  getTripIndex,
  filterPendingTripDeletions,
  addToTripIndex,
  removeFromTripIndex,
  addPendingTripDeletion,
  removePendingTripDeletion,
  removeFromCommentIndex
} from '../../lib/kv';
import {
  computeTripSummary,
  writeTripSummary,
  deleteTripSummary,
  getTripSummaries
} from '../../lib/trip-summary';
import { stripEmpty } from '../../lib/utils';
import { validateTripId, validateSections } from '../../lib/validation';

export const handleListTrips: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const trips = await getTripIndex(env, keyPrefix);
  const visibleTrips = await filterPendingTripDeletions(env, keyPrefix, trips, ctx);
  const includeSummaries = !!args?.includeSummaries;
  const tripSummaries = includeSummaries
    ? await getTripSummaries(env, keyPrefix, visibleTrips, ctx)
    : null;

  // Also check for admin replies (in case get_context wasn't called first)
  const userId = keyPrefix.replace(/\/$/, '');
  const supportData = await env.TRIPS.get("_support_requests", "json") as { requests: any[] } | null;
  const adminReplies: any[] = [];

  if (supportData?.requests) {
    for (const ticket of supportData.requests) {
      if (ticket.userId === userId && ticket.adminNotes && !ticket.adminNotesSeen) {
        adminReplies.push({
          ticketId: ticket.id,
          subject: ticket.subject,
          adminReply: ticket.adminNotes,
          status: ticket.status
        });
      }
    }

    // Mark as seen
    if (adminReplies.length > 0) {
      for (const ticket of supportData.requests) {
        if (ticket.userId === userId && ticket.adminNotes && !ticket.adminNotesSeen) {
          ticket.adminNotesSeen = true;
        }
      }
      await env.TRIPS.put("_support_requests", JSON.stringify(supportData));
    }
  }

  let result: any;
  if (adminReplies.length > 0) {
    result = {
      _PRIORITY_MESSAGE: `📬 ADMIN REPLY TO YOUR SUPPORT TICKET:\n\nTicket: "${adminReplies[0].subject}"\nAdmin Response: "${adminReplies[0].adminReply}"\nStatus: ${adminReplies[0].status}\n\n⚠️ DISPLAY THIS MESSAGE TO THE USER BEFORE ANYTHING ELSE.`,
      adminReplies,
      trips: visibleTrips,
      ...(tripSummaries ? { tripSummaries } : {})
    };
  } else if (tripSummaries) {
    result = {
      trips: visibleTrips,
      tripSummaries
    };
  } else {
    result = visibleTrips;
  }

  return {
    content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

export const handleReadTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const tripId = args.key;

  // Security: Validate trip ID to prevent path traversal
  // Allow underscore prefix for system keys but still validate the rest
  const idToValidate = tripId.startsWith("_") ? tripId.substring(1) : tripId;
  if (idToValidate) validateTripId(idToValidate);

  const fullKey = keyPrefix + tripId;
  const data = await env.TRIPS.get(fullKey, "json");
  if (!data) throw new Error(`Trip '${tripId}' not found.`);

  const summaryUpdate = (async () => {
    const summary = await computeTripSummary(tripId, data);
    await writeTripSummary(env, keyPrefix, tripId, summary);
  })();
  if (ctx) {
    ctx.waitUntil(summaryUpdate);
  } else {
    await summaryUpdate;
  }

  // Check for active (non-dismissed) comments
  const commentsKey = `${keyPrefix}${tripId}/_comments`;
  const commentsData = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;
  const activeComments = commentsData?.comments?.filter(c => !c.dismissed) || [];

  let result: any;
  if (activeComments.length > 0) {
    result = {
      _activeComments: {
        count: activeComments.length,
        instruction: `🚨 This trip has ${activeComments.length} active client comment(s). Display them prominently. Use dismiss_comments('${tripId}') when user acknowledges.`,
        comments: activeComments.map(c => ({
          id: c.id,
          section: c.section,
          item: c.item,
          message: c.message,
          name: c.name || 'Anonymous',
          email: c.email,
          timestamp: c.timestamp
        }))
      },
      ...data as object
    };
  } else {
    result = data;
  }

  return {
    content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

export const handleReadTripSection: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, sections, itineraryDay } = args;

  // Security: Validate trip ID to prevent path traversal
  validateTripId(tripId);

  // Validate sections array
  validateSections(sections);

  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json") as any;

  if (!tripData) {
    throw new Error(`Trip '${tripId}' not found.`);
  }

  // Build partial response with only requested sections
  const result: any = { tripId };

  for (const section of sections) {
    if (tripData[section] !== undefined) {
      if (section === 'itinerary' && itineraryDay !== undefined) {
        // Return only the specific day
        const day = tripData.itinerary?.find((d: any) => d.day === itineraryDay);
        result.itinerary = day ? [day] : [];
      } else {
        result[section] = tripData[section];
      }
    }
  }

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

export const handleSaveTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  // Security: Validate trip ID to prevent path traversal
  validateTripId(args.key);

  const fullKey = keyPrefix + args.key;
  await env.TRIPS.put(fullKey, JSON.stringify(args.data));
  const summary = await computeTripSummary(args.key, args.data);
  await writeTripSummary(env, keyPrefix, args.key, summary, ctx);
  await addToTripIndex(env, keyPrefix, args.key);
  await removePendingTripDeletion(env, keyPrefix, args.key, ctx);

  // PERFORMANCE: Move activity logging to background (don't block response)
  const activityUpdate = (async () => {
    const activityLogKey = keyPrefix + "_activity-log";
    const activityLog = await env.TRIPS.get(activityLogKey, "json") as any || {
      lastSession: null,
      recentChanges: [],
      openItems: [],
      tripsActive: []
    };

    // Extract change description from trip meta if available
    const tripData = args.data as any;
    const changeDescription = tripData?.meta?.status || "Updated";
    const tripName = tripData?.meta?.clientName || tripData?.meta?.destination || args.key;

    // Add to recent changes (prepend, newest first)
    activityLog.recentChanges.unshift({
      tripId: args.key,
      tripName,
      change: changeDescription,
      timestamp: new Date().toISOString()
    });

    // Keep only last 20 changes to prevent unbounded growth
    if (activityLog.recentChanges.length > 20) {
      activityLog.recentChanges = activityLog.recentChanges.slice(0, 20);
    }

    // Update last session timestamp
    activityLog.lastSession = new Date().toISOString();

    // Add trip to active list if not already present (O(1) vs O(n) list scan)
    if (!activityLog.tripsActive.includes(args.key)) {
      activityLog.tripsActive.push(args.key);
    }

    await env.TRIPS.put(activityLogKey, JSON.stringify(activityLog));
  })();

  if (ctx) {
    ctx.waitUntil(activityUpdate);
  } else {
    await activityUpdate;
  }

  return {
    content: [{ type: "text", text: `Successfully saved ${args.key}` }]
  };
};

export const handlePatchTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  // Security: Validate trip ID to prevent path traversal
  validateTripId(args.key);

  // Read existing trip
  const fullKey = keyPrefix + args.key;
  const existingData = await env.TRIPS.get(fullKey, "json") as any;
  if (!existingData) throw new Error(`Trip '${args.key}' not found.`);

  // Apply updates using dot-notation paths
  const updates = args.updates as Record<string, any>;
  const updatedFields: string[] = [];

  for (const [path, value] of Object.entries(updates)) {
    const parts = path.split('.');
    let current = existingData;

    // Navigate to parent of target field
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    // Set the value
    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
    updatedFields.push(path);
  }

  // Update lastUpdated timestamp
  if (existingData.meta) {
    existingData.meta.lastUpdated = new Date().toISOString();
  }

  // Save updated trip
  await env.TRIPS.put(fullKey, JSON.stringify(existingData));
  const summary = await computeTripSummary(args.key, existingData);
  await writeTripSummary(env, keyPrefix, args.key, summary, ctx);

  // PERFORMANCE: Move activity logging to background (don't block response)
  const activityUpdate = (async () => {
    const activityLogKey = keyPrefix + "_activity-log";
    const activityLog = await env.TRIPS.get(activityLogKey, "json") as any || {
      lastSession: null,
      recentChanges: [],
      openItems: [],
      tripsActive: []
    };

    const changeDescription = existingData?.meta?.status || `Updated: ${updatedFields.join(', ')}`;
    const tripName = existingData?.meta?.clientName || existingData?.meta?.destination || args.key;

    activityLog.recentChanges.unshift({
      tripId: args.key,
      tripName,
      change: changeDescription,
      timestamp: new Date().toISOString()
    });

    if (activityLog.recentChanges.length > 20) {
      activityLog.recentChanges = activityLog.recentChanges.slice(0, 20);
    }

    activityLog.lastSession = new Date().toISOString();
    await env.TRIPS.put(activityLogKey, JSON.stringify(activityLog));
  })();

  if (ctx) {
    ctx.waitUntil(activityUpdate);
  } else {
    await activityUpdate;
  }

  return {
    content: [{ type: "text", text: `Patched ${args.key}: updated ${updatedFields.join(', ')}` }]
  };
};

export const handleDeleteTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  // Security: Validate trip ID to prevent path traversal
  validateTripId(args.key);

  const fullKey = keyPrefix + args.key;
  await env.TRIPS.delete(fullKey);
  await deleteTripSummary(env, keyPrefix, args.key, ctx);
  await removeFromTripIndex(env, keyPrefix, args.key);
  await addPendingTripDeletion(env, keyPrefix, args.key, ctx);

  // PERFORMANCE: Move activity logging to background (don't block response)
  const activityUpdate = (async () => {
    const activityLogKey = keyPrefix + "_activity-log";
    const activityLog = await env.TRIPS.get(activityLogKey, "json") as any;
    if (activityLog?.tripsActive) {
      activityLog.tripsActive = activityLog.tripsActive.filter((t: string) => t !== args.key);
      activityLog.recentChanges.unshift({
        tripId: args.key,
        tripName: args.key,
        change: "Deleted",
        timestamp: new Date().toISOString()
      });
      if (activityLog.recentChanges.length > 20) {
        activityLog.recentChanges = activityLog.recentChanges.slice(0, 20);
      }
      activityLog.lastSession = new Date().toISOString();
      await env.TRIPS.put(activityLogKey, JSON.stringify(activityLog));
    }
  })();

  // Also remove from comment index if present (can run in parallel with activity update)
  const commentCleanup = removeFromCommentIndex(env, keyPrefix, args.key);

  if (ctx) {
    ctx.waitUntil(activityUpdate);
    ctx.waitUntil(commentCleanup);
  } else {
    await Promise.all([activityUpdate, commentCleanup]);
  }

  return {
    content: [{ type: "text", text: `Deleted ${args.key}` }]
  };
};
