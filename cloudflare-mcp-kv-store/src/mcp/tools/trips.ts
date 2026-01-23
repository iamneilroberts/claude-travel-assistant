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
  const showTestTrips = !!args?.show_test_trips;
  const showArchived = !!args?.show_archived;

  // Always get summaries for filtering (even if not returning them)
  const allSummaries = await getTripSummaries(env, keyPrefix, visibleTrips, ctx);

  // Filter based on test/archived flags
  const filteredSummaries = allSummaries.filter(summary => {
    if (!showTestTrips && summary.isTest) return false;
    if (!showArchived && summary.isArchived) return false;
    return true;
  });

  // Get filtered trip IDs
  const filteredTripIds = filteredSummaries.map(s => s.tripId);

  // Only include summaries in response if requested
  const tripSummaries = includeSummaries ? filteredSummaries : null;

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
      trips: filteredTripIds,
      ...(tripSummaries ? { tripSummaries } : {})
    };
  } else if (tripSummaries) {
    result = {
      trips: filteredTripIds,
      tripSummaries
    };
  } else {
    result = filteredTripIds;
  }

  return {
    content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

export const handleReadTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  // Accept tripId or key (backwards compatibility)
  const tripId = args.tripId || args.key;

  // Validate required parameter
  if (!tripId || typeof tripId !== 'string') {
    throw new Error("Missing required parameter 'tripId'");
  }

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
  // Accept tripId or key (backwards compatibility)
  const tripId = args.tripId || args.key;

  // Validate required parameters with clear error messages
  if (!tripId || typeof tripId !== 'string') {
    throw new Error("Missing required parameter 'tripId'. Example: save_trip({ tripId: 'my-trip-id', data: {...} })");
  }
  if (!args.data || typeof args.data !== 'object') {
    throw new Error("Missing required parameter 'data'. Provide the trip data object.");
  }

  // Security: Validate trip ID to prevent path traversal
  validateTripId(tripId);

  // Validate and clean trip data before saving
  const { data: cleanedData, warnings } = validateAndCleanTripData(args.data);

  const fullKey = keyPrefix + tripId;
  await env.TRIPS.put(fullKey, JSON.stringify(cleanedData));
  const summary = await computeTripSummary(tripId, cleanedData);
  await writeTripSummary(env, keyPrefix, tripId, summary, ctx);
  await addToTripIndex(env, keyPrefix, tripId);
  await removePendingTripDeletion(env, keyPrefix, tripId, ctx);

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
    const tripName = cleanedData?.meta?.clientName || cleanedData?.meta?.destination || tripId;

    // Add to recent changes (prepend, newest first)
    activityLog.recentChanges.unshift({
      tripId: tripId,
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
    if (!activityLog.tripsActive.includes(tripId)) {
      activityLog.tripsActive.push(tripId);
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
    content: [{ type: "text", text: `Successfully saved '${tripId}'${warningText}` }]
  };
};

export const handlePatchTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  // Accept tripId or key (backwards compatibility)
  const tripId = args.tripId || args.key;

  // Validate required parameters with clear error messages
  if (!tripId || typeof tripId !== 'string') {
    throw new Error("Missing required parameter 'tripId'. Example: patch_trip({ tripId: 'my-trip-id', updates: {...} })");
  }
  if (!args.updates || typeof args.updates !== 'object') {
    throw new Error("Missing required parameter 'updates'. Provide an object with dot-notation paths, e.g. { 'meta.status': 'confirmed' }");
  }

  // Security: Validate trip ID to prevent path traversal
  validateTripId(tripId);

  // Read existing trip
  const fullKey = keyPrefix + tripId;
  const existingData = await env.TRIPS.get(fullKey, "json") as any;
  if (!existingData) throw new Error(`Trip '${tripId}' not found.`);

  // Apply updates using dot-notation paths (supports array indexing like "itinerary[0].title")
  const updates = args.updates as Record<string, any>;
  const updatedFields: string[] = [];

  // Security limits to prevent DoS
  const MAX_UPDATES = 100;
  const MAX_PATH_DEPTH = 10;
  const MAX_ARRAY_INDEX = 10000;

  // Keys that could cause prototype pollution - must be blocked
  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  // Validate update count
  const updateEntries = Object.entries(updates);
  if (updateEntries.length > MAX_UPDATES) {
    throw new Error(`Too many updates: ${updateEntries.length} exceeds limit of ${MAX_UPDATES}`);
  }

  // Parse path into parts, handling array notation
  const parsePath = (path: string): (string | number)[] => {
    const parts: (string | number)[] = [];
    const segments = path.split('.');

    for (const segment of segments) {
      if (!segment) continue; // Skip empty segments from leading/trailing dots

      // Reject segments with unmatched or invalid bracket syntax
      if (segment.includes('[') || segment.includes(']')) {
        // Must match pattern: "key[123]" - anything else is invalid
        const bracketMatch = segment.match(/^([^\[\]]+)\[(\d+)\]$/);
        if (!bracketMatch) {
          throw new Error(`Invalid path syntax: '${segment}' - brackets must be in format 'key[index]'`);
        }
        const key = bracketMatch[1];
        if (FORBIDDEN_KEYS.has(key)) {
          throw new Error(`Invalid path: forbidden key '${key}'`);
        }
        const index = parseInt(bracketMatch[2], 10);
        // Validate index bounds
        if (!Number.isSafeInteger(index) || index < 0 || index > MAX_ARRAY_INDEX) {
          throw new Error(`Invalid array index: ${index} - must be 0-${MAX_ARRAY_INDEX}`);
        }
        parts.push(key);
        parts.push(index);
      } else {
        if (FORBIDDEN_KEYS.has(segment)) {
          throw new Error(`Invalid path: forbidden key '${segment}'`);
        }
        parts.push(segment);
      }
    }

    // Validate path depth
    if (parts.length > MAX_PATH_DEPTH) {
      throw new Error(`Path too deep: ${parts.length} exceeds limit of ${MAX_PATH_DEPTH}`);
    }

    return parts;
  };

  for (const [path, value] of updateEntries) {
    const parts = parsePath(path);
    if (parts.length === 0) continue; // Skip empty paths

    let current = existingData;

    // Navigate to parent of target field
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current[part] === undefined) {
        // Create array if next part is a number, otherwise object
        current[part] = typeof parts[i + 1] === 'number' ? [] : {};
      } else if (current[part] === null || typeof current[part] !== 'object') {
        // Can't traverse through null or primitives - overwrite with appropriate type
        current[part] = typeof parts[i + 1] === 'number' ? [] : {};
      }
      current = current[part];
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
  const summary = await computeTripSummary(tripId, cleanedData);
  await writeTripSummary(env, keyPrefix, tripId, summary, ctx);

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
    const tripName = cleanedData?.meta?.clientName || cleanedData?.meta?.destination || tripId;

    activityLog.recentChanges.unshift({
      tripId: tripId,
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
    content: [{ type: "text", text: `Patched '${tripId}': updated ${updatedFields.join(', ')}${warningText}` }]
  };
};

export const handleDeleteTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  // Accept tripId or key (backwards compatibility)
  const tripId = args.tripId || args.key;

  // Validate required parameter
  if (!tripId || typeof tripId !== 'string') {
    throw new Error("Missing required parameter 'tripId'");
  }

  // Security: Validate trip ID to prevent path traversal
  validateTripId(tripId);

  const fullKey = keyPrefix + tripId;
  await env.TRIPS.delete(fullKey);
  await deleteTripSummary(env, keyPrefix, tripId, ctx);
  await removeFromTripIndex(env, keyPrefix, tripId);
  await addPendingTripDeletion(env, keyPrefix, tripId, ctx);

  // PERFORMANCE: Move activity logging to background (don't block response)
  const activityUpdate = (async () => {
    const activityLogKey = keyPrefix + "_activity-log";
    const activityLog = await env.TRIPS.get(activityLogKey, "json") as any;
    if (activityLog?.tripsActive) {
      activityLog.tripsActive = activityLog.tripsActive.filter((t: string) => t !== tripId);
      activityLog.recentChanges.unshift({
        tripId: tripId,
        tripName: tripId,
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
  const commentCleanup = removeFromCommentIndex(env, keyPrefix, tripId);

  if (ctx) {
    ctx.waitUntil(activityUpdate);
    ctx.waitUntil(commentCleanup);
  } else {
    await Promise.all([activityUpdate, commentCleanup]);
  }

  return {
    content: [{ type: "text", text: `Deleted '${tripId}'` }]
  };
};

/**
 * Summarize group trip travelers for easy management
 * Returns headcount, age breakdown, dietary restrictions, room suggestions
 */
export const handleSummarizeGroup: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const tripId = args.tripId;

  if (!tripId || typeof tripId !== 'string') {
    throw new Error("Missing required parameter 'tripId'");
  }

  validateTripId(tripId);

  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json") as any;
  if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

  const travelers = tripData.travelers?.list || tripData.travelers?.travelers || [];

  if (travelers.length === 0) {
    return {
      content: [{ type: "text", text: JSON.stringify({
        tripId,
        message: "No travelers found. Add travelers to the trip first.",
        suggestion: "Use patch_trip to add travelers: { 'travelers.list': [...] }"
      }, null, 2) }]
    };
  }

  // Headcount
  const totalCount = travelers.length;
  const adults = travelers.filter((t: any) => !t.age || t.age >= 18).length;
  const minors = travelers.filter((t: any) => t.age && t.age < 18).length;
  const children = travelers.filter((t: any) => t.age && t.age < 13).length;

  // Age breakdown
  const ageGroups: Record<string, number> = {
    'infants (0-2)': 0,
    'children (3-12)': 0,
    'teens (13-17)': 0,
    'adults (18-64)': 0,
    'seniors (65+)': 0,
    'age unknown': 0
  };

  for (const t of travelers) {
    const age = t.age;
    if (age === undefined || age === null) ageGroups['age unknown']++;
    else if (age <= 2) ageGroups['infants (0-2)']++;
    else if (age <= 12) ageGroups['children (3-12)']++;
    else if (age <= 17) ageGroups['teens (13-17)']++;
    else if (age <= 64) ageGroups['adults (18-64)']++;
    else ageGroups['seniors (65+)']++;
  }

  // Remove empty age groups
  for (const key of Object.keys(ageGroups)) {
    if (ageGroups[key] === 0) delete ageGroups[key];
  }

  // Dietary restrictions
  const dietaryRestrictions: { traveler: string; restrictions: string[] }[] = [];
  const dietarySummary: Record<string, number> = {};

  for (const t of travelers) {
    const name = t.name || t.firstName || 'Unknown';
    const dietary = t.dietary || t.dietaryRestrictions || t.diet || [];
    const restrictions = Array.isArray(dietary) ? dietary : (dietary ? [dietary] : []);

    if (restrictions.length > 0) {
      dietaryRestrictions.push({ traveler: name, restrictions });
      for (const r of restrictions) {
        dietarySummary[r] = (dietarySummary[r] || 0) + 1;
      }
    }
  }

  // Special needs / medical
  const specialNeeds: { traveler: string; needs: string }[] = [];
  for (const t of travelers) {
    const name = t.name || t.firstName || 'Unknown';
    const needs = t.specialNeeds || t.medical || t.mobility || t.accessibility;
    if (needs) {
      specialNeeds.push({ traveler: name, needs: String(needs) });
    }
  }

  // Room assignment suggestions (for groups)
  let roomSuggestions: string[] = [];
  if (totalCount >= 4) {
    const adultCount = adults;
    const minorCount = minors;

    if (minorCount > 0) {
      // Family/group with minors
      const chaperoneRatio = Math.ceil(minorCount / 4); // 1 adult per 4 minors
      roomSuggestions.push(`Suggested chaperone ratio: ${chaperoneRatio} adult(s) per room with minors`);
      roomSuggestions.push(`Quad rooms needed for minors: ${Math.ceil(minorCount / 4)}`);
      roomSuggestions.push(`Rooms needed for adult chaperones: ${Math.ceil(chaperoneRatio / 2)}`);
    }

    if (adultCount >= 4) {
      roomSuggestions.push(`Adult double rooms: ${Math.ceil(adultCount / 2)}`);
    }

    roomSuggestions.push(`Total estimated rooms: ${Math.ceil(totalCount / 2)} (doubles) or ${Math.ceil(totalCount / 4)} (quads)`);
  }

  // Build summary
  const summary = {
    tripId,
    tripName: tripData.meta?.clientName || tripData.meta?.destination || tripId,
    headcount: {
      total: totalCount,
      adults,
      minors,
      children
    },
    ageBreakdown: ageGroups,
    dietaryRestrictions: dietaryRestrictions.length > 0 ? {
      summary: dietarySummary,
      byTraveler: dietaryRestrictions
    } : null,
    specialNeeds: specialNeeds.length > 0 ? specialNeeds : null,
    roomSuggestions: roomSuggestions.length > 0 ? roomSuggestions : null,
    travelerList: travelers.map((t: any) => ({
      name: t.name || t.firstName || 'Unknown',
      age: t.age || null,
      role: t.role || (t.age && t.age < 18 ? 'minor' : 'adult'),
      dietary: t.dietary || t.dietaryRestrictions || null,
      notes: t.notes || t.specialNeeds || null
    }))
  };

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(summary), null, 2) }]
  };
};
