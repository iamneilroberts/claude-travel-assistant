/**
 * Admin trip action handlers
 * Handles: toggle-test, archive, delete, copy, rename, move
 * All operations work on any user's trips via userId parameter
 */

import type { Env, RouteHandler } from '../../types';
import { computeTripSummary, writeTripSummary, deleteTripSummary } from '../../lib/trip-summary';
import { addPendingTripDeletion, addToTripIndex, removeFromTripIndex } from '../../lib/kv';
import { validateTripId } from '../../lib/validation';

/**
 * Handle toggle test status for a trip
 * POST /admin/trips/:userId/:tripId/toggle-test
 */
export const handleAdminToggleTest: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/trips\/([^/]+)\/([^/]+)\/toggle-test$/);
  if (!match || request.method !== 'POST') return null;

  const userId = match[1];
  const tripId = match[2];

  try {
    validateTripId(tripId);

    const keyPrefix = userId + '/';
    const tripKey = `${keyPrefix}${tripId}`;

    const tripData = await env.TRIPS.get(tripKey, 'json') as any;
    if (!tripData) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!tripData.meta) tripData.meta = {};
    tripData.meta.isTest = !tripData.meta.isTest;
    tripData.meta.lastModified = new Date().toISOString();

    await env.TRIPS.put(tripKey, JSON.stringify(tripData));

    const summary = await computeTripSummary(tripId, tripData);
    await writeTripSummary(env, keyPrefix, tripId, summary, ctx);

    return new Response(JSON.stringify({
      success: true,
      isTest: tripData.meta.isTest
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Admin toggle test error:', err);
    return new Response(JSON.stringify({ error: 'Failed to toggle test status' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Handle archive/unarchive trip
 * POST /admin/trips/:userId/:tripId/archive
 */
export const handleAdminArchive: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/trips\/([^/]+)\/([^/]+)\/archive$/);
  if (!match || request.method !== 'POST') return null;

  const userId = match[1];
  const tripId = match[2];

  try {
    validateTripId(tripId);

    const keyPrefix = userId + '/';
    const tripKey = `${keyPrefix}${tripId}`;

    const tripData = await env.TRIPS.get(tripKey, 'json') as any;
    if (!tripData) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!tripData.meta) tripData.meta = {};
    tripData.meta.isArchived = !tripData.meta.isArchived;
    tripData.meta.lastModified = new Date().toISOString();

    await env.TRIPS.put(tripKey, JSON.stringify(tripData));

    const summary = await computeTripSummary(tripId, tripData);
    await writeTripSummary(env, keyPrefix, tripId, summary, ctx);

    return new Response(JSON.stringify({
      success: true,
      isArchived: tripData.meta.isArchived
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Admin archive error:', err);
    return new Response(JSON.stringify({ error: 'Failed to archive trip' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Handle delete trip
 * POST /admin/trips/:userId/:tripId/delete
 */
export const handleAdminDelete: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/trips\/([^/]+)\/([^/]+)\/delete$/);
  if (!match || request.method !== 'POST') return null;

  const userId = match[1];
  const tripId = match[2];

  try {
    validateTripId(tripId);

    const keyPrefix = userId + '/';
    const tripKey = `${keyPrefix}${tripId}`;

    const tripData = await env.TRIPS.get(tripKey, 'json');
    if (!tripData) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await env.TRIPS.delete(tripKey);
    await deleteTripSummary(env, keyPrefix, tripId, ctx);
    await addPendingTripDeletion(env, keyPrefix, tripId, ctx);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Admin delete error:', err);
    return new Response(JSON.stringify({ error: 'Failed to delete trip' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Handle copy trip
 * POST /admin/trips/:userId/:tripId/copy
 */
export const handleAdminCopy: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/trips\/([^/]+)\/([^/]+)\/copy$/);
  if (!match || request.method !== 'POST') return null;

  const userId = match[1];
  const tripId = match[2];

  try {
    validateTripId(tripId);

    const body = await request.json() as { newName?: string };
    const keyPrefix = userId + '/';
    const tripKey = `${keyPrefix}${tripId}`;

    const tripData = await env.TRIPS.get(tripKey, 'json') as any;
    if (!tripData) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const newTripId = `${tripId}-copy-${Date.now().toString(36)}`;
    const newTripData = {
      ...tripData,
      meta: {
        ...tripData.meta,
        tripId: newTripId,
        clientName: body.newName || `${tripData.meta?.clientName || tripId} (Copy)`,
        lastModified: new Date().toISOString(),
        publishedAt: undefined,
        publishedUrl: undefined,
        filename: undefined
      }
    };

    delete newTripData.meta.isTest;
    delete newTripData.meta.isArchived;

    const newTripKey = `${keyPrefix}${newTripId}`;
    await env.TRIPS.put(newTripKey, JSON.stringify(newTripData));
    await addToTripIndex(env, keyPrefix, newTripId);

    const summary = await computeTripSummary(newTripId, newTripData);
    await writeTripSummary(env, keyPrefix, newTripId, summary, ctx);

    return new Response(JSON.stringify({
      success: true,
      newTripId,
      newName: newTripData.meta.clientName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Admin copy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to copy trip' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Handle rename trip
 * POST /admin/trips/:userId/:tripId/rename
 */
export const handleAdminRename: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/trips\/([^/]+)\/([^/]+)\/rename$/);
  if (!match || request.method !== 'POST') return null;

  const userId = match[1];
  const tripId = match[2];

  try {
    validateTripId(tripId);

    const body = await request.json() as { newName: string };
    if (!body.newName?.trim()) {
      return new Response(JSON.stringify({ error: 'New name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const keyPrefix = userId + '/';
    const tripKey = `${keyPrefix}${tripId}`;

    const tripData = await env.TRIPS.get(tripKey, 'json') as any;
    if (!tripData) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!tripData.meta) tripData.meta = {};
    tripData.meta.clientName = body.newName.trim();
    tripData.meta.lastModified = new Date().toISOString();

    await env.TRIPS.put(tripKey, JSON.stringify(tripData));

    const summary = await computeTripSummary(tripId, tripData);
    await writeTripSummary(env, keyPrefix, tripId, summary, ctx);

    return new Response(JSON.stringify({
      success: true,
      newName: tripData.meta.clientName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Admin rename error:', err);
    return new Response(JSON.stringify({ error: 'Failed to rename trip' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Handle move trip between users (two-phase for data integrity)
 * POST /admin/trips/move
 */
export const handleAdminMoveTrip: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/trips/move' || request.method !== 'POST') return null;

  const body = await request.json() as {
    sourceUserId: string;
    tripId: string;
    targetUserId: string;
  };

  if (!body.sourceUserId || !body.tripId || !body.targetUserId) {
    return new Response(JSON.stringify({ error: 'sourceUserId, tripId, and targetUserId are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (body.sourceUserId === body.targetUserId) {
    return new Response(JSON.stringify({ error: 'Source and target users must be different' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    validateTripId(body.tripId);

    const sourceKeyPrefix = body.sourceUserId + '/';
    const targetKeyPrefix = body.targetUserId + '/';
    const sourceTripKey = `${sourceKeyPrefix}${body.tripId}`;
    const targetTripKey = `${targetKeyPrefix}${body.tripId}`;

    // Verify source trip exists
    const tripData = await env.TRIPS.get(sourceTripKey, 'json') as any;
    if (!tripData) {
      return new Response(JSON.stringify({ error: 'Source trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify target user exists
    const targetUser = await env.TRIPS.get(`_users/${body.targetUserId}`, 'json');
    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if trip already exists at target
    const existingAtTarget = await env.TRIPS.get(targetTripKey, 'json');
    if (existingAtTarget) {
      return new Response(JSON.stringify({ error: 'Trip with same ID already exists for target user' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Phase 1: Mark as move-pending in source
    tripData.meta = tripData.meta || {};
    tripData.meta.movePending = {
      targetUserId: body.targetUserId,
      initiatedAt: Date.now()
    };
    await env.TRIPS.put(sourceTripKey, JSON.stringify(tripData));

    // Phase 2: Write to target
    delete tripData.meta.movePending;
    tripData.meta.movedFrom = {
      userId: body.sourceUserId,
      movedAt: new Date().toISOString()
    };
    tripData.meta.lastModified = new Date().toISOString();

    await env.TRIPS.put(targetTripKey, JSON.stringify(tripData));
    await addToTripIndex(env, targetKeyPrefix, body.tripId);

    // Create summary for target
    const summary = await computeTripSummary(body.tripId, tripData);
    await writeTripSummary(env, targetKeyPrefix, body.tripId, summary, ctx);

    // Phase 3: Verify and delete source
    const verification = await env.TRIPS.get(targetTripKey, 'json');
    if (!verification) {
      // Rollback: remove movePending flag
      const rollbackData = await env.TRIPS.get(sourceTripKey, 'json') as any;
      if (rollbackData?.meta?.movePending) {
        delete rollbackData.meta.movePending;
        await env.TRIPS.put(sourceTripKey, JSON.stringify(rollbackData));
      }
      return new Response(JSON.stringify({ error: 'Move verification failed - rolled back' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete from source
    await env.TRIPS.delete(sourceTripKey);
    await deleteTripSummary(env, sourceKeyPrefix, body.tripId, ctx);
    await removeFromTripIndex(env, sourceKeyPrefix, body.tripId);

    return new Response(JSON.stringify({
      success: true,
      tripId: body.tripId,
      sourceUserId: body.sourceUserId,
      targetUserId: body.targetUserId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Admin move trip error:', err);
    return new Response(JSON.stringify({ error: 'Failed to move trip' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
