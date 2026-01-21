/**
 * Admin Routes: User Tools
 * Quick actions for resetting and managing user accounts
 * Handles: POST /admin/users/:id/reset-*, DELETE /admin/users/:id/data/*
 */

import type { Env, UserProfile, RouteHandler } from '../../types';
import { listAllKeys, getKeyPrefix, addToTripIndex } from '../../lib/kv';
import { logAdminAction } from '../../lib/audit';
import { computeTripSummary, writeTripSummary } from '../../lib/trip-summary';

// Available sample trips (matches sample-trips.ts)
const SAMPLE_TRIPS = [
  { id: 'europe-romantic-7day', name: 'Paris & Rome Romantic Getaway' },
  { id: 'caribbean-cruise-family', name: 'Caribbean Family Cruise Adventure' }
];

/**
 * Reset user to "new user" state - clears onboarding flags AND sample trips
 * POST /admin/users/:id/reset-new-user
 */
export const handleResetNewUser: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/users\/([^/]+)\/reset-new-user$/);
  if (!match || request.method !== "POST") return null;

  const userId = match[1];
  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Get the user's key prefix
  const keyPrefix = getKeyPrefix(user.authKey);

  // Clear sample trips from user's account
  const tripIndex = await env.TRIPS.get(`${keyPrefix}_trip-index`, "json") as string[] | null;
  const deletedSamples: string[] = [];

  if (tripIndex) {
    const sampleTrips = tripIndex.filter(id => id.startsWith('sample-'));
    for (const tripId of sampleTrips) {
      try {
        await env.TRIPS.delete(`${keyPrefix}${tripId}`);
        await env.TRIPS.delete(`${keyPrefix}_summaries/${tripId}`);
        deletedSamples.push(tripId);
      } catch (err) {
        console.error(`Failed to delete sample trip ${tripId}:`, err);
      }
    }

    // Update trip index to remove sample trips
    const remainingTrips = tripIndex.filter(id => !id.startsWith('sample-'));
    await env.TRIPS.put(`${keyPrefix}_trip-index`, JSON.stringify(remainingTrips));
  }

  // Reset onboarding and sample trips flags
  const updated: UserProfile = {
    ...user,
    sampleTripsOffered: false,
    onboarding: {
      welcomeShown: false
    }
  };

  await env.TRIPS.put(`_users/${userId}`, JSON.stringify(updated));

  // Log the action
  const adminKey = request.headers.get('X-Admin-Key') || '';
  await logAdminAction(env, 'reset_new_user', userId, { resetFields: ['sampleTripsOffered', 'onboarding'], deletedSamples }, adminKey, ctx);

  return new Response(JSON.stringify({
    success: true,
    message: `User reset to new user state. ${deletedSamples.length} sample trip(s) cleared.`,
    changes: ['sampleTripsOffered: false', 'onboarding.welcomeShown: false', `Deleted samples: ${deletedSamples.join(', ') || 'none'}`]
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

/**
 * Reset user branding to defaults
 * POST /admin/users/:id/reset-branding
 */
export const handleResetBranding: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/users\/([^/]+)\/reset-branding$/);
  if (!match || request.method !== "POST") return null;

  const userId = match[1];
  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Reset branding to defaults
  const updated: UserProfile = {
    ...user,
    branding: {
      colorScheme: 'ocean',
      darkMode: false,
      primaryColor: '#0077b6',
      accentColor: '#00b4d8',
      stylePreset: 'professional'
    }
  };

  await env.TRIPS.put(`_users/${userId}`, JSON.stringify(updated));

  // Log the action
  const adminKey = request.headers.get('X-Admin-Key') || '';
  await logAdminAction(env, 'reset_branding', userId, {}, adminKey, ctx);

  return new Response(JSON.stringify({
    success: true,
    message: 'Branding reset to defaults',
    newBranding: updated.branding
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

/**
 * Clear all messages/comments for a user
 * DELETE /admin/users/:id/data/messages
 */
export const handleClearMessages: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/users\/([^/]+)\/data\/messages$/);
  if (!match || request.method !== "DELETE") return null;

  const userId = match[1];
  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const keyPrefix = getKeyPrefix(user.authKey);
  let deletedCount = 0;

  // Delete trip comments (stored as {keyPrefix}{tripId}/_comments)
  const tripKeys = await listAllKeys(env, { prefix: keyPrefix });
  for (const key of tripKeys) {
    if (key.name.endsWith('/_comments')) {
      await env.TRIPS.delete(key.name);
      deletedCount++;
    }
  }

  // Delete user message threads (_messages/{userId}/*)
  const messageKeys = await listAllKeys(env, { prefix: `_messages/${userId}/` });
  for (const key of messageKeys) {
    await env.TRIPS.delete(key.name);
    deletedCount++;
  }

  // Log the action
  const adminKey = request.headers.get('X-Admin-Key') || '';
  await logAdminAction(env, 'clear_messages', userId, { deletedCount }, adminKey, ctx);

  return new Response(JSON.stringify({
    success: true,
    message: `Cleared ${deletedCount} message/comment entries`,
    deletedCount
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

/**
 * Clear all trips for a user
 * DELETE /admin/users/:id/data/trips
 */
export const handleClearTrips: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/users\/([^/]+)\/data\/trips$/);
  if (!match || request.method !== "DELETE") return null;

  const userId = match[1];
  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const keyPrefix = getKeyPrefix(user.authKey);
  let deletedCount = 0;
  const deletedTrips: string[] = [];

  // Get all keys for this user
  const allKeys = await listAllKeys(env, { prefix: keyPrefix });

  for (const key of allKeys) {
    // Delete trip data (but not _summaries or other metadata)
    const relativePath = key.name.slice(keyPrefix.length);
    // Skip system keys
    if (relativePath.startsWith('_')) continue;
    // Trip keys are like "keyPrefix/tripId" (no subdirectory)
    if (!relativePath.includes('/')) {
      deletedTrips.push(relativePath);
      await env.TRIPS.delete(key.name);
      deletedCount++;
    }
  }

  // Also delete the trip index
  await env.TRIPS.delete(`${keyPrefix}_trip-index`);

  // Delete summaries
  await env.TRIPS.delete(`${keyPrefix}_summaries`);

  // Log the action
  const adminKey = request.headers.get('X-Admin-Key') || '';
  await logAdminAction(env, 'clear_trips', userId, { deletedCount, deletedTrips }, adminKey, ctx);

  return new Response(JSON.stringify({
    success: true,
    message: `Deleted ${deletedCount} trips`,
    deletedCount,
    deletedTrips
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

/**
 * Full account reset - combines all resets
 * POST /admin/users/:id/reset-account
 */
export const handleResetAccount: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/users\/([^/]+)\/reset-account$/);
  if (!match || request.method !== "POST") return null;

  const userId = match[1];
  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const results = {
    messagesCleared: 0,
    tripsDeleted: 0,
    brandingReset: true,
    onboardingReset: true
  };

  const keyPrefix = getKeyPrefix(user.authKey);

  // 1. Clear all messages and comments
  const allKeys = await listAllKeys(env, { prefix: keyPrefix });
  for (const key of allKeys) {
    if (key.name.endsWith('/_comments')) {
      await env.TRIPS.delete(key.name);
      results.messagesCleared++;
    }
  }

  const messageKeys = await listAllKeys(env, { prefix: `_messages/${userId}/` });
  for (const key of messageKeys) {
    await env.TRIPS.delete(key.name);
    results.messagesCleared++;
  }

  // 2. Delete all trips
  for (const key of allKeys) {
    const relativePath = key.name.slice(keyPrefix.length);
    if (!relativePath.startsWith('_') && !relativePath.includes('/')) {
      await env.TRIPS.delete(key.name);
      results.tripsDeleted++;
    }
  }
  await env.TRIPS.delete(`${keyPrefix}_trip-index`);
  await env.TRIPS.delete(`${keyPrefix}_summaries`);

  // 3. Reset user profile
  const updated: UserProfile = {
    ...user,
    sampleTripsOffered: false,
    onboarding: {
      welcomeShown: false
    },
    branding: {
      colorScheme: 'ocean',
      darkMode: false,
      primaryColor: '#0077b6',
      accentColor: '#00b4d8',
      stylePreset: 'professional'
    }
  };

  await env.TRIPS.put(`_users/${userId}`, JSON.stringify(updated));

  // Log the action
  const adminKey = request.headers.get('X-Admin-Key') || '';
  await logAdminAction(env, 'reset_account', userId, results, adminKey, ctx);

  return new Response(JSON.stringify({
    success: true,
    message: 'Account fully reset to initial state',
    results
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

/**
 * Get user data summary (for admin preview before reset)
 * GET /admin/users/:id/data-summary
 */
export const handleGetDataSummary: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/users\/([^/]+)\/data-summary$/);
  if (!match || request.method !== "GET") return null;

  const userId = match[1];
  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const keyPrefix = getKeyPrefix(user.authKey);
  const allKeys = await listAllKeys(env, { prefix: keyPrefix });
  const messageKeys = await listAllKeys(env, { prefix: `_messages/${userId}/` });

  let tripCount = 0;
  let commentCount = 0;

  for (const key of allKeys) {
    const relativePath = key.name.slice(keyPrefix.length);
    if (key.name.endsWith('/_comments')) {
      commentCount++;
    } else if (!relativePath.startsWith('_') && !relativePath.includes('/')) {
      tripCount++;
    }
  }

  return new Response(JSON.stringify({
    userId,
    name: user.name,
    tripCount,
    commentCount,
    messageThreads: messageKeys.length,
    hasCustomBranding: !!(user.branding?.colorScheme && user.branding.colorScheme !== 'ocean'),
    sampleTripsOffered: user.sampleTripsOffered || false,
    welcomeShown: user.onboarding?.welcomeShown || false
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

/**
 * Add sample trips to user's account
 * POST /admin/users/:id/add-samples
 */
export const handleAddSampleTrips: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/users\/([^/]+)\/add-samples$/);
  if (!match || request.method !== "POST") return null;

  const userId = match[1];
  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const keyPrefix = getKeyPrefix(user.authKey);
  const copied: string[] = [];
  const errors: string[] = [];

  for (const sample of SAMPLE_TRIPS) {
    try {
      // Get sample from KV
      const sampleData = await env.TRIPS.get(`_samples/${sample.id}`, "json") as any;
      if (!sampleData) {
        errors.push(`${sample.id}: Sample not found in KV`);
        continue;
      }

      // Check if user already has this sample
      const userTripId = `sample-${sample.id}`;
      const existing = await env.TRIPS.get(keyPrefix + userTripId);
      if (existing) {
        errors.push(`${sample.id}: Already exists in user account`);
        continue;
      }

      // Create a copy with updated metadata
      const now = new Date().toISOString();
      const tripCopy = {
        ...sampleData,
        meta: {
          ...sampleData.meta,
          tripId: userTripId,
          copiedFromSample: sample.id,
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

      copied.push(sample.name);
    } catch (err) {
      errors.push(`${sample.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Log the action
  const adminKey = request.headers.get('X-Admin-Key') || '';
  await logAdminAction(env, 'add_sample_trips', userId, { copied, errors }, adminKey, ctx);

  return new Response(JSON.stringify({
    success: copied.length > 0,
    message: copied.length > 0
      ? `Added ${copied.length} sample trip(s): ${copied.join(', ')}`
      : 'No sample trips were added',
    copied,
    errors: errors.length > 0 ? errors : undefined
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
