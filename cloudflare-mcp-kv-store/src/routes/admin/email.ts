/**
 * Admin email helpers
 * Generates Gmail compose URLs for emailing users
 */

import type { RouteHandler, UserProfile } from '../../types';

/**
 * Build Gmail compose URL with pre-filled fields
 */
export function buildGmailComposeUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({
    view: 'cm',
    to,
    su: subject,
    body
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/**
 * Handle email user request - returns Gmail compose URL
 * GET /admin/users/:userId/email-url
 */
export const handleGetEmailUrl: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/users\/([^/]+)\/email-url$/);
  if (!match || request.method !== 'GET') return null;

  const userId = match[1];

  // Get user profile to get email
  const userProfile = await env.TRIPS.get(`_users/${userId}`, 'json') as UserProfile | null;
  if (!userProfile) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!userProfile.email) {
    return new Response(JSON.stringify({ error: 'User has no email address' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get optional subject and body from query params
  const subject = url.searchParams.get('subject') || '';
  const body = url.searchParams.get('body') || '';

  const gmailUrl = buildGmailComposeUrl(userProfile.email, subject, body);

  return new Response(JSON.stringify({
    success: true,
    userId,
    email: userProfile.email,
    gmailComposeUrl: gmailUrl
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * Handle email user about a trip - returns Gmail compose URL with trip context
 * GET /admin/trips/:userId/:tripId/email-url
 */
export const handleGetTripEmailUrl: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/trips\/([^/]+)\/([^/]+)\/email-url$/);
  if (!match || request.method !== 'GET') return null;

  const userId = match[1];
  const tripId = match[2];

  // Get user profile
  const userProfile = await env.TRIPS.get(`_users/${userId}`, 'json') as UserProfile | null;
  if (!userProfile) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!userProfile.email) {
    return new Response(JSON.stringify({ error: 'User has no email address' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get trip data for context
  const tripKey = `${userId}/${tripId}`;
  const tripData = await env.TRIPS.get(tripKey, 'json') as any;
  const tripName = tripData?.meta?.clientName || tripData?.meta?.destination || tripId;

  // Build default subject and body
  const subject = url.searchParams.get('subject') || `Regarding your trip: ${tripName}`;
  const body = url.searchParams.get('body') || `Hi ${userProfile.name || 'there'},\n\nI wanted to reach out about your trip "${tripName}".\n\n`;

  const gmailUrl = buildGmailComposeUrl(userProfile.email, subject, body);

  return new Response(JSON.stringify({
    success: true,
    userId,
    tripId,
    tripName,
    email: userProfile.email,
    gmailComposeUrl: gmailUrl
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};
