/**
 * Trip action handlers for user dashboard
 * Handles: toggle-test, archive, delete, copy, rename
 */

import type { Env, UserProfile } from '../../types';
import { Session, validateCsrfToken, validateRequestOrigin } from '../../lib/session';
import { computeTripSummary, writeTripSummary, deleteTripSummary } from '../../lib/trip-summary';
import { addPendingTripDeletion, addToTripIndex } from '../../lib/kv';
import { validateTripId } from '../../lib/validation';

/**
 * Validate CSRF and origin for POST requests
 */
async function validatePostRequest(
  request: Request,
  session: Session,
  subdomain: string
): Promise<{ valid: boolean; error?: string; formData?: FormData }> {
  // Validate origin/referer
  const expectedHost = `${subdomain}.voygent.ai`;
  if (!validateRequestOrigin(request, expectedHost)) {
    return { valid: false, error: 'Invalid request origin' };
  }

  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return { valid: false, error: 'Invalid form data' };
  }

  // Validate CSRF token
  const csrfToken = formData.get('_csrf') as string | null;
  if (!validateCsrfToken(session, csrfToken)) {
    return { valid: false, error: 'Invalid or missing CSRF token' };
  }

  return { valid: true, formData };
}

/**
 * Handle toggle test status
 * POST /admin/trips/:tripId/toggle-test
 */
export async function handleToggleTest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  tripId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Validate request
  const validation = await validatePostRequest(request, session, subdomain);
  if (!validation.valid) {
    return new Response(validation.error, { status: 403, headers: corsHeaders });
  }

  try {
    // Validate trip ID
    validateTripId(tripId);

    const keyPrefix = userProfile.userId + '/';
    const tripKey = `${keyPrefix}${tripId}`;

    // Load trip
    const tripData = await env.TRIPS.get(tripKey, 'json') as any;
    if (!tripData) {
      return new Response('Trip not found', { status: 404, headers: corsHeaders });
    }

    // Toggle isTest
    if (!tripData.meta) tripData.meta = {};
    tripData.meta.isTest = !tripData.meta.isTest;
    tripData.meta.lastModified = new Date().toISOString();

    // Save trip
    await env.TRIPS.put(tripKey, JSON.stringify(tripData));

    // Update summary
    const summary = await computeTripSummary(tripId, tripData);
    await writeTripSummary(env, keyPrefix, tripId, summary, ctx);

    // Redirect back to trips page
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/trips`, 302);
  } catch (err) {
    console.error('Toggle test error:', err);
    return new Response('Failed to toggle test status', { status: 500, headers: corsHeaders });
  }
}

/**
 * Handle archive/unarchive trip
 * POST /admin/trips/:tripId/archive
 */
export async function handleArchive(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  tripId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Validate request
  const validation = await validatePostRequest(request, session, subdomain);
  if (!validation.valid) {
    return new Response(validation.error, { status: 403, headers: corsHeaders });
  }

  try {
    // Validate trip ID
    validateTripId(tripId);

    const keyPrefix = userProfile.userId + '/';
    const tripKey = `${keyPrefix}${tripId}`;

    // Load trip
    const tripData = await env.TRIPS.get(tripKey, 'json') as any;
    if (!tripData) {
      return new Response('Trip not found', { status: 404, headers: corsHeaders });
    }

    // Toggle isArchived
    if (!tripData.meta) tripData.meta = {};
    tripData.meta.isArchived = !tripData.meta.isArchived;
    tripData.meta.lastModified = new Date().toISOString();

    // Save trip
    await env.TRIPS.put(tripKey, JSON.stringify(tripData));

    // Update summary
    const summary = await computeTripSummary(tripId, tripData);
    await writeTripSummary(env, keyPrefix, tripId, summary, ctx);

    // Redirect back to trips page
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/trips`, 302);
  } catch (err) {
    console.error('Archive error:', err);
    return new Response('Failed to archive trip', { status: 500, headers: corsHeaders });
  }
}

/**
 * Handle delete trip (soft delete via pending deletion)
 * POST /admin/trips/:tripId/delete
 */
export async function handleDelete(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  tripId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Validate request
  const validation = await validatePostRequest(request, session, subdomain);
  if (!validation.valid) {
    return new Response(validation.error, { status: 403, headers: corsHeaders });
  }

  try {
    // Validate trip ID
    validateTripId(tripId);

    const keyPrefix = userProfile.userId + '/';
    const tripKey = `${keyPrefix}${tripId}`;

    // Verify trip exists
    const tripData = await env.TRIPS.get(tripKey, 'json');
    if (!tripData) {
      return new Response('Trip not found', { status: 404, headers: corsHeaders });
    }

    // Delete trip
    await env.TRIPS.delete(tripKey);

    // Delete summary
    await deleteTripSummary(env, keyPrefix, tripId, ctx);

    // Add to pending deletions (for MCP sync)
    await addPendingTripDeletion(env, keyPrefix, tripId, ctx);

    // Redirect back to trips page
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/trips`, 302);
  } catch (err) {
    console.error('Delete error:', err);
    return new Response('Failed to delete trip', { status: 500, headers: corsHeaders });
  }
}

/**
 * Handle copy trip
 * POST /admin/trips/:tripId/copy
 */
export async function handleCopy(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  tripId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Validate request
  const validation = await validatePostRequest(request, session, subdomain);
  if (!validation.valid) {
    return new Response(validation.error, { status: 403, headers: corsHeaders });
  }

  try {
    // Validate trip ID
    validateTripId(tripId);

    const keyPrefix = userProfile.userId + '/';
    const tripKey = `${keyPrefix}${tripId}`;

    // Load source trip
    const tripData = await env.TRIPS.get(tripKey, 'json') as any;
    if (!tripData) {
      return new Response('Trip not found', { status: 404, headers: corsHeaders });
    }

    // Get new name from form
    const newName = validation.formData?.get('newName') as string;

    // Generate new trip ID
    const newTripId = `${tripId}-copy-${Date.now().toString(36)}`;

    // Create copy with new ID and cleared publish state
    const newTripData = {
      ...tripData,
      meta: {
        ...tripData.meta,
        tripId: newTripId,
        clientName: newName || `${tripData.meta?.clientName || tripId} (Copy)`,
        lastModified: new Date().toISOString(),
        // Clear publish-related fields
        publishedAt: undefined,
        publishedUrl: undefined,
        filename: undefined
      }
    };

    // Clear test/archived status on copy
    delete newTripData.meta.isTest;
    delete newTripData.meta.isArchived;

    // Save new trip
    const newTripKey = `${keyPrefix}${newTripId}`;
    await env.TRIPS.put(newTripKey, JSON.stringify(newTripData));

    // Add to trip index
    await addToTripIndex(env, keyPrefix, newTripId);

    // Create summary for new trip
    const summary = await computeTripSummary(newTripId, newTripData);
    await writeTripSummary(env, keyPrefix, newTripId, summary, ctx);

    // Redirect back to trips page
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/trips`, 302);
  } catch (err) {
    console.error('Copy error:', err);
    return new Response('Failed to copy trip', { status: 500, headers: corsHeaders });
  }
}

/**
 * Handle rename trip
 * POST /admin/trips/:tripId/rename
 */
export async function handleRename(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  tripId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Validate request
  const validation = await validatePostRequest(request, session, subdomain);
  if (!validation.valid) {
    return new Response(validation.error, { status: 403, headers: corsHeaders });
  }

  try {
    // Validate trip ID
    validateTripId(tripId);

    // Get new name
    const newName = validation.formData?.get('newName') as string;
    if (!newName || !newName.trim()) {
      return new Response('New name is required', { status: 400, headers: corsHeaders });
    }

    const keyPrefix = userProfile.userId + '/';
    const tripKey = `${keyPrefix}${tripId}`;

    // Load trip
    const tripData = await env.TRIPS.get(tripKey, 'json') as any;
    if (!tripData) {
      return new Response('Trip not found', { status: 404, headers: corsHeaders });
    }

    // Update name
    if (!tripData.meta) tripData.meta = {};
    tripData.meta.clientName = newName.trim();
    tripData.meta.lastModified = new Date().toISOString();

    // Save trip
    await env.TRIPS.put(tripKey, JSON.stringify(tripData));

    // Update summary
    const summary = await computeTripSummary(tripId, tripData);
    await writeTripSummary(env, keyPrefix, tripId, summary, ctx);

    // Redirect back to trips page
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/trips`, 302);
  } catch (err) {
    console.error('Rename error:', err);
    return new Response('Failed to rename trip', { status: 500, headers: corsHeaders });
  }
}
