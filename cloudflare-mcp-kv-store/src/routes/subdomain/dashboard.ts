/**
 * User dashboard routes for subdomain
 * Handles authentication and dashboard pages
 */

import type { Env, UserProfile } from '../../types';
import {
  createSession,
  getSession,
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
import { listPublishedTrips, getPublishedTripMetadata } from '../../lib/published';
import { getUserStats, getTripStats } from '../../lib/stats';
import { getCommentIndex, getTripIndex, filterPendingTripDeletions } from '../../lib/kv';
import { getTripSummaries } from '../../lib/trip-summary';
import {
  getLoginPageHtml,
  getDashboardHomeHtml,
  getTripsPageHtml,
  getCommentsPageHtml,
  getSettingsPageHtml,
  getMagicLinkSentHtml,
  getMessagesPageHtml,
  getThreadPageHtml
} from '../../user-dashboard-pages';
import { getMonthlyUsage } from '../../lib/usage';
import {
  handleToggleTest,
  handleArchive,
  handleDelete,
  handleCopy,
  handleRename
} from './trip-actions';

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

  // DEV BYPASS: Test accounts that skip magic link auth
  const testUserIds = ['neil_38ecccf5', 'kim_d63b7658'];

  let session = await validateSessionCookie(request, env);
  let sessionToken: string | null = null;

  // Check session validity and ownership
  if (!session || session.userId !== userProfile.userId) {
    // Auto-login for test accounts
    if (testUserIds.includes(userProfile.userId)) {
      // Create a session automatically for testing (createSession returns token string)
      sessionToken = await createSession(env, userProfile.userId, userProfile.email, subdomain);
      session = await getSession(env, sessionToken);
    } else {
      // Redirect to login
      return Response.redirect(`https://${subdomain}.voygent.ai/admin/login`, 302);
    }
  }

  // At this point session must be valid (non-test users redirected, test users have new session)
  if (!session) {
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/login`, 302);
  }

  // Get session cookie header for test accounts (set on every request to keep session alive)
  const sessionCookieHeader = (testUserIds.includes(userProfile.userId) && sessionToken)
    ? { 'Set-Cookie': createSessionCookie(sessionToken, subdomain) }
    : {};

  // Helper to add session cookie to response for test accounts
  const addSessionCookie = (response: Response | null): Response | null => {
    if (!response || Object.keys(sessionCookieHeader).length === 0) return response;
    const newHeaders = new Headers(response.headers);
    if (sessionCookieHeader['Set-Cookie']) {
      newHeaders.set('Set-Cookie', sessionCookieHeader['Set-Cookie']);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  };

  // Handle logout
  if (path === '/admin/logout' && method === 'POST') {
    return handleLogout(request, env, session, subdomain, corsHeaders);
  }

  // Dashboard home
  if (path === '/admin' || path === '/admin/') {
    return addSessionCookie(await handleDashboardHome(request, env, ctx, userProfile, session, subdomain, corsHeaders));
  }

  // Trips page
  if (path === '/admin/trips') {
    return addSessionCookie(await handleTripsPage(request, env, ctx, url, userProfile, session, subdomain, corsHeaders));
  }

  // Comments page
  if (path === '/admin/comments') {
    return addSessionCookie(await handleCommentsPage(request, env, ctx, userProfile, session, subdomain, corsHeaders));
  }

  // Messages page
  if (path === '/admin/messages' && method === 'GET') {
    return addSessionCookie(await handleMessagesPage(request, env, ctx, userProfile, session, subdomain, corsHeaders));
  }

  // Thread detail page
  const threadMatch = path.match(/^\/admin\/messages\/thread\/([^/]+)$/);
  if (threadMatch && method === 'GET') {
    const threadId = threadMatch[1];
    return addSessionCookie(await handleThreadPage(request, env, ctx, userProfile, session, subdomain, threadId, corsHeaders));
  }

  // Reply to thread
  const replyMatch = path.match(/^\/admin\/messages\/thread\/([^/]+)\/reply$/);
  if (replyMatch && method === 'POST') {
    const threadId = replyMatch[1];
    return addSessionCookie(await handleThreadReply(request, env, userProfile, session, subdomain, threadId, corsHeaders));
  }

  // Dismiss broadcast
  if (path === '/admin/messages/dismiss' && method === 'POST') {
    return addSessionCookie(await handleDismissMessage(request, env, userProfile, session, subdomain, corsHeaders));
  }

  // Settings page
  if (path === '/admin/settings' && method === 'GET') {
    return addSessionCookie(await handleSettingsPage(request, env, url, userProfile, session, subdomain, corsHeaders));
  }

  // Settings form submission (profile)
  if (path === '/admin/settings' && method === 'POST') {
    return addSessionCookie(await handleSettingsUpdate(request, env, userProfile, session, subdomain, corsHeaders));
  }

  // Branding settings form submission
  if (path === '/admin/settings/branding' && method === 'POST') {
    return addSessionCookie(await handleBrandingUpdate(request, env, userProfile, session, subdomain, corsHeaders));
  }

  // === Trip Actions ===

  // Extract trip ID from path for trip actions
  const tripActionMatch = path.match(/^\/admin\/trips\/([^/]+)\/(toggle-test|archive|delete|copy|rename)$/);
  if (tripActionMatch && method === 'POST') {
    const tripId = tripActionMatch[1];
    const action = tripActionMatch[2];

    switch (action) {
      case 'toggle-test':
        return addSessionCookie(await handleToggleTest(request, env, ctx, userProfile, session, subdomain, tripId, corsHeaders));
      case 'archive':
        return addSessionCookie(await handleArchive(request, env, ctx, userProfile, session, subdomain, tripId, corsHeaders));
      case 'delete':
        return addSessionCookie(await handleDelete(request, env, ctx, userProfile, session, subdomain, tripId, corsHeaders));
      case 'copy':
        return addSessionCookie(await handleCopy(request, env, ctx, userProfile, session, subdomain, tripId, corsHeaders));
      case 'rename':
        return addSessionCookie(await handleRename(request, env, ctx, userProfile, session, subdomain, tripId, corsHeaders));
    }
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
  const keyPrefix = userProfile.userId + '/';

  // Get ALL trips for this user (not just published)
  const allTripIds = await getTripIndex(env, keyPrefix);
  const visibleTripIds = await filterPendingTripDeletions(env, keyPrefix, allTripIds, ctx);

  // Get trip summaries for all trips
  const tripSummaries = await getTripSummaries(env, keyPrefix, visibleTripIds, ctx);

  // Get published trips to check publish status
  const publishedTrips = await listPublishedTrips(env, userProfile.userId);
  const publishedMap = new Map(publishedTrips.map(t => [t.tripId, t]));

  // Combine trip data with publish status
  const recentTrips = tripSummaries.slice(0, 5).map(summary => {
    const published = publishedMap.get(summary.tripId);
    return {
      tripId: summary.tripId,
      title: summary.title,
      destination: summary.destination,
      status: summary.status || summary.phase || 'draft',
      lastModified: summary.updatedAt,
      isPublished: !!published,
      filename: published?.filename,
      category: published?.category || 'proposal',
      views: published?.views || 0
    };
  });

  // Get stats (using published trip IDs for view stats)
  const publishedTripIds = publishedTrips.map(t => t.tripId);
  const stats = await getUserStats(env, userProfile.userId, publishedTripIds);
  stats.totalTrips = visibleTripIds.length;

  // Get comment count
  const commentIndex = await getCommentIndex(env, keyPrefix);
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

  const html = getDashboardHomeHtml(userProfile, subdomain, stats, recentTrips, usage);

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
  url: URL,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const keyPrefix = userProfile.userId + '/';

  // Get ALL trips for this user
  const allTripIds = await getTripIndex(env, keyPrefix);
  const visibleTripIds = await filterPendingTripDeletions(env, keyPrefix, allTripIds, ctx);

  // Get trip summaries
  const tripSummaries = await getTripSummaries(env, keyPrefix, visibleTripIds, ctx);

  // Get published trips to check publish status
  const publishedTrips = await listPublishedTrips(env, userProfile.userId);
  const publishedMap = new Map(publishedTrips.map(t => [t.tripId, t]));

  // Get filter params from URL
  const showTestTrips = url.searchParams.get('showTest') === '1';
  const showArchived = url.searchParams.get('showArchived') === '1';

  // Filter summaries based on URL params
  const filteredSummaries = tripSummaries.filter(summary => {
    if (!showTestTrips && summary.isTest) return false;
    if (!showArchived && summary.isArchived) return false;
    return true;
  });

  // Combine trip data with stats
  const tripsWithStats = await Promise.all(
    filteredSummaries.map(async summary => {
      const published = publishedMap.get(summary.tripId);
      const stats = published
        ? await getTripStats(env, userProfile.userId, summary.tripId, 7)
        : { totalViews: 0, dailyViews: [] };

      return {
        tripId: summary.tripId,
        title: summary.title,
        destination: summary.destination,
        status: summary.status || summary.phase || 'draft',
        lastModified: summary.updatedAt,
        isPublished: !!published,
        filename: published?.filename,
        category: published?.category || 'proposal',
        publishedAt: published?.publishedAt,
        viewsTotal: stats.totalViews,
        viewsLast7Days: stats.dailyViews.reduce((sum: number, d: any) => sum + d.views, 0),
        isTest: summary.isTest,
        isArchived: summary.isArchived
      };
    })
  );

  // Count hidden trips
  const testTripCount = tripSummaries.filter(s => s.isTest).length;
  const archivedTripCount = tripSummaries.filter(s => s.isArchived).length;

  const html = getTripsPageHtml(
    userProfile,
    subdomain,
    tripsWithStats,
    session.csrfToken,
    { showTestTrips, showArchived, testTripCount, archivedTripCount }
  );

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
  url: URL,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const success = url.searchParams.get('saved') === '1' ? 'Settings saved successfully!' : undefined;
  const html = getSettingsPageHtml(userProfile, subdomain, success);

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

/**
 * Handle messages page
 */
async function handleMessagesPage(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Load broadcasts (non-dismissed for this user)
  const broadcastData = await env.TRIPS.get("_admin_messages/broadcasts", "json") as { messages: any[] } | null;
  const userStateKey = `_admin_messages/user_states/${userProfile.userId}`;
  const userState = await env.TRIPS.get(userStateKey, "json") as { dismissedBroadcasts: string[] } | null;
  const dismissedIds = new Set(userState?.dismissedBroadcasts || []);

  const now = new Date().toISOString();
  const broadcasts = (broadcastData?.messages || [])
    .filter((b: any) => !dismissedIds.has(b.id) && (!b.expiresAt || b.expiresAt > now));

  // Load direct message threads for this user
  const threadsKey = `_admin_messages/threads/${userProfile.userId}`;
  const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;
  const threads = (threadsData?.threads || []).map((t: any) => {
    const unreadCount = t.messages.filter((m: any) => m.sender === 'admin' && !m.read).length;
    const lastMsg = t.messages[t.messages.length - 1];
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      unreadCount,
      lastMessage: lastMsg ? {
        sender: lastMsg.sender,
        preview: (lastMsg.body || '').substring(0, 100),
        timestamp: lastMsg.timestamp
      } : null,
      messageCount: t.messages.length
    };
  });

  // Calculate total unread
  const unreadTotal = threads.reduce((sum: number, t: any) => sum + t.unreadCount, 0) + broadcasts.length;

  const html = getMessagesPageHtml(
    userProfile,
    subdomain,
    { broadcasts, threads, unreadTotal },
    session.csrfToken
  );

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
  });
}

/**
 * Handle thread detail page
 */
async function handleThreadPage(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  threadId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const threadsKey = `_admin_messages/threads/${userProfile.userId}`;
  const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;
  const thread = threadsData?.threads?.find((t: any) => t.id === threadId);

  if (!thread) {
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/messages`, 302);
  }

  // Mark admin messages as read
  let updated = false;
  for (const msg of thread.messages) {
    if (msg.sender === 'admin' && !msg.read) {
      msg.read = true;
      updated = true;
    }
  }
  if (updated && threadsData) {
    await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));
  }

  const html = getThreadPageHtml(
    userProfile,
    subdomain,
    {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      messages: thread.messages
    },
    session.csrfToken
  );

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
  });
}

/**
 * Handle thread reply
 */
async function handleThreadReply(
  request: Request,
  env: Env,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  threadId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Validate CSRF
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response('Invalid form data', { status: 400, headers: corsHeaders });
  }

  const csrfToken = formData.get('_csrf') as string | null;
  const { validateCsrfToken, validateRequestOrigin } = await import('../../lib/session');

  if (!validateRequestOrigin(request, `${subdomain}.voygent.ai`)) {
    return new Response('Invalid request origin', { status: 403, headers: corsHeaders });
  }
  if (!validateCsrfToken(session, csrfToken)) {
    return new Response('Invalid CSRF token', { status: 403, headers: corsHeaders });
  }

  const message = formData.get('message') as string;
  if (!message?.trim()) {
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/messages/thread/${threadId}`, 302);
  }

  const threadsKey = `_admin_messages/threads/${userProfile.userId}`;
  const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;
  const thread = threadsData?.threads?.find((t: any) => t.id === threadId);

  if (!thread || thread.status !== 'open') {
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/messages`, 302);
  }

  // Add user reply
  thread.messages.push({
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sender: 'user',
    senderName: userProfile.name || userProfile.email,
    body: message.trim(),
    timestamp: new Date().toISOString(),
    read: false
  });
  thread.updatedAt = new Date().toISOString();

  await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));

  return Response.redirect(`https://${subdomain}.voygent.ai/admin/messages/thread/${threadId}`, 302);
}

/**
 * Handle dismiss message (broadcast)
 */
async function handleDismissMessage(
  request: Request,
  env: Env,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Validate CSRF
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response('Invalid form data', { status: 400, headers: corsHeaders });
  }

  const csrfToken = formData.get('_csrf') as string | null;
  const { validateCsrfToken, validateRequestOrigin } = await import('../../lib/session');

  if (!validateRequestOrigin(request, `${subdomain}.voygent.ai`)) {
    return new Response('Invalid request origin', { status: 403, headers: corsHeaders });
  }
  if (!validateCsrfToken(session, csrfToken)) {
    return new Response('Invalid CSRF token', { status: 403, headers: corsHeaders });
  }

  const messageId = formData.get('messageId') as string;
  const type = formData.get('type') as string;

  if (type === 'broadcast' && messageId) {
    const userStateKey = `_admin_messages/user_states/${userProfile.userId}`;
    const userState = await env.TRIPS.get(userStateKey, "json") as { dismissedBroadcasts: string[] } | null || { dismissedBroadcasts: [] };

    if (!userState.dismissedBroadcasts.includes(messageId)) {
      userState.dismissedBroadcasts.push(messageId);
      await env.TRIPS.put(userStateKey, JSON.stringify(userState));
    }
  }

  return Response.redirect(`https://${subdomain}.voygent.ai/admin/messages`, 302);
}

/**
 * Handle branding settings update
 */
async function handleBrandingUpdate(
  request: Request,
  env: Env,
  userProfile: UserProfile,
  session: Session,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const formData = await request.formData();

    // Get form values
    const colorScheme = formData.get('colorScheme') as string;
    const darkMode = formData.get('darkMode') as string;
    const primaryColor = formData.get('primaryColor') as string;
    const accentColor = formData.get('accentColor') as string;
    const tagline = formData.get('tagline') as string;
    const agentPhoto = formData.get('agentPhoto') as string;
    const agencyTitle = formData.get('agencyTitle') as string;
    const agencyLogo = formData.get('agencyLogo') as string;

    // Validate color scheme
    const validSchemes = ['ocean', 'sunset', 'forest', 'royal', 'coral', 'slate', 'wine', 'tropical', 'custom'];
    const validColorScheme = validSchemes.includes(colorScheme) ? colorScheme : undefined;

    // Validate hex colors
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    const validPrimaryColor = hexColorRegex.test(primaryColor) ? primaryColor : undefined;
    const validAccentColor = hexColorRegex.test(accentColor) ? accentColor : undefined;

    // Update branding
    userProfile.branding = {
      ...userProfile.branding,
      colorScheme: validColorScheme || userProfile.branding?.colorScheme,
      darkMode: darkMode === 'true',
      primaryColor: validPrimaryColor || userProfile.branding?.primaryColor,
      accentColor: validAccentColor || userProfile.branding?.accentColor,
      tagline: tagline || undefined,
      agentPhoto: agentPhoto || undefined
    };

    // Update agency title and logo
    userProfile.agency = {
      ...userProfile.agency,
      title: agencyTitle || userProfile.agency?.title,
      logo: agencyLogo || userProfile.agency?.logo
    };

    // Save updated profile
    await env.TRIPS.put(`_users/${userProfile.userId}`, JSON.stringify(userProfile));

    // Redirect back to settings with success message
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/settings?saved=1`, 302);
  } catch (err) {
    console.error('Branding update error:', err);
    return Response.redirect(`https://${subdomain}.voygent.ai/admin/settings?error=1`, 302);
  }
}
