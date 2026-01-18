/**
 * User dashboard routes for subdomain
 * Handles authentication and dashboard pages
 */

import type { Env, UserProfile } from '../../types';
import {
  createSession,
  validateSessionCookie,
  deleteSession,
  createSessionCookie,
  clearSessionCookie,
  Session
} from '../../lib/session';
import {
  createMagicLink,
  validateMagicLink,
  buildMagicLinkUrl,
  checkMagicLinkRateLimit
} from '../../lib/magic-link';
import { listPublishedTrips } from '../../lib/published';
import { getUserStats, getTripStats } from '../../lib/stats';
import { getCommentIndex } from '../../lib/kv';
import {
  getLoginPageHtml,
  getDashboardHomeHtml,
  getTripsPageHtml,
  getCommentsPageHtml,
  getSettingsPageHtml,
  getMagicLinkSentHtml
} from '../../user-dashboard-pages';
import { getMonthlyUsage } from '../../lib/usage';

/**
 * Handle all dashboard routes for a user subdomain
 */
export async function handleUserDashboard(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  userProfile: UserProfile,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const path = url.pathname;
  const method = request.method;

  // === Public routes (no auth required) ===

  // Login page
  if (path === '/admin/login' && method === 'GET') {
    return new Response(getLoginPageHtml(subdomain, userProfile), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
    });
  }

  // Handle login form submission
  if (path === '/admin/login' && method === 'POST') {
    return handleLoginSubmit(request, env, userProfile, subdomain, corsHeaders);
  }

  // Validate magic link token
  if (path === '/admin/auth' && method === 'GET') {
    return handleMagicLinkAuth(request, env, url, userProfile, subdomain, corsHeaders);
  }

  // === Protected routes (require session) ===

  const session = await validateSessionCookie(request, env);

  // Check session validity and ownership
  if (!session || session.userId !== userProfile.userId) {
    // Redirect to login
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/login`, 302);
  }

  // Handle logout
  if (path === '/admin/logout' && method === 'POST') {
    return handleLogout(request, env, session, subdomain, corsHeaders);
  }

  // Dashboard home
  if (path === '/admin' || path === '/admin/') {
    return handleDashboardHome(request, env, ctx, userProfile, session, subdomain, corsHeaders);
  }

  // Trips page
  if (path === '/admin/trips') {
    return handleTripsPage(request, env, ctx, userProfile, session, subdomain, corsHeaders);
  }

  // Comments page
  if (path === '/admin/comments') {
    return handleCommentsPage(request, env, ctx, userProfile, session, subdomain, corsHeaders);
  }

  // Settings page
  if (path === '/admin/settings' && method === 'GET') {
    return handleSettingsPage(request, env, userProfile, session, subdomain, corsHeaders);
  }

  // Settings form submission
  if (path === '/admin/settings' && method === 'POST') {
    return handleSettingsUpdate(request, env, userProfile, session, subdomain, corsHeaders);
  }

  // Unknown admin route
  return Response.redirect(`https://${subdomain}.voygent.ai/admin`, 302);
}

/**
 * Handle login form submission
 */
async function handleLoginSubmit(
  request: Request,
  env: Env,
  userProfile: UserProfile,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const formData = await request.formData();
    const email = formData.get('email') as string;

    if (!email) {
      return new Response(getLoginPageHtml(subdomain, userProfile, 'Please enter your email address'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
      });
    }

    // Verify email matches user profile
    if (email.toLowerCase() !== userProfile.email.toLowerCase()) {
      return new Response(getLoginPageHtml(subdomain, userProfile, 'Email does not match this account'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
      });
    }

    // Check rate limit
    const allowed = await checkMagicLinkRateLimit(env, email);
    if (!allowed) {
      return new Response(getLoginPageHtml(subdomain, userProfile, 'Too many login attempts. Please try again later.'), {
        status: 429,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
      });
    }

    // Create magic link
    const token = await createMagicLink(env, userProfile.userId, email, subdomain);
    const magicLinkUrl = buildMagicLinkUrl(subdomain, token);

    // For MVP: Show the link on screen (email sending to be added later)
    return new Response(getMagicLinkSentHtml(subdomain, userProfile, email, magicLinkUrl), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
    });
  } catch (err) {
    console.error('Login error:', err);
    return new Response(getLoginPageHtml(subdomain, userProfile, 'An error occurred. Please try again.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
    });
  }
}

/**
 * Handle magic link authentication
 */
async function handleMagicLinkAuth(
  request: Request,
  env: Env,
  url: URL,
  userProfile: UserProfile,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/login`, 302);
  }

  // Validate and consume the token
  const tokenData = await validateMagicLink(env, token);

  if (!tokenData) {
    return new Response(getLoginPageHtml(subdomain, userProfile, 'This link has expired or is invalid. Please request a new one.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
    });
  }

  // Verify the token is for this subdomain
  if (tokenData.subdomain !== subdomain || tokenData.userId !== userProfile.userId) {
    return new Response(getLoginPageHtml(subdomain, userProfile, 'This link is not valid for this account.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
    });
  }

  // Create session
  const sessionToken = await createSession(env, userProfile.userId, tokenData.email, subdomain);
  const sessionCookie = createSessionCookie(sessionToken, subdomain);

  // Redirect to dashboard with session cookie
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `https://${subdomain}.voygent.ai/admin`,
      'Set-Cookie': sessionCookie,
      ...corsHeaders
    }
  });
}

/**
 * Handle logout
 */
async function handleLogout(
  request: Request,
  env: Env,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Extract token from cookie to delete the session
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/voygent_session=([a-f0-9]{64})/);
    if (match) {
      await deleteSession(env, match[1]);
    }
  }

  // Redirect to login with cleared cookie
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `https://${subdomain}.voygent.ai/admin/login`,
      'Set-Cookie': clearSessionCookie(),
      ...corsHeaders
    }
  });
}

/**
 * Handle dashboard home page
 */
async function handleDashboardHome(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Get published trips
  const publishedTrips = await listPublishedTrips(env, userProfile.userId);
  const tripIds = publishedTrips.map(t => t.tripId);

  // Get stats
  const stats = await getUserStats(env, userProfile.userId, tripIds);

  // Get comment count
  const commentIndex = await getCommentIndex(env, userProfile.userId + '/');
  stats.unreadComments = commentIndex.length;

  // Fill in trip titles for top trips
  for (const topTrip of stats.topTrips) {
    const trip = publishedTrips.find(t => t.tripId === topTrip.tripId);
    if (trip) {
      topTrip.title = trip.title;
    }
  }

  // Get monthly usage for publish limits
  const usage = await getMonthlyUsage(env, userProfile.userId);

  const html = getDashboardHomeHtml(userProfile, subdomain, stats, publishedTrips.slice(0, 5), usage);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
  });
}

/**
 * Handle trips page
 */
async function handleTripsPage(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Get published trips with stats
  const publishedTrips = await listPublishedTrips(env, userProfile.userId);

  // Enrich with view stats
  const tripsWithStats = await Promise.all(
    publishedTrips.map(async trip => {
      const stats = await getTripStats(env, userProfile.userId, trip.tripId, 7);
      return {
        ...trip,
        viewsTotal: stats.totalViews,
        viewsLast7Days: stats.dailyViews.reduce((sum, d) => sum + d.views, 0)
      };
    })
  );

  const html = getTripsPageHtml(userProfile, subdomain, tripsWithStats);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
  });
}

/**
 * Handle comments page
 */
async function handleCommentsPage(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const keyPrefix = userProfile.userId + '/';

  // Get trips with comments
  const commentIndex = await getCommentIndex(env, keyPrefix);
  const commentsData: Array<{
    tripId: string;
    tripTitle: string;
    comments: any[];
  }> = [];

  for (const tripId of commentIndex) {
    const commentsKey = `${keyPrefix}${tripId}/_comments`;
    const data = await env.TRIPS.get(commentsKey, 'json') as { comments: any[] } | null;

    if (data?.comments?.length) {
      const activeComments = data.comments.filter(c => !c.dismissed);
      if (activeComments.length > 0) {
        // Get trip data for title
        const tripData = await env.TRIPS.get(`${keyPrefix}${tripId}`, 'json') as any;
        const tripTitle = tripData?.meta?.clientName || tripData?.meta?.destination || tripId;

        commentsData.push({
          tripId,
          tripTitle,
          comments: activeComments
        });
      }
    }
  }

  const html = getCommentsPageHtml(userProfile, subdomain, commentsData);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
  });
}

/**
 * Handle settings page
 */
async function handleSettingsPage(
  request: Request,
  env: Env,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const html = getSettingsPageHtml(userProfile, subdomain);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
  });
}

/**
 * Handle settings update
 */
async function handleSettingsUpdate(
  request: Request,
  env: Env,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const formData = await request.formData();
    const displayName = formData.get('displayName') as string;
    const agencyName = formData.get('agencyName') as string;
    const aiClient = formData.get('aiClient') as string;

    // Update user profile
    if (displayName) {
      userProfile.name = displayName;
    }
    if (agencyName) {
      userProfile.agency = {
        ...userProfile.agency,
        name: agencyName
      };
    }

    // Save updated profile
    await env.TRIPS.put(`_users/${userProfile.userId}`, JSON.stringify(userProfile));

    // Redirect back to settings with success message
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/settings?saved=1`, 302);
  } catch (err) {
    console.error('Settings update error:', err);
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/settings?error=1`, 302);
  }
}
