/**
 * MCP Tool Handlers: Sample Trip Management
 * Handles: accept_sample_trips, decline_sample_trips
 *
 * Sample trips are pre-built trip examples stored in KV under _samples/ prefix.
 * They are offered to new users on first login to help them understand the system.
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';
import { addToTripIndex } from '../../lib/kv';
import { computeTripSummary, writeTripSummary } from '../../lib/trip-summary';

// Available sample trips
const SAMPLE_TRIPS = [
  {
    id: 'europe-romantic-7day',
    name: 'Paris & Rome Romantic Getaway',
    description: '7-day trip for 2 adults with iconic attractions, guided tours, and hidden gems',
    travelers: '2 adults',
    type: 'land'
  },
  {
    id: 'caribbean-cruise-family',
    name: 'Caribbean Family Cruise Adventure',
    description: '7-night Western Caribbean cruise for family of 4 with sea day tips and port strategies',
    travelers: '2 adults, 1 teen, 1 child',
    type: 'cruise'
  }
];

/**
 * Get list of available sample trips
 */
export const handleListSampleTrips: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const samples = [];

  for (const sample of SAMPLE_TRIPS) {
    // Check if sample exists in KV
    const sampleData = await env.TRIPS.get(`_samples/${sample.id}`, "json");
    if (sampleData) {
      samples.push({
        id: sample.id,
        name: sample.name,
        description: sample.description,
        travelers: sample.travelers,
        type: sample.type
      });
    }
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        availableSamples: samples,
        instruction: "Use accept_sample_trips to copy selected samples to user's account, or decline_sample_trips to skip."
      }, null, 2)
    }]
  };
};

/**
 * Accept and copy sample trips to user's account
 */
export const handleAcceptSampleTrips: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const tripIds = args.tripIds as string[];

  if (!Array.isArray(tripIds) || tripIds.length === 0) {
    throw new Error("tripIds must be a non-empty array of sample trip IDs");
  }

  // Validate all requested trips exist
  const validIds = SAMPLE_TRIPS.map(s => s.id);
  for (const id of tripIds) {
    if (!validIds.includes(id)) {
      throw new Error(`Unknown sample trip: ${id}. Available: ${validIds.join(', ')}`);
    }
  }

  const copied: string[] = [];
  const errors: string[] = [];

  for (const tripId of tripIds) {
    try {
      // Get sample from KV
      const sampleData = await env.TRIPS.get(`_samples/${tripId}`, "json") as any;
      if (!sampleData) {
        errors.push(`${tripId}: Sample not found in KV`);
        continue;
      }

      // Create a copy with updated metadata
      const now = new Date().toISOString();
      const userTripId = `sample-${tripId}`;
      const tripCopy = {
        ...sampleData,
        meta: {
          ...sampleData.meta,
          tripId: userTripId,
          copiedFromSample: tripId,
          copiedAt: now,
          lastModified: now,
          status: "Sample trip - customize for your client"
        }
      };

      // Save to user's space
      await env.TRIPS.put(keyPrefix + userTripId, JSON.stringify(tripCopy));

      // Update trip index
      await addToTripIndex(env, keyPrefix, userTripId);

      // Compute and store summary
      const summary = await computeTripSummary(userTripId, tripCopy);
      await writeTripSummary(env, keyPrefix, userTripId, summary, ctx);

      copied.push(userTripId);
    } catch (err) {
      errors.push(`${tripId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Update user profile to mark samples as offered
  if (userProfile) {
    const userId = userProfile.userId;
    const updatedProfile = {
      ...userProfile,
      sampleTripsOffered: true
    };
    await env.TRIPS.put(`_users/${userId}`, JSON.stringify(updatedProfile));
  }

  // Update activity log
  const activityLogKey = keyPrefix + "_activity-log";
  const activityLog = await env.TRIPS.get(activityLogKey, "json") as any || {
    lastSession: null,
    recentChanges: [],
    openItems: [],
    tripsActive: []
  };

  const now = new Date().toISOString();
  for (const tripId of copied) {
    activityLog.recentChanges.unshift({
      tripId,
      tripName: `Sample: ${tripId.replace('sample-', '')}`,
      change: "Added from samples",
      timestamp: now
    });
    if (!activityLog.tripsActive.includes(tripId)) {
      activityLog.tripsActive.push(tripId);
    }
  }

  if (activityLog.recentChanges.length > 20) {
    activityLog.recentChanges = activityLog.recentChanges.slice(0, 20);
  }
  activityLog.lastSession = now;
  await env.TRIPS.put(activityLogKey, JSON.stringify(activityLog));

  const result: any = {
    success: true,
    copied,
    message: `Added ${copied.length} sample trip(s) to your account: ${copied.join(', ')}`
  };

  if (errors.length > 0) {
    result.errors = errors;
  }

  result.nextSteps = [
    "Use read_trip to view the full trip details",
    "Use patch_trip or save_trip to customize for your client",
    "Rename the trip by updating meta.tripId and meta.clientName"
  ];

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};

/**
 * Decline sample trips - just marks that samples were offered
 */
export const handleDeclineSampleTrips: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  // Update user profile to mark samples as offered (even though declined)
  if (userProfile) {
    const userId = userProfile.userId;
    const updatedProfile = {
      ...userProfile,
      sampleTripsOffered: true
    };
    await env.TRIPS.put(`_users/${userId}`, JSON.stringify(updatedProfile));
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: "Sample trips declined. You can always ask to see samples later by saying 'show me sample trips'.",
        nextSteps: [
          "Say 'new trip' to start planning a fresh trip",
          "Say 'show me sample trips' if you change your mind"
        ]
      }, null, 2)
    }]
  };
};

/**
 * Get sample trip offer info for get_context
 * Returns offer details if user hasn't been offered samples yet and has no trips
 */
export async function getSampleTripOffer(
  env: Env,
  keyPrefix: string,
  userProfile: UserProfile | null,
  tripCount: number
): Promise<{ shouldOffer: boolean; samples?: typeof SAMPLE_TRIPS }> {
  // Don't offer if:
  // 1. User already has trips
  // 2. Sample trips already offered (accepted or declined)
  if (tripCount > 0) {
    return { shouldOffer: false };
  }

  if (userProfile?.sampleTripsOffered) {
    return { shouldOffer: false };
  }

  // Check that at least one sample exists in KV
  let hasAnySample = false;
  for (const sample of SAMPLE_TRIPS) {
    const exists = await env.TRIPS.get(`_samples/${sample.id}`, "json");
    if (exists) {
      hasAnySample = true;
      break;
    }
  }

  if (!hasAnySample) {
    return { shouldOffer: false };
  }

  return {
    shouldOffer: true,
    samples: SAMPLE_TRIPS
  };
}

/**
 * Auto-import sample trips for a new user
 * This is called during get_context for brand new users
 */
export async function autoImportSampleTrips(
  env: Env,
  keyPrefix: string,
  userProfile: UserProfile | null,
  ctx?: ExecutionContext
): Promise<{ imported: string[]; alreadyHadTrips: boolean }> {
  // Check if user already has trips
  const tripIndex = await env.TRIPS.get(`${keyPrefix}_trip-index`, "json") as string[] | null;
  if (tripIndex && tripIndex.length > 0) {
    return { imported: [], alreadyHadTrips: true };
  }

  // Check if samples were already offered/imported
  if (userProfile?.sampleTripsOffered) {
    return { imported: [], alreadyHadTrips: false };
  }

  const imported: string[] = [];
  const now = new Date().toISOString();

  for (const sample of SAMPLE_TRIPS) {
    try {
      const sampleData = await env.TRIPS.get(`_samples/${sample.id}`, "json") as any;
      if (!sampleData) continue;

      const userTripId = `sample-${sample.id}`;
      const tripCopy = {
        ...sampleData,
        meta: {
          ...sampleData.meta,
          tripId: userTripId,
          copiedFromSample: sample.id,
          copiedAt: now,
          lastModified: now,
          status: "Sample trip - view to explore, or delete and start your own!"
        }
      };

      // Save to user's space
      await env.TRIPS.put(keyPrefix + userTripId, JSON.stringify(tripCopy));

      // Update trip index
      await addToTripIndex(env, keyPrefix, userTripId);

      // Compute and store summary
      const summary = await computeTripSummary(userTripId, tripCopy);
      await writeTripSummary(env, keyPrefix, userTripId, summary, ctx);

      imported.push(userTripId);
    } catch (err) {
      console.error(`Failed to auto-import sample ${sample.id}:`, err);
    }
  }

  // Mark samples as offered
  if (userProfile) {
    const userId = userProfile.userId;
    const updatedProfile = {
      ...userProfile,
      sampleTripsOffered: true,
      onboarding: {
        ...userProfile.onboarding,
        samplesAutoImported: true,
        samplesImportedAt: now
      }
    };
    await env.TRIPS.put(`_users/${userId}`, JSON.stringify(updatedProfile));
  }

  return { imported, alreadyHadTrips: false };
}

/**
 * Clear/delete sample trips from a user's account
 */
export const handleClearSampleTrips: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  // Get trip index
  const tripIndex = await env.TRIPS.get(`${keyPrefix}_trip-index`, "json") as string[] | null;
  if (!tripIndex || tripIndex.length === 0) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: "No trips to clear. You're ready to start fresh!",
          deletedCount: 0
        }, null, 2)
      }]
    };
  }

  // Find and delete sample trips (those starting with "sample-")
  const sampleTrips = tripIndex.filter(id => id.startsWith('sample-'));
  const deletedTrips: string[] = [];

  for (const tripId of sampleTrips) {
    try {
      // Delete trip data
      await env.TRIPS.delete(`${keyPrefix}${tripId}`);

      // Delete summary
      await env.TRIPS.delete(`${keyPrefix}_summaries/${tripId}`);

      deletedTrips.push(tripId);
    } catch (err) {
      console.error(`Failed to delete sample trip ${tripId}:`, err);
    }
  }

  // Update trip index
  const remainingTrips = tripIndex.filter(id => !id.startsWith('sample-'));
  await env.TRIPS.put(`${keyPrefix}_trip-index`, JSON.stringify(remainingTrips));

  // Update activity log
  const activityLogKey = keyPrefix + "_activity-log";
  const activityLog = await env.TRIPS.get(activityLogKey, "json") as any || {
    lastSession: null,
    recentChanges: [],
    openItems: [],
    tripsActive: []
  };

  activityLog.recentChanges.unshift({
    tripId: null,
    tripName: "Sample trips cleared",
    change: `Removed ${deletedTrips.length} sample trip(s)`,
    timestamp: new Date().toISOString()
  });

  // Remove sample trips from active list
  activityLog.tripsActive = activityLog.tripsActive.filter((id: string) => !id.startsWith('sample-'));

  if (activityLog.recentChanges.length > 20) {
    activityLog.recentChanges = activityLog.recentChanges.slice(0, 20);
  }
  activityLog.lastSession = new Date().toISOString();
  await env.TRIPS.put(activityLogKey, JSON.stringify(activityLog));

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: `Cleared ${deletedTrips.length} sample trip(s). You're ready to start fresh!`,
        deletedCount: deletedTrips.length,
        deletedTrips,
        remainingTrips: remainingTrips.length,
        nextSteps: [
          "Say 'new trip' to create your first real trip",
          "Say 'my trips' to see your trip list"
        ]
      }, null, 2)
    }]
  };
};
