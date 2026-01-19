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

/**
 * Validate and clean trip data on save to prevent common data quality issues.
 * This runs before saving to enforce schema conventions documented in system-prompt.md.
 *
 * Cleans:
 * - Emoji-only itinerary activities/schedule items
 * - JSON strings in booking.details/notes (converts to empty)
 * - Normalizes cabin images to cruiseInfo.cabin.images
 */
function validateAndCleanTripData(tripData: any): { data: any; warnings: string[] } {
  const warnings: string[] = [];
  const hasAlphanumeric = (str: string) => /[a-zA-Z0-9]/.test(str);

  // Clean emoji-only itinerary content
  if (Array.isArray(tripData?.itinerary)) {
    tripData.itinerary = tripData.itinerary.map((day: any) => {
      // Filter activities with emoji-only names
      if (Array.isArray(day?.activities)) {
        const before = day.activities.length;
        day.activities = day.activities.filter((act: any) => {
          const name = typeof act?.name === 'string' ? act.name.trim() : '';
          return hasAlphanumeric(name) ||
                 (act?.description && hasAlphanumeric(String(act.description)));
        });
        if (day.activities.length < before) {
          warnings.push(`Day ${day.day}: Removed ${before - day.activities.length} emoji-only activity name(s)`);
        }
      }
      // Filter schedule items with emoji-only activity names
      if (Array.isArray(day?.schedule)) {
        const before = day.schedule.length;
        day.schedule = day.schedule.filter((item: any) => {
          const activity = typeof item?.activity === 'string' ? item.activity.trim() : '';
          return hasAlphanumeric(activity);
        });
        if (day.schedule.length < before) {
          warnings.push(`Day ${day.day}: Removed ${before - day.schedule.length} emoji-only schedule item(s)`);
        }
      }
      return day;
    });
  }

  // Clean JSON strings in booking.details/notes
  if (Array.isArray(tripData?.bookings)) {
    tripData.bookings = tripData.bookings.map((booking: any, idx: number) => {
      const cleanJsonField = (val: any, fieldName: string): any => {
        if (typeof val !== 'string') return val;
        const trimmed = val.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
            (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
          try {
            JSON.parse(trimmed);
            warnings.push(`Booking #${idx + 1}: Cleared JSON in ${fieldName} - use readable text instead`);
            return '';
          } catch {
            return val;
          }
        }
        return val;
      };
      return {
        ...booking,
        details: cleanJsonField(booking.details, 'details'),
        notes: cleanJsonField(booking.notes, 'notes')
      };
    });
  }

  // Normalize cabin images to canonical location: cruiseInfo.cabin.images
  if (tripData?.images?.cabin && Array.isArray(tripData.images.cabin)) {
    if (!tripData.cruiseInfo) tripData.cruiseInfo = {};
    if (!tripData.cruiseInfo.cabin) tripData.cruiseInfo.cabin = {};
    if (!Array.isArray(tripData.cruiseInfo.cabin.images)) {
      tripData.cruiseInfo.cabin.images = [];
    }
    // Merge images.cabin into cruiseInfo.cabin.images (deduped)
    const seen = new Set(
      tripData.cruiseInfo.cabin.images.map((img: any) => img?.urls?.original || img?.url || img).filter(Boolean)
    );
    for (const img of tripData.images.cabin) {
      const key = img?.urls?.original || img?.url || img;
      if (key && !seen.has(key)) {
        tripData.cruiseInfo.cabin.images.push(img);
        seen.add(key);
      }
    }
    // Remove the non-canonical location
    delete tripData.images.cabin;
    if (Object.keys(tripData.images).length === 0) {
      delete tripData.images;
    }
    warnings.push('Moved images.cabin to cruiseInfo.cabin.images (canonical location)');
  }

  return { data: tripData, warnings };
}

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

  // Validate and clean trip data before saving
  const { data: cleanedData, warnings } = validateAndCleanTripData(args.data);

  const fullKey = keyPrefix + args.key;
  await env.TRIPS.put(fullKey, JSON.stringify(cleanedData));
  const summary = await computeTripSummary(args.key, cleanedData);
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
    const changeDescription = cleanedData?.meta?.status || "Updated";
    const tripName = cleanedData?.meta?.clientName || cleanedData?.meta?.destination || args.key;

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

  const warningText = warnings.length > 0
    ? `\n⚠️ Data quality fixes applied:\n${warnings.map(w => `  - ${w}`).join('\n')}`
    : '';
  return {
    content: [{ type: "text", text: `Successfully saved ${args.key}${warningText}` }]
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

  // Validate and clean trip data before saving
  const { data: cleanedData, warnings } = validateAndCleanTripData(existingData);

  // Save updated trip
  await env.TRIPS.put(fullKey, JSON.stringify(cleanedData));
  const summary = await computeTripSummary(args.key, cleanedData);
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

    const changeDescription = cleanedData?.meta?.status || `Updated: ${updatedFields.join(', ')}`;
    const tripName = cleanedData?.meta?.clientName || cleanedData?.meta?.destination || args.key;

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

  const warningText = warnings.length > 0
    ? `\n⚠️ Data quality fixes applied:\n${warnings.map(w => `  - ${w}`).join('\n')}`
    : '';
  return {
    content: [{ type: "text", text: `Patched ${args.key}: updated ${updatedFields.join(', ')}${warningText}` }]
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
